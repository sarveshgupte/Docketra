const { z, nonEmptyString } = require('./common');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

module.exports = {
  'POST /request-upload': {
    body: z.object({
      caseId: nonEmptyString,
      originalName: nonEmptyString.max(255),
      mimeType: z.enum(ALLOWED_MIME_TYPES),
      size: z.coerce.number().int().positive().max(25 * 1024 * 1024),
    }).strict(),
  },
  'GET /:fileId/download': {
    params: z.object({ fileId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
};
