const { z, nonEmptyString, xidString } = require('./common');

const loginBodySchema = z.object({
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
);

module.exports = {
  'POST /login': {
    body: loginBodySchema,
  },
  'POST /verify-otp': {
    body: z.object({
      loginToken: nonEmptyString,
      otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be a 6 digit code'),
    }).strip(),
  },
};
