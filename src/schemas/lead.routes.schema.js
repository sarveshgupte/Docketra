const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email().optional(),
      phone: z.string().trim().optional(),
      source: z.string().trim().optional(),
    }).passthrough(),
  },
  'GET /': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      status: z.string().trim().optional(),
    }).passthrough(),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      status: z.enum(['new', 'contacted', 'qualified', 'lost', 'converted']).optional(),
    }).passthrough(),
  },
  'POST /:id/convert': {
    params: z.object({ id: objectIdString }),
    body: z.object({}).passthrough(),
  },
};
