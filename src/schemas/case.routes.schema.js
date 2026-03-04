const { z, nonEmptyString, caseIdString } = require('./common');

const caseIdParams = z.object({ caseId: caseIdString });
const caseAndAttachmentParams = z.object({ caseId: caseIdString, attachmentId: nonEmptyString });

module.exports = {
  'GET /': { query: z.object({}).passthrough() },
  'POST /': {
    body: z.object({
      title: nonEmptyString,
      description: nonEmptyString,
      categoryId: nonEmptyString,
      subcategoryId: nonEmptyString,
    }).passthrough(),
  },
  'POST /pull': { body: z.object({}).passthrough() },
  'GET /my-pending': { query: z.object({}).passthrough() },
  'GET /my-resolved': { query: z.object({}).passthrough() },
  'GET /my-unassigned-created': { query: z.object({}).passthrough() },
  'POST /auto-reopen-pended': { body: z.object({}).passthrough() },
  'POST /:caseId/track-open': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/track-view': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/track-exit': { params: caseIdParams, body: z.object({}).passthrough() },
  'GET /:caseId/history': { params: caseIdParams, query: z.object({}).passthrough() },
  'GET /:caseId': { params: caseIdParams, query: z.object({}).passthrough() },
  'POST /:caseId/comments': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).passthrough() },
  'POST /:caseId/attachments': { params: caseIdParams, body: z.object({}).passthrough() },
  'GET /:caseId/attachments/:attachmentId/view': { params: caseAndAttachmentParams, query: z.object({}).passthrough() },
  'GET /:caseId/attachments/:attachmentId/download': { params: caseAndAttachmentParams, query: z.object({}).passthrough() },
  'POST /:caseId/clone': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/unpend': { params: caseIdParams, body: z.object({}).passthrough() },
  'PUT /:caseId/status': { params: caseIdParams, body: z.object({ status: nonEmptyString }).passthrough() },
  'POST /:caseId/lock': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/unlock': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/activity': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/submit': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/review': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/close': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/reopen': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/resolve': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).passthrough() },
  'POST /:caseId/pend': { params: caseIdParams, body: z.object({ comment: nonEmptyString, pendingUntil: nonEmptyString }).passthrough() },
  'POST /:caseId/file': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).passthrough() },
  'POST /:caseId/unassign': { params: caseIdParams, body: z.object({}).passthrough() },
  'GET /:caseId/client-fact-sheet': { params: caseIdParams, query: z.object({}).passthrough() },
  'GET /:caseId/client-fact-sheet/files/:fileId/view': {
    params: z.object({ caseId: caseIdString, fileId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
  'GET /:caseId/client-cfs/files': { params: caseIdParams, query: z.object({}).passthrough() },
  'GET /:caseId/client-cfs/files/:attachmentId/download': { params: caseAndAttachmentParams, query: z.object({}).passthrough() },
};
