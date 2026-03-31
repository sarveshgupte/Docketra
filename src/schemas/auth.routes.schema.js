const { z, nonEmptyString, xidString } = require('./common');
const { validatePasswordStrength, PASSWORD_POLICY_MESSAGE } = require('../utils/passwordPolicy');

const strongPassword = z.string().refine(validatePasswordStrength, PASSWORD_POLICY_MESSAGE);

module.exports = {
  'POST /setup-account': {
    body: z.object({
      token: nonEmptyString,
      password: strongPassword.optional(),
      googleId: nonEmptyString.optional(),
    }).strip(),
  },
  'POST /signup/init': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email(),
      password: strongPassword,
      firmName: nonEmptyString,
      phone: z.string().trim().regex(/^\d{10}$/),
    }).strip(),
  },
  'POST /signup/verify': {
    body: z.object({
      email: z.string().trim().email(),
      otp: z.string().trim().regex(/^\d{6}$/),
    }).strip(),
  },
  'POST /signup/resend': {
    body: z.object({
      email: z.string().trim().email(),
    }).strip(),
  },
  'POST /send-otp': {
    body: z.object({
      email: z.string().trim().email().optional(),
      xid: z.string().trim().toUpperCase().regex(/^DK-[A-Z0-9]{5}$/).optional(),
      purpose: z.enum(['signup', 'login', 'storage_change']).default('login'),
    }).strip().refine((value) => Boolean(value.email || value.xid), {
      message: 'email or xid is required',
      path: ['email'],
    }),
  },
  'POST /verify-otp': {
    body: z.object({
      email: z.string().trim().email(),
      otp: z.string().trim().regex(/^\d{6}$/),
    }).strip(),
  },
  'POST /resend-setup': {
    body: z.object({ email: z.string().trim().email() }).strip(),
  },
  'POST /resend-credentials': {
    body: z.object({
      email: z.string().trim().email(),
    }).passthrough(),
  },
  'POST /resend-otp': {
    body: z.object({
      firmSlug: nonEmptyString,
      loginToken: nonEmptyString,
    }).strip(),
  },
  'POST /reset-password-with-token': {
    body: z.object({
      token: nonEmptyString,
      password: strongPassword,
    }).strip(),
  },
  'POST /forgot-password': {
    body: z.object({
      email: z.string().trim().email(),
      firmSlug: z.string().trim().min(1).optional(),
    }).strip(),
  },
  'POST /forgot-password/init': {
    body: z.object({
      email: z.string().trim().email(),
      firmSlug: nonEmptyString,
    }).strip(),
  },
  'POST /forgot-password/verify': {
    body: z.object({
      email: z.string().trim().email(),
      firmSlug: nonEmptyString,
      otp: z.string().trim().regex(/^\d{6}$/),
    }).strip(),
  },
  'POST /forgot-password/reset': {
    body: z.object({
      email: z.string().trim().email(),
      firmSlug: nonEmptyString,
      resetToken: nonEmptyString,
      password: strongPassword,
    }).strip(),
  },
  'POST /login/init': {
    body: z.object({
      firmSlug: nonEmptyString,
      xid: xidString.optional(),
      xID: xidString.optional(),
      XID: xidString.optional(),
      password: nonEmptyString,
    }).strip().refine(
      (value) => Boolean(value.xid || value.xID || value.XID),
      {
        message: 'xID is required',
        path: ['xid'],
      }
    ),
  },
  'POST /login/verify': {
    body: z.object({
      firmSlug: nonEmptyString,
      otp: z.string().trim().regex(/^\d{6}$/),
      loginToken: nonEmptyString,
    }).strip(),
  },
  'POST /login/resend': {
    body: z.object({
      firmSlug: nonEmptyString,
      loginToken: nonEmptyString,
    }).strip(),
  },
  'POST /refresh': {
    body: z.object({
      refreshToken: nonEmptyString.optional(),
      accessToken: nonEmptyString.optional(),
    }).strip(),
  },
  'POST /verify-totp': {
    body: z.object({
      xID: xidString,
      token: nonEmptyString,
    }).strip(),
  },
  'POST /complete-mfa-login': {
    body: z.object({
      token: nonEmptyString,
      preAuthToken: nonEmptyString,
    }).strip(),
  },
  'POST /logout': {
    body: z.object({}).strip(),
  },
  'POST /change-password': {
    body: z.object({
      currentPassword: nonEmptyString,
      newPassword: strongPassword,
    }).strip(),
  },
  'GET /profile': {
    query: z.object({}).strip(),
  },
  'PUT /profile': {
    body: z.object({
      // Keep both dateOfBirth and dob for backward-compatible profile update payloads.
      // If both are sent, updateProfile applies dateOfBirth first and then dob as the final value.
      dateOfBirth: z.string().optional(),
      dob: z.string().optional(),
      gender: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      panMasked: z.string().optional(),
      pan: z.string().optional(),
      aadhaarMasked: z.string().optional(),
      aadhaar: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      xID: z.string().optional(),
      firmId: z.string().optional(),
    }).strip(),
  },
  'POST /reset-password': {
    body: z.object({ xID: xidString }).strip(),
  },
  'POST /unlock-account': {
    body: z.object({ xID: xidString }).strip(),
  },
  'GET /admin/users': {
    query: z.object({}).strip(),
  },
  'POST /admin/users': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email(),
      role: z.string().optional(),
      allowedCategories: z.array(nonEmptyString).optional(),
    }).strip(),
  },
  'PUT /admin/users/:xID/activate': {
    params: z.object({ xID: xidString }),
  },
  'PUT /admin/users/:xID/deactivate': {
    params: z.object({ xID: xidString }),
  },
};
