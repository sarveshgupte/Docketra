const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email(),
      company: z.string().trim().optional(),
      message: z.string().trim().min(1).max(2000),
    }).passthrough(),
  },
};
