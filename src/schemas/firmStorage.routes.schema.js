const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /storage/change': {
    body: z.object({
      provider: z.enum(['docketra_managed', 'google-drive', 's3']),
      verificationToken: nonEmptyString,
      credentials: z.record(z.string(), z.any()).optional(),
    }).strip(),
  },
};
