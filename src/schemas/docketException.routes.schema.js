const { z, nonEmptyString, objectIdString, xidString } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      caseInternalId: objectIdString,
      exceptionType: z.enum([
        'portal_issue',
        'query_raised',
        'DSC_authorisation_pending',
        'client_delay',
        'payment_pending',
        'data_mismatch',
        'other',
      ]),
      description: nonEmptyString,
      occurredAt: z.string().trim().optional(),
      owner: z.string().trim().optional(),
      status: z.enum(['open', 'monitoring', 'resolved', 'closed_no_action']).optional(),
      evidenceAttachmentId: objectIdString.optional().nullable(),
      ticketNumber: z.string().trim().optional().nullable(),
      revisedEta: z.string().trim().optional().nullable(),
    }).passthrough(),
  },
  'GET /': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      caseInternalId: objectIdString.optional(),
      exceptionType: z.string().trim().optional(),
      status: z.string().trim().optional(),
    }).passthrough(),
  },
  'GET /dashboard': {
    query: z.object({}).passthrough(),
  },
  'PATCH /:id': {
    params: z.object({
      id: objectIdString,
    }),
    body: z.object({
      description: z.string().trim().optional(),
      owner: z.string().trim().optional(),
      status: z.enum(['open', 'monitoring', 'resolved', 'closed_no_action']).optional(),
      evidenceAttachmentId: objectIdString.optional().nullable(),
      ticketNumber: z.string().trim().optional().nullable(),
      revisedEta: z.string().trim().optional().nullable(),
    }).passthrough(),
  },
};
