const log = require('../utils/log');
const createAuthPasswordService = (deps) => {
  const {
    normalizeFirmSlug,
    Firm,
    User,
    emailService,
    isActiveStatus,
    FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES,
    logAuthAudit,
    FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS,
    FORGOT_PASSWORD_OTP_EXPIRY_MINUTES,
    FORGOT_PASSWORD_OTP_LOCK_MINUTES,
    authOtpService,
    SALT_ROUNDS,
    DEFAULT_XID,
    DEFAULT_FIRM_ID,
    clearForgotPasswordOtpState,
    generateLoginSessionToken,
    hashLoginSessionToken,
    validatePasswordStrength,
    PASSWORD_POLICY_MESSAGE,
    bcrypt,
  } = deps;

  const forgotPassword = async (req, res) => {
    try {
      const { email, firmSlug } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required',
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedFirmSlug = normalizeFirmSlug(firmSlug);
      let resolvedFirmId = req.firmId || null;

      if (!resolvedFirmId && normalizedFirmSlug) {
        const firm = await Firm.findOne({ firmSlug: normalizedFirmSlug }).select('_id firmSlug').lean();
        if (!firm) {
          return res.status(404).json({
            success: false,
            error: 'Firm not found. Please check your firm login URL.',
            message: 'Firm not found. Please check your firm login URL.',
          });
        }
        resolvedFirmId = String(firm._id);
        req.firmId = resolvedFirmId;
        req.firmSlug = firm.firmSlug;
      }

      let user;
      if (resolvedFirmId) {
        user = await User.findOne({
          firmId: resolvedFirmId,
          email: normalizedEmail,
          status: { $ne: 'deleted' },
        });
      } else {
        const candidateUsers = await User.find({
          email: normalizedEmail,
          status: { $ne: 'deleted' },
        })
          .limit(2);
        if (candidateUsers.length > 1) {
          log.warn(`[AUTH] Forgot password email is ambiguous across firms: ${emailService.maskEmail(normalizedEmail)}`);
          return res.json({
            success: true,
            message: 'If an account exists with this email, you will receive a password reset link.',
          });
        }
        user = candidateUsers.length === 1 ? candidateUsers[0] : null;
      }

      if (!user) {
        const emailParts = email.split('@');
        const maskedEmail = emailParts[0].substring(0, 2) + '***@' + (emailParts[1] || '');
        log.info(`[AUTH] Forgot password requested for non-existent email: ${maskedEmail}`);

        return res.json({
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link.',
        });
      }

      if (!isActiveStatus(user.status)) {
        log.info(`[AUTH] Forgot password requested for inactive user (xID: ${user.xID})`);

        return res.json({
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link.',
        });
      }

      const token = emailService.generateSecureToken();
      const tokenHash = emailService.hashToken(token);
      const tokenExpiry = new Date(Date.now() + FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES * 60 * 1000);

      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpires = tokenExpiry;
      await user.save();

      try {
        const emailResult = await emailService.sendForgotPasswordEmail(user.email, user.name, token);

        await logAuthAudit({
          xID: user.xID,
          firmId: user.firmId,
          userId: user._id,
          actionType: 'ForgotPasswordRequested',
          description: emailResult.success
            ? `Password reset link sent to ${emailService.maskEmail(user.email)}`
            : `Password reset link failed to send to ${emailService.maskEmail(user.email)}: ${emailResult.error}`,
          performedBy: user.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (emailError) {
        log.error('[AUTH] Failed to send forgot password email:', emailError.message);
      }

      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    } catch (error) {
      log.error('[AUTH] Error in forgot password:', error);
      return res.status(500).json({
        success: false,
        message: 'Error processing password reset request',
      });
    }
  };

  const forgotPasswordInit = async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }
    const firm = req.firm;
    const now = Date.now();

    const user = await User.findOne({ firmId: firm._id, email, status: 'active', isActive: true });
    const genericResponse = { success: true, message: 'If the account exists, an OTP has been sent to email.' };
    if (!user) return res.json(genericResponse);

    const lastSentAtMs = user.forgotPasswordOtpLastSentAt ? new Date(user.forgotPasswordOtpLastSentAt).getTime() : 0;
    const resendCooldownEndsAt = lastSentAtMs + (FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS * 1000);
    if (now < resendCooldownEndsAt) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts',
        retryAfter: Math.ceil((resendCooldownEndsAt - now) / 1000),
      });
    }

    const otp = authOtpService.generateOtp();
    user.forgotPasswordOtpHash = await authOtpService.hashOtp(otp, SALT_ROUNDS);
    user.forgotPasswordOtpExpiresAt = new Date(Date.now() + FORGOT_PASSWORD_OTP_EXPIRY_MINUTES * 60 * 1000);
    user.forgotPasswordOtpAttempts = 0;
    user.forgotPasswordOtpLastSentAt = new Date();
    user.forgotPasswordOtpLockedUntil = null;
    user.forgotPasswordOtpResendCount = Number(user.forgotPasswordOtpResendCount || 0) + 1;
    user.forgotPasswordResetTokenHash = null;
    user.forgotPasswordResetTokenExpiresAt = null;
    await user.save();

    await emailService.sendLoginOtpEmail({
      email: user.email,
      name: user.name,
      otp,
      firmName: firm.name,
      firmSlug: firm.firmSlug,
      expiryMinutes: FORGOT_PASSWORD_OTP_EXPIRY_MINUTES,
    });
    await logAuthAudit({
      xID: user.xID || DEFAULT_XID,
      firmId: user.firmId || DEFAULT_FIRM_ID,
      userId: user._id,
      actionType: 'FORGOT_PASSWORD_OTP_SENT',
      description: 'Forgot-password OTP issued',
      performedBy: user.xID || DEFAULT_XID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        eventType: 'FORGOT_PASSWORD_OTP_SENT',
        firmSlug: req.firmSlug || null,
      },
    }, req);

    return res.json({
      ...genericResponse,
      resendCooldownSeconds: FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS,
    });
  };

  const forgotPasswordVerify = async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'email and valid OTP are required' });
    }
    const firm = req.firm;

    const user = await User.findOne({ firmId: firm._id, email, status: 'active', isActive: true });
    if (!user || !user.forgotPasswordOtpHash || !user.forgotPasswordOtpExpiresAt || user.forgotPasswordOtpExpiresAt.getTime() < Date.now()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const activeLockSeconds = user.forgotPasswordOtpLockedUntil
      ? Math.max(0, Math.ceil((new Date(user.forgotPasswordOtpLockedUntil).getTime() - Date.now()) / 1000))
      : 0;
    if (activeLockSeconds > 0) {
      return res.status(429).json({ success: false, message: 'Too many attempts', retryAfter: activeLockSeconds });
    }

    const attempts = Number(user.forgotPasswordOtpAttempts || 0);
    if (attempts >= 5) {
      user.forgotPasswordOtpLockedUntil = new Date(Date.now() + (FORGOT_PASSWORD_OTP_LOCK_MINUTES * 60 * 1000));
      await user.save();
      return res.status(429).json({ success: false, message: 'Too many attempts' });
    }

    const ok = await authOtpService.verifyOtp(otp, user.forgotPasswordOtpHash);
    if (!ok) {
      const attemptState = authOtpService.incrementAttempts(attempts, 5);
      user.forgotPasswordOtpAttempts = attemptState.attempts;
      if (attemptState.exhausted) {
        user.forgotPasswordOtpLockedUntil = new Date(Date.now() + (FORGOT_PASSWORD_OTP_LOCK_MINUTES * 60 * 1000));
      }
      await user.save();
      await logAuthAudit({
        xID: user.xID || DEFAULT_XID,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        userId: user._id,
        actionType: 'FORGOT_PASSWORD_OTP_FAILED',
        description: 'Forgot-password OTP verification failed',
        performedBy: user.xID || DEFAULT_XID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          eventType: 'FORGOT_PASSWORD_OTP_FAILED',
          attempts: user.forgotPasswordOtpAttempts,
        },
      }, req);
      return res.status(attemptState.exhausted ? 429 : 401).json({
        success: false,
        message: attemptState.exhausted ? 'Too many attempts' : 'Invalid or expired OTP',
      });
    }

    clearForgotPasswordOtpState(user);
    const resetToken = generateLoginSessionToken();
    user.forgotPasswordResetTokenHash = hashLoginSessionToken(resetToken);
    user.forgotPasswordResetTokenExpiresAt = new Date(Date.now() + FORGOT_PASSWORD_OTP_EXPIRY_MINUTES * 60 * 1000);
    await user.save();
    await logAuthAudit({
      xID: user.xID || DEFAULT_XID,
      firmId: user.firmId || DEFAULT_FIRM_ID,
      userId: user._id,
      actionType: 'FORGOT_PASSWORD_OTP_VERIFIED',
      description: 'Forgot-password OTP verified',
      performedBy: user.xID || DEFAULT_XID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        eventType: 'FORGOT_PASSWORD_OTP_VERIFIED',
      },
    }, req);
    return res.json({ success: true, message: 'OTP verified', resetToken });
  };

  const forgotPasswordResetWithOtp = async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const resetToken = String(req.body?.resetToken || '').trim();
    const password = String(req.body?.password || '');

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_POLICY_MESSAGE });
    }

    const firm = req.firm;

    const user = await User.findOne({ firmId: firm._id, email, status: 'active', isActive: true });
    if (!user || !user.forgotPasswordResetTokenHash || !user.forgotPasswordResetTokenExpiresAt || user.forgotPasswordResetTokenExpiresAt.getTime() < Date.now()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset session' });
    }
    if (!resetToken || hashLoginSessionToken(resetToken) !== user.forgotPasswordResetTokenHash) {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset session' });
    }

    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.passwordSet = true;
    user.passwordSetAt = new Date();
    user.forcePasswordReset = false;
    user.forgotPasswordResetTokenHash = null;
    user.forgotPasswordResetTokenExpiresAt = null;
    await user.save();
    await logAuthAudit({
      xID: user.xID || DEFAULT_XID,
      firmId: user.firmId || DEFAULT_FIRM_ID,
      userId: user._id,
      actionType: 'FORGOT_PASSWORD_RESET_SUCCESS',
      description: 'Password reset completed via OTP flow',
      performedBy: user.xID || DEFAULT_XID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }, req);

    return res.json({ success: true, message: 'Password reset successful' });
  };

  return {
    forgotPassword,
    forgotPasswordInit,
    forgotPasswordVerify,
    forgotPasswordResetWithOtp,
  };
};

module.exports = createAuthPasswordService;
