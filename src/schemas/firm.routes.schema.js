const { z, nonEmptyString, xidString } = require('./common');

const tenantRouteParamsSchema = z.object({
  firmSlug: nonEmptyString,
}).strict();

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

const verifyOtpBodySchema = z.object({
  loginToken: nonEmptyString,
  otp: z.string().trim().regex(/^\d{6}$/),
}).strip();

const resendOtpBodySchema = z.object({
  loginToken: nonEmptyString,
}).strip();

module.exports = {
  'GET /login': {
    params: tenantRouteParamsSchema,
  },
  'POST /login': {
    params: tenantRouteParamsSchema,
    body: loginBodySchema,
  },
  'POST /verify-otp': {
    params: tenantRouteParamsSchema,
    body: verifyOtpBodySchema,
  },
  'POST /resend-otp': {
    params: tenantRouteParamsSchema,
    body: resendOtpBodySchema,
  },
};
