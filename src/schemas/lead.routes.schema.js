const { z, nonEmptyString, objectIdString, paginationQuery } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email().optional(),
      phone: z.string().trim().optional(),
      source: z.string().trim().optional(),
      ownerXid: z.string().trim().optional(),
      nextFollowUpAt: z.string().datetime({ offset: true }).optional(),
      lastContactAt: z.string().datetime({ offset: true }).optional(),
    }).passthrough(),
  },
  'GET /': {
    query: paginationQuery.and(z.object({
      status: z.string().trim().optional(),
      stage: z.string().trim().optional(),
      ownerXid: z.string().trim().optional(),
      dueOnly: z.coerce.boolean().optional(),
    })),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      status: z.enum(['new', 'contacted', 'qualified', 'lost', 'converted']).optional(),
      stage: z.enum(['new', 'contacted', 'qualified', 'lost', 'converted']).optional(),
      ownerXid: z.string().trim().nullable().optional(),
      nextFollowUpAt: z.string().datetime({ offset: true }).nullable().optional(),
      lastContactAt: z.string().datetime({ offset: true }).nullable().optional(),
      note: z.string().trim().min(1).max(4000).optional(),
      lostReason: z.string().trim().max(500).nullable().optional(),
    }).passthrough(),
  },
  'PATCH /:id/status': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      status: z.enum(['new', 'contacted', 'qualified', 'lost', 'converted']).optional(),
      stage: z.enum(['new', 'contacted', 'qualified', 'lost', 'converted']).optional(),
      ownerXid: z.string().trim().nullable().optional(),
      nextFollowUpAt: z.string().datetime({ offset: true }).nullable().optional(),
      lastContactAt: z.string().datetime({ offset: true }).nullable().optional(),
      note: z.string().trim().min(1).max(4000).optional(),
      lostReason: z.string().trim().max(500).nullable().optional(),
    }).passthrough(),
  },
  'POST /:id/convert': {
    params: z.object({ id: objectIdString }),
    body: z.object({}).passthrough(),
  },
};
