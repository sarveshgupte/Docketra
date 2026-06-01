const { z, objectIdString, caseIdString, paginationQuery } = require('./common');

module.exports = {
  'GET /status-view': {
    query: paginationQuery.extend({
      clientId: objectIdString.optional(),
      status: z.enum(['requested_from_client', 'under_preparation', 'awaiting_approval', 'filed', 'portal_issue', 'closed']).optional(),
    }).passthrough(),
  },
  'GET /status-view/:caseId': {
    params: z.object({ caseId: caseIdString }),
  },
};
