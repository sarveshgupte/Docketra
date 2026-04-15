const { z, nonEmptyString } = require('./common');
const { validatePasswordStrength, PASSWORD_POLICY_MESSAGE } = require('../utils/passwordPolicy');

const emailString = z.string().trim().email();
const phoneString = z.string().trim().regex(/^[0-9]{10}$/, 'Phone number must be 10 digits');
const passwordString = z.string().trim().refine(validatePasswordStrength, PASSWORD_POLICY_MESSAGE);

module.exports = {
  'POST /initiate-signup': {
    body: z.object({
      name: nonEmptyString.optional(),
      email: emailString,
      phone: phoneString,
      password: passwordString,
      firmName: nonEmptyString,
      storageType: z.enum(['docketra', 'external']).optional(),
    }).strip(),
  },
  'POST /verify-otp': {
    body: z.object({
      email: emailString,
      otp: nonEmptyString,
    }).strip(),
  },
  'POST /resend-otp': {
    body: z.object({
      email: emailString,
    }).strip(),
  },
  'POST /complete-signup': {
    body: z.object({
      email: emailString,
      otp: nonEmptyString.optional(),
      firmName: nonEmptyString.optional(),
      password: passwordString.optional(),
    }).strip(),
  },
};
