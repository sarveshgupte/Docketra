const log = require('../utils/log');
const { getCookieValue } = require('../utils/requestCookies');
const { REASON_CODES, logPilotEvent } = require('./pilotDiagnostics.service');

const normalizedCookieSameSite = () => {
  const configured = String(process.env.AUTH_COOKIE_SAMESITE || 'lax').trim().toLowerCase();
  if (configured === 'strict' || configured === 'lax') return configured;
  if (configured === 'none') {
    return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
  }
  return 'lax';
};

const getAuthCookieOptions = ({ maxAge = undefined } = {}) => {
  const secureCookies = process.env.NODE_ENV === 'production';
  const cookieDomain = String(process.env.AUTH_COOKIE_DOMAIN || '').trim();
  const sameSite = normalizedCookieSameSite();
  return {
    httpOnly: true,
    secure: secureCookies,
    sameSite,
    path: '/',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  };
};

const setAuthCookies = (res, { accessToken, refreshToken, refreshMaxAge } = {}) => {
  if (!res || typeof res.cookie !== 'function') return;
  const fifteenMinutesMs = 15 * 60 * 1000;
  const refreshMs = typeof refreshMaxAge === 'number'
    ? refreshMaxAge
    : Number(process.env.JWT_REFRESH_EXPIRES_MS || 7 * 24 * 60 * 60 * 1000);

  if (accessToken) {
    res.cookie('accessToken', accessToken, getAuthCookieOptions({ maxAge: fifteenMinutesMs }));
  }
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, getAuthCookieOptions({ maxAge: refreshMs }));
  }
};

