const log = require('../utils/log');
const { hashIdentifier } = require('../utils/hashIdentifier');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('./securityAudit.service');

const createAuthSignupService = (deps) => {
  const {
    signupService,
    getSession,
    mongoose,
    User,
  } = deps;

  const buildSignupAuditMetadata = (req, email, firmName) => ({
    requestId: req?.requestId || null,
    emailHash: email ? hashIdentifier(String(email).trim().toLowerCase()) : null,
    workspaceHash: firmName ? hashIdentifier(String(firmName).trim().toLowerCase()) : null,
  });

  const signupInit = async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const firmName = String(req.body?.firmName || '').trim();
      const phone = String(req.body?.phone || '').trim();

      if (!name || !email || !password || !firmName || !phone) {
        return res.status(400).json({ success: false, message: 'name, email, password, firmName and phone are required' });
      }

      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.SIGNUP_INIT_ATTEMPT,
        resource: 'auth/signup/init',
        metadata: buildSignupAuditMetadata(req, email, firmName),
        description: 'Signup init attempted',
      });

      const result = await signupService.initiateSignup({
        name,
        email,
        password,
        firmName,
        phone,
        session: getSession(req),
        req,
      });

      if (!result.success) {
        return res.status(result.status || 400).json({ success: false, message: result.message });
      }

      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.SIGNUP_OTP_SENT,
        resource: 'auth/signup/init',
        metadata: buildSignupAuditMetadata(req, email, firmName),
        description: 'Signup OTP sent',
      });

      return res.status(201).json({
        success: true,
        message: result.message,
        data: { email },
      });
    } catch (error) {
      log.error('[AUTH][signupInit] Unable to start signup', error);
      return res.status(500).json({ success: false, message: 'Unable to start signup right now.' });
    }
  };

  const signupVerify = async (req, res) => {
    const session = await mongoose.startSession();
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const otp = String(req.body?.otp || '').trim();

      if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'email and otp are required' });
      }

      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.SIGNUP_OTP_VERIFY_ATTEMPT,
        resource: 'auth/signup/verify',
        metadata: buildSignupAuditMetadata(req, email, null),
        description: 'Signup OTP verification attempted',
      });

      let result = null;
      await session.withTransaction(async () => {
        const existingUser = await User.findOne({ email, status: { $ne: 'deleted' } }).session(session);
        if (existingUser) {
          result = { success: false, status: 409, message: 'Account already exists' };
          return;
        }

        result = await signupService.verifyOtp({
          email,
          otp,
          session,
          req,
        });
      });

      if (!result?.success) {
        await logSecurityAuditEvent({
          req,
          action: SECURITY_AUDIT_ACTIONS.SIGNUP_OTP_VERIFY_FAILED,
          resource: 'auth/signup/verify',
          metadata: buildSignupAuditMetadata(req, email, null),
          description: 'Signup OTP verification failed',
        });
        return res.status(result?.status || 400).json({ success: false, message: result?.message || 'Unable to verify signup OTP.' });
      }

      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.SIGNUP_OTP_VERIFIED,
        resource: 'auth/signup/verify',
        metadata: buildSignupAuditMetadata(req, email, result?.firmSlug || null),
        description: 'Signup OTP verified',
      });

      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.SIGNUP_COMPLETED,
        resource: 'auth/signup/verify',
        metadata: buildSignupAuditMetadata(req, email, result?.firmSlug || null),
        description: 'Signup completed',
      });

      return res.status(201).json({
        success: true,
        message: result.message,
        data: {
          xid: result.xid,
          firmSlug: result.firmSlug,
          firmUrl: result.firmUrl,
          redirectPath: result.redirectPath,
        },
      });
    } catch (error) {
      log.error('[AUTH][signupVerify] Unable to verify signup OTP', error);
      return res.status(500).json({ success: false, message: 'Unable to verify signup OTP right now.' });
    } finally {
      await session.endSession();
    }
  };

  const signupResend = async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ success: false, message: 'email is required' });
      }

      const result = await signupService.resendOtp({ email, req });
      return res.status(result.success ? 200 : (result.status || 400)).json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      log.error('[AUTH][signupResend] Unable to resend signup OTP', error);
      return res.status(500).json({ success: false, message: 'Unable to resend OTP right now.' });
    }
  };

  return {
    signupInit,
    signupVerify,
    signupResend,
  };
};

module.exports = createAuthSignupService;
