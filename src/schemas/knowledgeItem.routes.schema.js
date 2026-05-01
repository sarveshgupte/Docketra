const { z, nonEmptyString, objectIdString, paginationQuery } = require('./common');

const KNOWLEDGE_ITEM_TYPES = ['sop', 'checklist', 'template', 'note', 'client_instruction', 'process'];
const KNOWLEDGE_ITEM_STATUSES = ['draft', 'active', 'archived'];

module.exports = {
  'POST /': {
    body: z.object({
      title: nonEmptyString.max(500),
      type: z.enum(KNOWLEDGE_ITEM_TYPES),
      status: z.enum(KNOWLEDGE_ITEM_STATUSES).optional(),
      summary: z.string().trim().max(2000).optional(),
      content: z.string().trim().max(50000).optional(),
      tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
      ownerXid: z.string().trim().optional(),
      linkedClientId: objectIdString.optional(),
      linkedDocketId: z.string().trim().optional(),
      linkedWorkType: z.string().trim().optional(),
      reviewDueAt: z.string().datetime({ offset: true }).optional(),
      lastReviewedAt: z.string().datetime({ offset: true }).optional(),
    }).passthrough(),
  },
  'GET /': {
    query: paginationQuery.and(z.object({
      type: z.enum(KNOWLEDGE_ITEM_TYPES).optional(),
      status: z.enum(KNOWLEDGE_ITEM_STATUSES).optional(),
      tag: z.string().trim().optional(),
      clientId: objectIdString.optional(),
      q: z.string().trim().max(200).optional(),
    })),
  },
  'GET /:id': {
    params: z.object({ id: objectIdString }),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      title: nonEmptyString.max(500).optional(),
      type: z.enum(KNOWLEDGE_ITEM_TYPES).optional(),
      status: z.enum(KNOWLEDGE_ITEM_STATUSES).optional(),
      summary: z.string().trim().max(2000).nullable().optional(),
      content: z.string().trim().max(50000).nullable().optional(),
      tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
      ownerXid: z.string().trim().nullable().optional(),
      linkedClientId: objectIdString.nullable().optional(),
      linkedDocketId: z.string().trim().nullable().optional(),
      linkedWorkType: z.string().trim().nullable().optional(),
      reviewDueAt: z.string().datetime({ offset: true }).nullable().optional(),
      lastReviewedAt: z.string().datetime({ offset: true }).nullable().optional(),
    }).passthrough(),
  },
  'POST /:id/archive': {
    params: z.object({ id: objectIdString }),
    body: z.object({}).passthrough(),
  },
};
