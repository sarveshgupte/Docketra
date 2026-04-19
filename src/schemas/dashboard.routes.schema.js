const { z } = require('./common');

module.exports = {
  'GET /summary': {
    query: z.object({}).passthrough(),
  },
  'GET /onboarding-progress': {
    query: z.object({}).passthrough(),
  },
};
