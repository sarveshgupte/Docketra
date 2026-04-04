const fs = require('fs');

const file = 'src/controllers/auth.controller.js';
let content = fs.readFileSync(file, 'utf8');

// Find the login function start
const loginStartMatch = content.indexOf('const login = async (req, res) => {');
const loginEndMatch = content.indexOf('const resendLoginOtp = async (req, res) => {');

if (loginStartMatch === -1 || loginEndMatch === -1) {
    console.error('Could not find login function boundaries.');
    process.exit(1);
}

const beforeLogin = content.substring(0, loginStartMatch);
const afterLogin = content.substring(loginEndMatch);

const newLoginLogic = `
const handleSuperadminLogin = async (req, res, normalizedXID, password, loginScope) => {
  const { rawXID: superadminXIDRaw, normalizedXID: superadminXID, email: superadminEmail } = getSuperadminEnv();

  if (loginScope !== 'superadmin') {
    return res.status(401).json({ success: false, message: 'Invalid xID or password' });
  }
  console.log('[AUTH][superadmin] login attempt', { xID: normalizedXID });

  const superadminPasswordHash = process.env.SUPERADMIN_PASSWORD_HASH;
  if (!superadminPasswordHash) {
    console.error('[AUTH][superadmin] SUPERADMIN_PASSWORD_HASH not configured in environment');
    return res.status(500).json({
      success: false,
      message: 'SuperAdmin authentication not configured',
    });
  }

  const isSuperadminPasswordValid = await bcrypt.compare(password, superadminPasswordHash);

  if (!isSuperadminPasswordValid) {
    await recordFailedLoginAttempt(req);
    console.warn('[AUTH][superadmin] SuperAdmin login failed - invalid credentials');
    await logAuthAudit({
      xID: normalizedXID || DEFAULT_XID,
      firmId: DEFAULT_FIRM_ID,
      actionType: 'LoginFailed',
      description: 'SuperAdmin login failed: invalid credentials',
      performedBy: normalizedXID || DEFAULT_XID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { eventType: 'LOGIN_FAILED', email: superadminEmail || null, timestamp: new Date().toISOString() },
    }, req);
    return res.status(401).json({
      success: false,
      message: 'Invalid xID or password',
    });
  }

  console.log('[AUTH][superadmin] SuperAdmin login successful');
  await clearFailedLoginAttempts(req);
  await logAuthAudit({
    xID: normalizedXID || DEFAULT_XID,
    firmId: DEFAULT_FIRM_ID,
    actionType: 'LOGIN_SUCCESS',
    description: 'SuperAdmin login successful',
    performedBy: normalizedXID || DEFAULT_XID,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { eventType: 'LOGIN_SUCCESS', email: superadminEmail || null, timestamp: new Date().toISOString() },
  }, req);

  const user = {
    id: SUPERADMIN_USER_ID(),
    xID: superadminXIDRaw || 'SUPERADMIN',
    email: superadminEmail,
    role: SUPERADMIN_ROLE,
    firmId: null,
    isSuperAdmin: true,
  };

  try {
    console.log('[DEBUG] user object:', user);

    const accessToken = jwtService.generateAccessToken({
      userId: user.id,
      role: user.role,
      firmId: user.firmId,
      firmSlug: null,
      defaultClientId: null,
      isSuperAdmin: user.isSuperAdmin,
    });

    return res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken: null,
      isSuperAdmin: true,
      refreshEnabled: false,
      data: user,
    });
  } catch (postAuthError) {
    console.error('[AUTH][superadmin] Post-auth token/response failure', {
      message: postAuthError.message,
      xID: normalizedXID || DEFAULT_XID,
    });
    return res.status(500).json({
      success: false,
      message: 'Authentication succeeded but response generation failed',
    });
  }
};

const validateTenantUserPreconditions = async (req, res, user, requestedFirmSlug, normalizedXID) => {
  const loginScope = req.loginScope || 'tenant';
  if (!user || !isActiveStatus(user.status)) {
    await recordFailedLoginAttempt(req);
    console.warn(\`[AUTH] Invalid login attempt for xID=\${normalizedXID} in firm context \${req.firmSlug || req.firmId}\`);
    try {
      await logAuthAudit({
        xID: normalizedXID || 'UNKNOWN',
        firmId: req.firmIdString || req.firmId || 'UNKNOWN',
        actionType: 'LoginFailed',
        description: \`Login failed: invalid credentials (xID: \${normalizedXID}, firmSlug: \${requestedFirmSlug || 'none'})\`,
        performedBy: normalizedXID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          eventType: 'LOGIN_FAILED',
          email: null,
          timestamp: new Date().toISOString(),
        },
      }, req);
      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.LOGIN_FAILURE,
        resource: 'auth/login',
        firmId: req.firmIdString || req.firmId || 'UNKNOWN',
        xID: normalizedXID || 'UNKNOWN',
        performedBy: normalizedXID || 'UNKNOWN',
        metadata: {
          reason: 'invalid_credentials',
          loginScope,
        },
        description: 'Login failed due to invalid credentials',
      }).catch(() => null);
      await noteLoginFailure({
        req,
        xID: normalizedXID || 'UNKNOWN',
        firmId: req.firmIdString || req.firmId || null,
      });
    } catch (auditError) {
      console.error('[AUTH AUDIT] Failed to record login failure event', auditError);
    }
    res.status(401).json({
      success: false,
      message: 'Invalid xID or password',
    });
    return true;
  }

  if (user.role !== 'SUPER_ADMIN') {
    const firmCount = await Firm.countDocuments();
    if (firmCount === 0) {
      console.warn(\`[AUTH] Login blocked for \${user.xID} - system not initialized (no firms exist)\`);
      res.status(403).json({
        success: false,
        message: 'System not initialized. Contact SuperAdmin.',
      });
      return true;
    }
  }

  if (!isSuperAdminRole(user.role) && !user.firmId) {
    console.error(\`[AUTH] User \${user.xID} missing firmId - login rejected\`);
    res.status(403).json({
      success: false,
      message: 'Account is not linked to a firm. Please complete onboarding or contact administrator.',
    });
    return true;
  }

  if (user.role === ROLE_ADMIN) {
    console.log(\`[AUTH] Admin \${user.xID} validation - firmId: \${user.firmId}, defaultClientId: \${user.defaultClientId}\`);
    try {
      await ensureUserDefaultClientLink(user, req);
    } catch (defaultClientError) {
      console.error(\`[AUTH] Failed to enforce default client invariant for \${user.xID}:\`, defaultClientError.message);
      res.status(500).json({
        success: false,
        message: 'Account configuration error. Please contact administrator.',
      });
      return true;
    }
  }

  if (!isActiveStatus(user.status)) {
    res.status(403).json({
      success: false,
      message: 'Please complete your account setup using the invite link sent to your email',
      accountStatus: user.status,
    });
    return true;
  }

  if (user.isLocked) {
    await noteLockedAccountAttempt({
      req,
      userId: user._id,
      firmId: user.firmId || DEFAULT_FIRM_ID,
      xID: user.xID,
    });
    const retryAfter = Math.max(1, Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    res.status(403).json({
      success: false,
      error: 'ACCOUNT_TEMP_LOCKED',
      retryAfter,
    });
    return true;
  }

  const passwordSetupRequired = user.mustChangePassword || user.mustSetPassword;
  if (passwordSetupRequired || !user.passwordHash) {
    res.status(403).json({
      success: false,
      code: 'PASSWORD_SETUP_REQUIRED',
      message: 'Please set your password using the link sent to your email',
      mustSetPassword: true,
      redirectPath: '/auth/setup-account',
    });
    return true;
  }

  return false;
};

const handlePasswordVerification = async (req, res, user, password) => {
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    await recordFailedLoginAttempt(req);
    const lockUntilAt = new Date(Date.now() + LOCK_TIME);

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, firmId: user.firmId },
      [
        {
          $set: {
            failedLoginAttempts: {
              $add: [{ $ifNull: ['$failedLoginAttempts', 0] }, 1],
            },
            lockUntil: {
              $let: {
                vars: {
                  nextFailedAttempts: {
                    $add: [{ $ifNull: ['$failedLoginAttempts', 0] }, 1],
                  },
                },
                in: {
                  $cond: [
                    { $gte: ['$$nextFailedAttempts', MAX_FAILED_ATTEMPTS] },
                    { $ifNull: ['$lockUntil', lockUntilAt] },
                    '$lockUntil',
                  ],
                },
              },
            },
          },
        },
      ],
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      res.status(401).json({
        success: false,
        message: 'Invalid xID or password',
      });
      return false;
    }

    const currentFailedAttempts = updatedUser.failedLoginAttempts || 0;
    const isNowLocked = updatedUser.lockUntil && new Date(updatedUser.lockUntil) > new Date();

    if (isNowLocked && currentFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      try {
        await logAuthAudit({
          xID: user.xID,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          userId: user._id,
          actionType: 'AccountLocked',
          description: \`Account locked due to \${MAX_FAILED_ATTEMPTS} failed login attempts\`,
          performedBy: user.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }, req);
      } catch (auditError) {
        console.error('[AUTH AUDIT] Failed to record account lock event', auditError);
      }

      res.status(403).json({
        success: false,
        error: 'ACCOUNT_TEMP_LOCKED',
        retryAfter: config.security.rateLimit.accountLockSeconds,
      });
      return false;
    }

    try {
      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        userId: user._id,
        actionType: 'LOGIN_FAILED',
        description: \`Login failed: Invalid password (attempt \${currentFailedAttempts})\`,
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          eventType: 'LOGIN_FAILED',
          email: user.email || null,
          timestamp: new Date().toISOString(),
        },
      }, req);
      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.LOGIN_FAILURE,
        resource: 'auth/login',
        userId: user._id,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        xID: user.xID,
        performedBy: user.xID,
        metadata: {
          reason: 'invalid_password',
          failedAttempts: currentFailedAttempts,
        },
        description: \`Login failed: invalid password (attempt \${currentFailedAttempts})\`,
      }).catch(() => null);
      await noteLoginFailure({
        req,
        xID: user.xID,
        userId: user._id,
        firmId: user.firmId || DEFAULT_FIRM_ID,
      });
    } catch (auditError) {
      console.error('[AUTH AUDIT] Failed to record login failure event', auditError);
    }

    res.status(401).json({
      success: false,
      message: 'Invalid xID or password',
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - currentFailedAttempts),
    });
    return false;
  }

  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }
  await clearFailedLoginAttempts(req);
  return true;
};

const handlePostPasswordChecks = async (req, res, user) => {
  const now = new Date();
  if (user.passwordExpiresAt && user.passwordExpiresAt < now) {
    try {
      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        userId: user._id,
        actionType: 'PasswordExpired',
        description: \`Login attempt with expired password\`,
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);
    } catch (auditError) {
      console.error('[AUTH AUDIT] Failed to record password expiry event', auditError);
    }

    res.status(403).json({
      success: false,
      message: 'Password has expired. Please change your password.',
      mustChangePassword: true,
    });
    return true;
  }

  if (user.forcePasswordReset) {
    console.log(\`[AUTH] First login detected for user \${user.xID}, generating password reset token\`);

    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + PASSWORD_SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = \`\${frontendUrl}/reset-password?token=\${token}\`;
    console.log('PASSWORD RESET LINK:', resetUrl);

    if (!process.env.FRONTEND_URL) {
      console.warn('[AUTH] FRONTEND_URL not configured. Using default http://localhost:3000.');
    }

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = tokenExpiry;

    try {
      await user.save();
    } catch (saveError) {
      console.error('[AUTH] Failed to save password reset token:', saveError.message);
    }

    let emailSent = false;
    try {
      const emailResult = await emailService.sendPasswordResetEmail(user.email, user.name, token);
      emailSent = emailResult.success;
      if (emailSent) {
        console.log(\`[AUTH] Password reset email sent successfully\`);
      } else {
        console.error(\`[AUTH] Password reset email failed:\`, emailResult.error);
      }
    } catch (emailError) {
      console.error('[AUTH] Failed to send password reset email:', emailError.message);
    }

    try {
      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        userId: user._id,
        actionType: 'PasswordResetEmailSent',
        description: emailSent
          ? 'Password reset email sent on first login'
          : 'Password reset email failed to send on first login',
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);
    } catch (auditError) {
      console.error('[AUTH AUDIT] Failed to record password reset email event', auditError);
    }
  }
  return false;
};

/**
 * Login with xID and password
 * POST /superadmin/login or POST /:firmSlug/login
 */
const login = async (req, res) => {
  try {
    const loginScope = req.loginScope || 'tenant';
    const requestedFirmSlug = req.params?.firmSlug || req.firmSlug || null;
    const { xid, xID, XID, password } = req.body;

    const normalizedXID = (xid || xID || XID)?.trim().toUpperCase();

    if (!normalizedXID || !password) {
      console.warn('[AUTH] Missing credentials in login attempt', {
        hasXID: !!(xid || xID || XID),
        hasPassword: !!password,
        ip: req.ip,
      });

      return res.status(400).json({
        success: false,
        message: 'xID and password are required',
      });
    }

    const { normalizedXID: superadminXID } = getSuperadminEnv();

    if (superadminXID && normalizedXID === superadminXID) {
      return await handleSuperadminLogin(req, res, normalizedXID, password, loginScope);
    }

    if (loginScope === 'superadmin') {
      return res.status(401).json({ success: false, message: 'Invalid xID or password' });
    }

    if (!req.firmId) {
      return res.status(400).json({
        success: false,
        message: 'Firm context is required for login.',
      });
    }

    console.log('[AUTH][tenant] login attempt', { firmSlug: requestedFirmSlug, xID: normalizedXID });
    const user = await User.findOne({
      firmId: req.firmId,
      xID: normalizedXID,
      status: { $ne: 'deleted' },
    });

    if (await validateTenantUserPreconditions(req, res, user, requestedFirmSlug, normalizedXID)) {
      return;
    }

    if (!(await handlePasswordVerification(req, res, user, password))) {
      return;
    }

    if (await handlePostPasswordChecks(req, res, user)) {
      return;
    }

    try {
      const loginToken = await sendLoginOtpChallenge(req, user);
      const otpConfig = getLoginOtpConfig();
      return res.json({
        success: true,
        otpRequired: true,
        loginToken,
        otpDeliveryHint: user.email ? \`Code sent to \${user.email.replace(/(.{2}).+(@.+)/, '$1***$2')}\` : 'Code sent to your registered email',
        resendCooldownSeconds: otpConfig.resendCooldownSeconds,
      });
    } catch (otpError) {
      if (otpError?.code === 'LOGIN_OTP_COOLDOWN_ACTIVE') {
        return res.status(429).json({
          success: false,
          message: 'OTP recently sent. Please wait before requesting a new code.',
          retryAfter: otpError.retryAfter || LOGIN_OTP_COOLDOWN_SECONDS,
        });
      }
      console.error('[AUTH] Failed to send login OTP email:', otpError.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to send login verification code. Please try again.',
      });
    }
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({
      success: false,
      code: 'AUTH_LOGIN_FAILED',
      message: 'Error during login',
    });
  }
};
`;

fs.writeFileSync(file, beforeLogin + newLoginLogic + '\n' + afterLogin);
console.log('File successfully refactored.');
