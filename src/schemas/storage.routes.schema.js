const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /status': {
    query: z.object({}).passthrough(),
  },
  'GET /health': {
    query: z.object({}).passthrough(),
  },
  'GET /google/connect': {
    query: z.object({}).passthrough(),
  },
  'GET /google/callback': {
    query: z.object({
      code: nonEmptyString.optional(),
      state: z.string().trim().optional(),
      error: z.string().trim().optional(),
    }).passthrough(),
  },
  'POST /google/confirm-drive': {
    body: z.object({
      driveId: z.string().trim().optional(),
    }).passthrough(),
  },
  'GET /configuration': {
    query: z.object({}).passthrough(),
  },
  'POST /test-connection': {
    body: z.object({}).passthrough(),
  },
  'GET /health-check': {
    query: z.object({}).passthrough(),
  },
  'GET /usage': {
    query: z.object({}).passthrough(),
  },
  'POST /disconnect': {
    body: z.object({}).passthrough(),
  },
  'GET /export': {
    query: z.object({}).passthrough(),
  },
  'GET /exports': {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
  'GET /export/download/:token': {
    params: z.object({ token: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
};