const clearAuthCookies = (res) => {
  if (!res || typeof res.clearCookie !== 'function') return;
  res.clearCookie('accessToken', getAuthCookieOptions());
  res.clearCookie('refreshToken', getAuthCookieOptions());
};
const createAuthSessionService = (deps) => {
  const models = deps.models || {};
  const utils = deps.utils || {};
  const services = deps.services || {};
  const {
    RefreshToken = deps.RefreshToken,
    User = deps.User,
  } = models;
  const {
    isActiveStatus = deps.isActiveStatus,
    noteRefreshTokenFailure = deps.noteRefreshTokenFailure,
    noteRefreshTokenUse = deps.noteRefreshTokenUse,
    logAuthAudit = deps.logAuthAudit,
    disconnectSocketsForUser = deps.disconnectSocketsForUser,
    getFirmSlug = deps.getFirmSlug,
    isSuperAdminRole = deps.isSuperAdminRole,
    DEFAULT_FIRM_ID = deps.DEFAULT_FIRM_ID,
    getSession = deps.getSession,
  } = utils;
  const {
    jwtService = deps.jwtService,
  } = services;

  const generateAndStoreRefreshToken = async ({ req, userId = null, firmId = null }) => {
    if (!req) {
      throw new Error('Request object is required to capture client IP and user agent for refresh token security');
    }

    const refreshToken = jwtService.generateRefreshToken();
    const refreshTokenHash = jwtService.hashRefreshToken(refreshToken);
    const expiresAt = jwtService.getRefreshTokenExpiry();
    const session = getSession(req);

    if (!refreshTokenHash || !expiresAt) {
      throw new Error('[AUTH][refresh-token] Refresh token generation failed: missing required fields');
    }
    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
      throw new Error('[AUTH][refresh-token] Failed to generate refresh token payload (expiresAt invalid)');
    }

    const refreshTokenDoc = {
      tokenHash: refreshTokenHash,
      userId,
      firmId,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    await RefreshToken.create([refreshTokenDoc], session ? { session } : undefined);

    return { refreshToken, expiresAt };
  };

  const logoutHandler = async (req) => {
    try {
      const user = req.user;
      const isSuperAdmin = isSuperAdminRole(user?.role);
      const shouldBypassUserDbUpdates = isSuperAdmin;

      if (!shouldBypassUserDbUpdates) {
        await RefreshToken.updateMany(
          { userId: user._id, isRevoked: false },
          { isRevoked: true }
        );
        if (typeof disconnectSocketsForUser === 'function') {
          disconnectSocketsForUser({
            firmId: user.firmId,
            userMongoId: user._id,
            userXid: user.xID,
          });
        }
      }

      const clearCookies = [
        { name: 'accessToken', options: getAuthCookieOptions() },
        { name: 'refreshToken', options: getAuthCookieOptions() },
      ];

      try {
        if (!shouldBypassUserDbUpdates) {
          await logAuthAudit({
            xID: user.xID,
            firmId: user.firmId || DEFAULT_FIRM_ID,
            userId: user._id,
            actionType: 'Logout',
            description: 'User logged out',
            performedBy: user.xID,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          }, req);
        }
      } catch (auditError) {
        log.error('[AUTH AUDIT] Failed to record logout event', auditError);
      }

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Logout successful',
        },
        clearCookies,
      };
    } catch (error) {
      log.error('[AUTH] Logout error:', error);
      return {
        statusCode: 500,
        body: {
          success: false,
          message: 'Error during logout',
        },
        clearCookies: [],
      };
    }
  };

  const logout = async (reqOrData, maybeRes) => {
    const req = maybeRes ? reqOrData : (reqOrData?.req || reqOrData);
    const response = await logoutHandler(req);
    if (maybeRes) {
      for (const cookieConfig of (response.clearCookies || [])) {
        maybeRes.clearCookie(cookieConfig.name, cookieConfig.options);
      }
      return maybeRes.status(response.statusCode || 200).json(response.body);
    }
    return response;
  };

  const refreshAccessToken = async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken || getCookieValue(req.headers?.cookie, 'refreshToken');

      if (!refreshToken) {
        log.info('[AUTH] Refresh rejected: refresh token cookie missing.', {
          path: req.originalUrl || req.url,
          hasCookieHeader: Boolean(req.headers?.cookie),
        });
        clearAuthCookies(res);
        return res.status(401).json({
          success: false,
          reasonCode: REASON_CODES.MISSING_REFRESH_TOKEN,
          message: 'Authentication required',
        });
      }

      const tokenHash = jwtService.hashRefreshToken(refreshToken);
      const storedToken = await RefreshToken.findOne({ tokenHash });
      const now = new Date();

      if (!storedToken || storedToken.expiresAt <= now) {
        log.info('[AUTH] Refresh rejected: token invalid or expired.', {
          hasStoredToken: Boolean(storedToken),
        });
        await noteRefreshTokenFailure({
          req,
          userId: storedToken?.userId || null,
          firmId: storedToken?.firmId || null,
          reason: 'invalid_refresh_token',
        });
        clearAuthCookies(res);
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
      }

      if (storedToken.isRevoked) {
        log.info('[AUTH] Refresh rejected: token already revoked.');
        await noteRefreshTokenFailure({
          req,
          userId: storedToken.userId,
          firmId: storedToken.firmId,
          reason: 'revoked_refresh_token',
        });
        clearAuthCookies(res);
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
      }

      const isSuperAdminToken = !storedToken.userId;
      const isTokenMissingFirmContext = !storedToken.firmId;
      if (isSuperAdminToken || isTokenMissingFirmContext) {
        log.info('[AUTH] Refresh rejected: unsupported token scope.', {
          isSuperAdminToken,
          isTokenMissingFirmContext,
        });
        await noteRefreshTokenFailure({
          req,
          reason: 'refresh_not_supported',
        });
        logPilotEvent({ event: 'auth_refresh_rejected', severity: 'warn', metadata: { reasonCode: REASON_CODES.REFRESH_NOT_SUPPORTED, route: req.originalUrl || req.url } });
        clearAuthCookies(res);
        return res.status(401).json({
          success: false,
          code: 'REFRESH_NOT_SUPPORTED',
          reasonCode: REASON_CODES.REFRESH_NOT_SUPPORTED,
          message: 'Session refresh is not supported for SuperAdmin accounts',
        });
      }

      const user = await User.findOne({
        _id: storedToken.userId,
        firmId: storedToken.firmId,
      });

      if (!user || !isActiveStatus(user.status)) {
        log.info('[AUTH] Refresh rejected: user missing or inactive.', {
          hasUser: Boolean(user),
          userStatus: user?.status || null,
        });
        await noteRefreshTokenFailure({
          req,
          userId: storedToken.userId,
          firmId: storedToken.firmId,
          reason: 'refresh_user_not_found',
        });
        clearAuthCookies(res);
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive',
        });
      }

      await noteRefreshTokenUse({
        req,
        userId: storedToken.userId,
        firmId: storedToken.firmId,
        tokenIpAddress: storedToken.ipAddress || null,
      });

      storedToken.isRevoked = true;
      storedToken.lastUsedAt = now;
      await storedToken.save();

      const firmSlug = await getFirmSlug(user.firmId);
      const defaultClientId = user.defaultClientId ? user.defaultClientId.toString() : undefined;

      const newAccessToken = jwtService.generateAccessToken({
        userId: user._id.toString(),
        firmId: user.firmId ? user.firmId.toString() : undefined,
        firmSlug: firmSlug || undefined,
        defaultClientId,
        role: user.role,
      });

      const { refreshToken: newRefreshToken } = await generateAndStoreRefreshToken({
        req,
        userId: user._id,
        firmId: user.firmId,
      });

      setAuthCookies(res, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        refreshMaxAge: jwtService.getRefreshTokenExpiryMs(),
      });

      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId,
        userId: user._id,
        actionType: 'TokenRefreshed',
        description: 'Access token refreshed successfully',
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      logPilotEvent({ event: 'auth_refresh_succeeded', metadata: { firmId: user.firmId, userId: user._id, route: req.originalUrl || req.url } });
      return res.json({
        success: true,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      log.error('[AUTH] Refresh token error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error refreshing token',
      });
    }
  };

  return {
    getAuthCookieOptions,
    setAuthCookies,
    clearAuthCookies,
    generateAndStoreRefreshToken,
    logout,
    refreshAccessToken,
  };
};

module.exports = createAuthSessionService;
