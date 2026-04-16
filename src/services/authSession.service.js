const createAuthSessionService = (deps) => {
  const {
    jwtService,
    getSession,
    RefreshToken,
    User,
    isActiveStatus,
    noteRefreshTokenFailure,
    noteRefreshTokenUse,
    logAuthAudit,
    getFirmSlug,
    isSuperAdminRole,
    DEFAULT_FIRM_ID,
  } = deps;

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

  const logout = async (req, res) => {
    try {
      const user = req.user;
      const isSuperAdmin = isSuperAdminRole(user?.role);
      const shouldBypassUserDbUpdates = isSuperAdmin;

      if (!shouldBypassUserDbUpdates) {
        await RefreshToken.updateMany(
          { userId: user._id, isRevoked: false },
          { isRevoked: true }
        );
      }

      const secureCookies = process.env.NODE_ENV === 'production';
      res.clearCookie('accessToken', { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: '/' });
      res.clearCookie('refreshToken', { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: '/' });

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
        console.error('[AUTH AUDIT] Failed to record logout event', auditError);
      }

      return res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('[AUTH] Logout error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error during logout',
      });
    }
  };

  const refreshAccessToken = async (req, res) => {
    try {
      const refreshToken =
        req.body.refreshToken ||
        req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
      }

      const tokenHash = jwtService.hashRefreshToken(refreshToken);
      const storedToken = await RefreshToken.findOne({ tokenHash });
      const now = new Date();

      if (!storedToken || storedToken.expiresAt <= now) {
        await noteRefreshTokenFailure({
          req,
          userId: storedToken?.userId || null,
          firmId: storedToken?.firmId || null,
          reason: 'invalid_refresh_token',
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
      }

      if (storedToken.isRevoked) {
        await noteRefreshTokenFailure({
          req,
          userId: storedToken.userId,
          firmId: storedToken.firmId,
          reason: 'revoked_refresh_token',
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
      }

      const isSuperAdminToken = !storedToken.userId;
      const isTokenMissingFirmContext = !storedToken.firmId;
      if (isSuperAdminToken || isTokenMissingFirmContext) {
        await noteRefreshTokenFailure({
          req,
          reason: 'refresh_not_supported',
        });
        return res.status(401).json({
          success: false,
          code: 'REFRESH_NOT_SUPPORTED',
          message: 'Session refresh is not supported for SuperAdmin accounts',
        });
      }

      const user = await User.findOne({
        _id: storedToken.userId,
        firmId: storedToken.firmId,
      });

      if (!user || !isActiveStatus(user.status)) {
        await noteRefreshTokenFailure({
          req,
          userId: storedToken.userId,
          firmId: storedToken.firmId,
          reason: 'refresh_user_not_found',
        });
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

      const secureCookies = process.env.NODE_ENV === 'production';
      const fifteenMinutesMs = 15 * 60 * 1000;
      const refreshMs = jwtService.getRefreshTokenExpiryMs();

      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        maxAge: fifteenMinutesMs,
        path: '/',
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        maxAge: refreshMs,
        path: '/',
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

      return res.json({
        success: true,
        message: 'Token refreshed successfully',
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error('[AUTH] Refresh token error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error refreshing token',
      });
    }
  };

  return {
    generateAndStoreRefreshToken,
    logout,
    refreshAccessToken,
  };
};

module.exports = createAuthSessionService;
