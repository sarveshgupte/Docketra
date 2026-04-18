const { z, nonEmptyString } = require('./common');

const passthrough = z.object({}).passthrough();

module.exports = {
  'GET /users': { query: passthrough },
  'GET /dockets': { query: passthrough },
  'GET /qc': { query: passthrough },
  'GET /time/users': { query: passthrough },
  'GET /clients': { query: passthrough },
  'GET /time/dockets': { query: passthrough },
  'GET /case-metrics': { query: passthrough },
  'GET /pending-cases': { query: passthrough },
  'GET /sla-weekly-summary': { query: passthrough },
  'GET /cases-by-date': { query: passthrough },
  'GET /export/csv': { query: passthrough },
  'GET /export/excel': { query: passthrough },
  'GET /export-history': { query: passthrough },
  'GET /audit-logs': { query: passthrough },
  'GET /client-fact-sheet/:clientId/pdf': {
    params: z.object({ clientId: nonEmptyString }),
    query: passthrough,
  },
};
