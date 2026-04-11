const { z } = require('./common');

module.exports = {
  'GET /email-test': {
    query: z.object({
      email: z.string().trim().email().optional(),
    }).strip(),
  },
};
