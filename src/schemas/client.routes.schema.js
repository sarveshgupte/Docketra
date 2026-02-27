const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /': { query: z.object({}).passthrough() },
  'GET /:clientId': { params: z.object({ clientId: nonEmptyString }), query: z.object({}).passthrough() },
  'POST /': {
    body: z.object({ name: nonEmptyString }).passthrough(),
  },
  'PUT /:clientId': {
    params: z.object({ clientId: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'PATCH /:clientId/status': {
    params: z.object({ clientId: nonEmptyString }),
    body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).passthrough(),
  },
  'POST /:clientId/change-name': {
    params: z.object({ clientId: nonEmptyString }),
    body: z.object({ legalName: nonEmptyString }).passthrough(),
  },
  'PUT /:clientId/fact-sheet': {
    params: z.object({ clientId: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'POST /:clientId/fact-sheet/files': { params: z.object({ clientId: nonEmptyString }), body: z.object({}).passthrough() },
  'DELETE /:clientId/fact-sheet/files/:fileId': { params: z.object({ clientId: nonEmptyString, fileId: nonEmptyString }) },
  'POST /:clientId/cfs/files': { params: z.object({ clientId: nonEmptyString }), body: z.object({}).passthrough() },
  'DELETE /:clientId/cfs/files/:attachmentId': { params: z.object({ clientId: nonEmptyString, attachmentId: nonEmptyString }) },
  'GET /:clientId/cfs/files': { params: z.object({ clientId: nonEmptyString }), query: z.object({}).passthrough() },
  'GET /:clientId/cfs/files/:attachmentId/download': {
    params: z.object({ clientId: nonEmptyString, attachmentId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
};
