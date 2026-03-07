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
  'POST /resend-setup': {
    body: z.object({ email: z.string().trim().email() }).strip(),
  },
  'POST /resend-credentials': {
    body: z.object({
      email: z.string().trim().email(),
    }).passthrough(),
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
