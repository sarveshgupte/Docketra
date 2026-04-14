const { z } = require('./common');

module.exports = {
  'GET /liveness': {
    query: z.object({}).passthrough(),
  },
  'GET /readiness': {
    query: z.object({}).passthrough(),
  },
  'GET /': {
    query: z.object({}).passthrough(),
  },
};

