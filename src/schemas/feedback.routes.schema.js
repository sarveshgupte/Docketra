const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      type: z.enum(['BUG', 'FEEDBACK', 'ERROR', 'OTHER']).optional(),
      message: nonEmptyString.min(5).max(5000),
      pageUrl: z.string().trim().max(1000).optional().nullable(),
      screenshot: z.string().max(8 * 1024 * 1024).optional().nullable(),
    }).strip(),
  },
};
