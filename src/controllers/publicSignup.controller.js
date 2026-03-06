const signupService = require('../services/signup.service');

/**
 * POST /public/initiate-signup
 * Start manual signup flow with OTP verification
 */
const initiateSignup = async (req, res) => {
  try {
    const { name, email, password, phone, firmName } = req.body;
    const session = req.transactionSession?.session;

    if (!name || !name.trim()) {
      return { success: false, statusCode: 400, message: 'Name is required' };
    }
    if (!email || !email.trim()) {
      return { success: false, statusCode: 400, message: 'Email is required' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return { success: false, statusCode: 400, message: 'Invalid email format' };
    }
    if (!password || password.length < 8) {
      return { success: false, statusCode: 400, message: 'Password must be at least 8 characters' };
    }
    if (!firmName || !firmName.trim()) {
      return { success: false, statusCode: 400, message: 'Firm name is required' };
    }

    const result = await signupService.initiateSignup({
      name,
      email,
      password,
      phone,
      firmName,
      session,
      req,
    });

    if (!result.success) {
      return { success: false, statusCode: result.status || 400, message: result.message };
    }

    return {
      success: true,
      statusCode: 201,
      message: result.message,
      email,
      requiresOtpVerification: true,
    };
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] initiateSignup error:', error.message);
    return { success: false, statusCode: 500, message: 'An error occurred. Please try again.' };
  }
};

/**
 * POST /public/verify-otp
 * Verify OTP for manual signup
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const session = req.transactionSession?.session;

    if (!email || !email.trim()) {
      return { success: false, statusCode: 400, message: 'Email is required' };
    }
    if (!otp || !otp.trim()) {
      return { success: false, statusCode: 400, message: 'OTP is required' };
    }

    const result = await signupService.verifyOtp({ email, otp: otp.trim(), session, req });

    if (!result.success) {
      return { success: false, statusCode: result.status || 400, message: result.message };
    }

    return {
      success: true,
      statusCode: 200,
      message: result.message,
      token: result.token,
      xid: result.xid,
      firmSlug: result.firmSlug,
      firmUrl: result.firmUrl,
      redirectPath: result.redirectPath,
    };
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] verifyOtp error:', error.message);
    const verificationError = new Error('Verification failed');
    verificationError.statusCode = error.statusCode || 500;
    throw verificationError;
  }
};

/**
 * POST /public/resend-otp
 * Resend OTP for manual signup
 */
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const result = await signupService.resendOtp({ email, req });

    if (!result.success) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] resendOtp error:', error.message);
    return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
};

/**
 * POST /public/complete-signup
 * Complete signup — create firm + admin user in a transaction
 */
const completeSignup = async (req, res) => {
  try {
    const { email, firmName } = req.body;

    if (!email || !email.trim()) {
      return { success: false, statusCode: 400, message: 'Email is required' };
    }
    const result = await signupService.completeSignup({ email, firmName, session: req.transactionSession?.session, req });

    if (!result.success) {
      return { success: false, statusCode: result.status || 400, message: result.message };
    }

    return {
      success: true,
      statusCode: 201,
      message: result.message,
      xid: result.xid,
      firmUrl: result.firmUrl,
      firmSlug: result.firmSlug,
      redirectPath: result.redirectPath,
    };
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] completeSignup error:', error.message);
    return { success: false, statusCode: 500, message: 'An error occurred. Please try again.' };
  }
};

module.exports = {
  initiateSignup,
  verifyOtp,
  resendOtp,
  completeSignup,
};
