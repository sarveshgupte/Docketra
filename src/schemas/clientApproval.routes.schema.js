const { z, nonEmptyString, caseIdString, clientIdString } = require('./common');

module.exports = {
  'GET /clients': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
  'GET /clients/:clientId': {
    params: z.object({ clientId: clientIdString }),
    query: z.object({}).passthrough(),
  },
  'POST /:caseId/approve-new': {
    params: z.object({ caseId: caseIdString }),
    body: z.object({}).passthrough(),
  },
  'POST /:caseId/approve-edit': {
    params: z.object({ caseId: caseIdString }),
    body: z.object({}).passthrough(),
  },
  'POST /:caseId/reject': {
    params: z.object({ caseId: caseIdString }),
    body: z.object({
      reason: z.string().trim().optional(),
    }).passthrough(),
  },
};

