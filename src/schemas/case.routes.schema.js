const { z, nonEmptyString, caseIdString, clientIdString, xidString, objectIdString } = require('./common');

const caseIdParams = z.object({ caseId: caseIdString });
const caseAndAttachmentParams = z.object({ caseId: caseIdString, attachmentId: nonEmptyString });
const strictEmpty = z.object({}).strict();
const paginationQuery = z.object({
  commentsPage: z.coerce.number().int().min(1).optional(),
  commentsLimit: z.coerce.number().int().min(1).max(100).optional(),
  activityPage: z.coerce.number().int().min(1).optional(),
  activityLimit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

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
}).strict();

module.exports = {
  'GET /': {
    query: z.object({
      status: z.union([z.string(), z.array(z.string())]).optional(),
      category: z.string().trim().min(1).optional(),
      priority: z.string().trim().min(1).optional(),
      assignedTo: z.string().trim().min(1).optional(),
      slaDueDate: z.string().trim().min(1).optional(),
      createdBy: z.string().trim().min(1).optional(),
      clientId: clientIdString.optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).strict(),
  },
  'GET /search': { query: z.object({ q: z.string().optional() }).strict() },
  'POST /': { body: createCaseBody },
  'POST /pull': {
    body: z.object({
      caseIds: z.array(caseIdString).optional(),
      assignTo: objectIdString.optional(),
    }).strict(),
  },
  'GET /my-pending': { query: strictEmpty },
  'GET /my-resolved': { query: strictEmpty },
  'GET /my-unassigned-created': { query: strictEmpty },
  'POST /auto-reopen-pended': { body: strictEmpty },
  'POST /:caseId/track-open': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/track-view': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/track-exit': { params: caseIdParams, body: strictEmpty },
  'GET /:caseId/history': { params: caseIdParams, query: strictEmpty },
  'GET /:caseId': { params: caseIdParams, query: paginationQuery },
  'POST /:caseId/comments': {
    params: caseIdParams,
    body: z.object({
      text: z.string().trim().min(1).max(2000),
      note: z.string().trim().min(1).max(500).optional(),
    }).strict(),
  },
  'POST /:caseId/attachments': {
    params: caseIdParams,
    body: z.object({
      description: z.string().trim().min(1).max(500),
      note: z.string().trim().min(1).max(500).optional(),
    }).strict(),
  },
  'GET /:caseId/attachments/:attachmentId/view': { params: caseAndAttachmentParams, query: strictEmpty },
  'GET /:caseId/attachments/:attachmentId/download': { params: caseAndAttachmentParams, query: strictEmpty },
  'POST /:caseId/clone': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/unpend': { params: caseIdParams, body: strictEmpty },
  'PUT /:caseId/status': { params: caseIdParams, body: z.object({ status: nonEmptyString }).strict() },
  'POST /:caseId/lock': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/unlock': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/activity': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/submit': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/review': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/close': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/reopen': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/resolve': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).strict() },
  'POST /:caseId/pend': { params: caseIdParams, body: z.object({ comment: nonEmptyString, reopenDate: nonEmptyString }).strict() },
  'POST /:caseId/file': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).strict() },
  'POST /:caseId/unassign': { params: caseIdParams, body: strictEmpty },
  'GET /:caseId/client-fact-sheet': { params: caseIdParams, query: strictEmpty },
  'GET /:caseId/client-fact-sheet/files/:fileId/view': {
    params: z.object({ caseId: caseIdString, fileId: nonEmptyString }),
    query: strictEmpty,
  },
  'GET /:caseId/client-cfs/files': { params: caseIdParams, query: strictEmpty },
  'GET /:caseId/client-cfs/files/:attachmentId/download': { params: caseAndAttachmentParams, query: strictEmpty },
};
