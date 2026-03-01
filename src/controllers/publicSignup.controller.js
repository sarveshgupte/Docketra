const { google } = require('googleapis');
const signupService = require('../services/signup.service');

/**
 * POST /public/initiate-signup
 * Start manual signup flow with OTP verification
 */
const initiateSignup = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const result = await signupService.initiateManualSignup({ name, email, password, phone });

    if (!result.success) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message, email });
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] initiateSignup error:', error.message);
    return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
};

/**
 * POST /public/verify-otp
 * Verify OTP for manual signup
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!otp || !otp.trim()) {
      return res.status(400).json({ success: false, message: 'OTP is required' });
    }

    const result = await signupService.verifySignupOtp({ email, otp: otp.trim() });

    if (!result.success) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] verifyOtp error:', error.message);
    return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
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

    const result = await signupService.resendSignupOtp({ email });

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
 * POST /public/google-auth
 * Google OAuth signup — verify ID token and create temporary signup
 */
const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ success: false, message: 'Google OAuth is not configured' });
    }

    const oauthClient = new google.auth.OAuth2(clientId);
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.trim().toLowerCase();
    const name = payload?.name || '';
    const emailVerified = payload?.email_verified !== false;

    if (!email || !emailVerified) {
      return res.status(403).json({ success: false, message: 'Google account email is not verified' });
    }

    const result = await signupService.googleSignup({ name, email });

    if (!result.success) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] googleAuth error:', error.message);
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
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!firmName || !firmName.trim()) {
      return res.status(400).json({ success: false, message: 'Firm name is required' });
    }

    const result = await signupService.completeSignup({ email, firmName });

    if (!result.success) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }

    return res.status(201).json({
      success: true,
      message: result.message,
      xid: result.xid,
      firmUrl: result.firmUrl,
    });
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] completeSignup error:', error.message);
    return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
};

module.exports = {
  initiateSignup,
  verifyOtp,
  resendOtp,
  googleAuth,
  completeSignup,
};
