const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /storage/update': {
    body: z.object({
      provider: z.enum(['google_drive', 'onedrive']),
      driveId: nonEmptyString,
      rootFolderId: nonEmptyString,
      refreshToken: nonEmptyString,
      compressionEnabled: z.boolean().optional(),
      compressionLevel: z.number().int().min(1).max(9).optional(),
    }).strict(),
  },
};
