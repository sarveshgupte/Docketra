const { z, nonEmptyString, objectIdString, paginationQuery } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      sender: z.object({
        email: z.string().trim().email(),
        name: z.string().trim().optional(),
      }),
      recipients: z.array(z.string().trim().email()).optional(),
      subject: nonEmptyString,
      receivedAt: z.string().trim().datetime({ precision: true }).or(z.string().trim().datetime()).optional(),
      bodyExcerpt: z.string().trim().optional(),
      attachments: z.array(
        z.object({
          filename: nonEmptyString,
          contentType: z.string().trim().optional(),
          sizeBytes: z.number().int().nonnegative().optional(),
          storageUrl: z.string().trim().url().optional(),
        })
      ).optional(),
      linkedClientId: objectIdString.optional().nullable(),
      linkedCaseInternalId: objectIdString.optional().nullable(),
      classification: z.enum(['actionable', 'awaiting_reply', 'reference_only']).optional(),
      followUpDueDate: z.string().trim().datetime().optional().nullable(),
      ownerXID: z.string().trim().toUpperCase().optional().nullable(),
    }).passthrough(),
  },
  'GET /': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      classification: z.enum(['actionable', 'awaiting_reply', 'reference_only']).optional(),
      ownerXID: z.string().trim().toUpperCase().optional(),
      ageing: z.enum(['true', 'false']).optional(),
    }).passthrough(),
  },
  'GET /:id': {
    params: z.object({ id: objectIdString }),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      classification: z.enum(['actionable', 'awaiting_reply', 'reference_only']).optional(),
      followUpDueDate: z.string().trim().datetime().optional().nullable(),
      ownerXID: z.string().trim().toUpperCase().optional().nullable(),
      linkedClientId: objectIdString.optional().nullable(),
      linkedCaseInternalId: objectIdString.optional().nullable(),
    }).passthrough(),
  },
  'POST /:id/link': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      caseInternalId: objectIdString,
    }).passthrough(),
  },
  'POST /:id/create-docket': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      title: z.string().trim().optional(),
      categoryId: objectIdString,
      subcategoryId: nonEmptyString,
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    }).passthrough(),
  },
};
