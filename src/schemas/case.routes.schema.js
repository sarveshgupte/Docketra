const { z, nonEmptyString, caseIdString } = require('./common');

const caseIdParams = z.object({ caseId: caseIdString });
const caseAndAttachmentParams = z.object({ caseId: caseIdString, attachmentId: nonEmptyString });

module.exports = {
  'GET /': { query: z.object({}).strip() },
  'GET /search': { query: z.object({ q: z.string().optional() }).strip() },
  'POST /': {
    body: z.object({
      title: nonEmptyString,
      description: nonEmptyString,
      categoryId: nonEmptyString,
      subcategoryId: nonEmptyString,
    }).strip(),
  },
  'POST /pull': { body: z.object({}).strip() },
  'GET /my-pending': { query: z.object({}).strip() },
  'GET /my-resolved': { query: z.object({}).strip() },
  'GET /my-unassigned-created': { query: z.object({}).strip() },
  'POST /auto-reopen-pended': { body: z.object({}).strip() },
  'POST /:caseId/track-open': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/track-view': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/track-exit': { params: caseIdParams, body: z.object({}).strip() },
  'GET /:caseId/history': { params: caseIdParams, query: z.object({}).strip() },
  'GET /:caseId': { params: caseIdParams, query: z.object({}).strip() },
  'POST /:caseId/comments': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).strip() },
  'POST /:caseId/attachments': { params: caseIdParams, body: z.object({}).strip() },
  'GET /:caseId/attachments/:attachmentId/view': { params: caseAndAttachmentParams, query: z.object({}).strip() },
  'GET /:caseId/attachments/:attachmentId/download': { params: caseAndAttachmentParams, query: z.object({}).strip() },
  'POST /:caseId/clone': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/unpend': { params: caseIdParams, body: z.object({}).strip() },
  'PUT /:caseId/status': { params: caseIdParams, body: z.object({ status: nonEmptyString }).strip() },
  'POST /:caseId/lock': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/unlock': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/activity': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/submit': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/review': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/close': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/reopen': { params: caseIdParams, body: z.object({}).strip() },
  'POST /:caseId/resolve': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).strip() },
  'POST /:caseId/pend': { params: caseIdParams, body: z.object({ comment: nonEmptyString, pendingUntil: nonEmptyString }).strip() },
  'POST /:caseId/file': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).strip() },
  'POST /:caseId/unassign': { params: caseIdParams, body: z.object({}).strip() },
  'GET /:caseId/client-fact-sheet': { params: caseIdParams, query: z.object({}).strip() },
  'GET /:caseId/client-fact-sheet/files/:fileId/view': {
    params: z.object({ caseId: caseIdString, fileId: nonEmptyString }),
    query: z.object({}).strip(),
  },
  'GET /:caseId/client-cfs/files': { params: caseIdParams, query: z.object({}).strip() },
  'GET /:caseId/client-cfs/files/:attachmentId/download': { params: caseAndAttachmentParams, query: z.object({}).strip() },
};
