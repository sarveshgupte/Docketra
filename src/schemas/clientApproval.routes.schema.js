const { z, caseIdString, clientIdString, paginationQuery } = require('./common');

module.exports = {
  'GET /clients': {
    query: paginationQuery,
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

