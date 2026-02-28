const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /login': {
    body: z.object({
      email: z.string().trim().email().optional(),
      xID: nonEmptyString.optional(),
      password: nonEmptyString.optional(),
    }).passthrough(),
  },
  'POST /setup-password': {
    body: z.object({}).passthrough(),
  },
  'POST /set-password': {
    body: z.object({}).passthrough(),
  },
  'POST /reset-password-with-token': {
    body: z.object({}).passthrough(),
  },
  'POST /forgot-password': {
    body: z.object({}).passthrough(),
  },
  'POST /refresh': {
    body: z.object({}).passthrough(),
  },
  'POST /verify-totp': {
    body: z.object({}).passthrough(),
  },
  'POST /complete-mfa-login': {
    body: z.object({
      token: nonEmptyString,
      preAuthToken: nonEmptyString,
    }).passthrough(),
  },
  'GET /google': {
    query: z.object({}).passthrough(),
  },
  'GET /google/callback': {
    query: z.object({
      state: nonEmptyString,
      code: nonEmptyString,
    }).passthrough(),
  },
  'POST /logout': {
    body: z.object({}).passthrough(),
  },
  'POST /change-password': {
    body: z.object({}).passthrough(),
  },
  'GET /profile': {
    query: z.object({}).passthrough(),
  },
  'PUT /profile': {
    body: z.object({}).passthrough(),
  },
  'POST /reset-password': {
    body: z.object({}).passthrough(),
  },
  'POST /unlock-account': {
    body: z.object({}).passthrough(),
  },
  'GET /admin/users': {
    query: z.object({}).passthrough(),
  },
  'POST /admin/users': {
    body: z.object({}).passthrough(),
  },
  'PUT /admin/users/:xID/activate': {
    params: z.object({ xID: nonEmptyString }),
  },
  'PUT /admin/users/:xID/deactivate': {
    params: z.object({ xID: nonEmptyString }),
  },
};
