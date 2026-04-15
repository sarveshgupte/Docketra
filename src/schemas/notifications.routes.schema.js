const { z, nonEmptyString, paginationQuery } = require('./common');

const channelsSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
}).strip();

module.exports = {
  'GET /': {
    query: paginationQuery.and(z.object({
      unread: z.enum(['true', 'false']).optional(),
    })),
  },
  'GET /all': {
    query: paginationQuery,
  },
  'GET /preferences': {
    query: z.object({}).strip(),
  },
  'PATCH /preferences': {
    body: z.object({
      inAppEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional(),
      defaultChannels: channelsSchema.optional(),
      typeChannels: z.record(z.string().trim().toUpperCase(), channelsSchema).optional(),
    }).strip(),
  },
  'PATCH /:id/read': {
    params: z.object({ id: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'POST /:id/read': {
    params: z.object({ id: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
};
