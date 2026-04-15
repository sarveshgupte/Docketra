const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'POST /bulk/preview': {
    body: z.object({}).passthrough(),
  },
  'POST /bulk/upload': {
    body: z.object({}).passthrough(),
  },
  'GET /': {
    query: z.object({
      status: z.union([z.string(), z.array(z.string())]).optional(),
      category: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
  'GET /ai-suggestions/:attachmentId': {
    params: z.object({ attachmentId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
  'POST /create': {
    body: z.object({
      description: nonEmptyString,
      categoryId: objectIdString,
      subcategoryId: nonEmptyString,
    }).passthrough(),
  },
  'POST /from-attachment/:attachmentId': {
    params: z.object({ attachmentId: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'GET /:docketId/ai-routing': {
    params: z.object({ docketId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
  'POST /:docketId/apply-ai-routing': {
    params: z.object({ docketId: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'POST /:docketId/reject-ai-routing': {
    params: z.object({ docketId: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'GET /:id/timeline': {
    params: z.object({ id: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
};
