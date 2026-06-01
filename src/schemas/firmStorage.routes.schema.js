const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /setup-status': {
    query: z.object({}).passthrough(),
  },
  'POST /storage/change': {
    body: z.object({
      provider: z.enum(['docketra_managed', 'google-drive', 'onedrive', 's3']),
      verificationToken: nonEmptyString,
      credentials: z.record(z.string(), z.any()).optional(),
    }).strip(),
  },
  'POST /storage/restore/initiate': {
    body: z.object({
      verificationToken: nonEmptyString,
      exportId: z.string().trim().optional(),
    }).passthrough(),
  },
  'GET /storage/restore/status/:jobId': {
    params: z.object({
      jobId: nonEmptyString,
    }),
  },
};
