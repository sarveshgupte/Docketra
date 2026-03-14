const { z, nonEmptyString, caseIdString, clientIdString, xidString, objectIdString } = require('./common');

const caseIdParams = z.object({ caseId: caseIdString });
const caseAndAttachmentParams = z.object({ caseId: caseIdString, attachmentId: nonEmptyString });

const createCaseBody = z.object({
  // Title is intentionally optional in createCase controller for backward compatibility.
  title: z.string().trim().min(1).optional(),
  description: nonEmptyString,
  categoryId: objectIdString,
  subcategoryId: nonEmptyString,
  category: z.string().trim().optional(),
  caseCategory: z.string().trim().optional(),
  caseSubCategory: z.string().trim().optional(),
  clientId: clientIdString.optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  assignedTo: xidString.optional(),
  slaDueDate: z.coerce.date().optional(),
  forceCreate: z.boolean().optional(),
  clientData: z.record(z.any()).optional(),
  payload: z.record(z.any()).optional(),
  workTypeId: objectIdString.optional(),
  subWorkTypeId: objectIdString.optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
}).strip();

module.exports = {
  'GET /': { query: z.object({}).strip() },
  'GET /search': { query: z.object({ q: z.string().optional() }).strip() },
  'POST /': { body: createCaseBody },
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
  'POST /:caseId/comments': {
    params: caseIdParams,
    body: z.object({ text: nonEmptyString, createdBy: z.string().trim().optional(), note: z.string().trim().optional() }).strip(),
  },
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
  'POST /:caseId/pend': { params: caseIdParams, body: z.object({ comment: nonEmptyString, reopenDate: nonEmptyString }).strip() },
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
