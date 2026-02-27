const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /storage/update': {
    body: z.object({
      provider: z.enum(['aws_s3', 'azure_blob', 'gcs']),
      bucket: nonEmptyString,
      region: nonEmptyString,
      prefix: z.string().trim().max(200).optional().default(''),
      accessKeyId: nonEmptyString,
      secretAccessKey: nonEmptyString,
    }).strict(),
  },
};
