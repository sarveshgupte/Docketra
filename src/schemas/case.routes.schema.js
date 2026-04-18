const { z, nonEmptyString, caseIdString, clientIdString, xidString, objectIdString, queryBoolean } = require('./common');

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
  isInternal: queryBoolean.optional(),
  workType: z.enum(['client', 'internal']).optional(),
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

const cloneCaseBody = z.object({
  categoryId: objectIdString,
  subcategoryId: nonEmptyString,
}).strict();

module.exports = {
  'POST /bulk/preview': {
    body: z.object({
      rows: z.array(z.record(z.string(), z.string())).max(1000).optional(),
      csvContent: z.string().max(500_000).optional(),
    }).strict(),
  },
  'POST /bulk/upload': {
    body: z.object({
      rows: z.array(z.record(z.string(), z.string())).max(1000).optional(),
      csvContent: z.string().max(500_000).optional(),
      rejectOnInvalid: z.boolean().optional(),
      uploadValidRowsOnly: z.boolean().optional(),
    }).strict(),
  },
  'GET /': {
    query: z.object({
      status: z.union([z.string(), z.array(z.string())]).optional(),
      category: z.string().trim().min(1).optional(),
      priority: z.string().trim().min(1).optional(),
      assignedTo: z.string().trim().min(1).optional(),
      slaDueDate: z.string().trim().min(1).optional(),
      createdBy: z.string().trim().min(1).optional(),
      clientId: clientIdString.optional(),
      isInternal: queryBoolean.optional(),
      workType: z.enum(['client', 'internal']).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).strict(),
  },
  'GET /search': { query: z.object({ q: z.string().optional() }).strict() },
  'POST /': { body: createCaseBody },
  'POST /create': { body: createCaseBody },
  'POST /pull': {
    body: z.object({
      caseIds: z.array(caseIdString).optional(),
      assignTo: objectIdString.optional(),
    }).strict(),
  },
  'GET /my-pending': { query: strictEmpty },
  'GET /my-resolved': { query: strictEmpty },
  'GET /my-unassigned-created': { query: strictEmpty },
  'GET /ai-suggestions/:attachmentId': {
    params: z.object({ attachmentId: nonEmptyString }),
    query: strictEmpty,
  },
  'POST /from-attachment/:attachmentId': {
    params: z.object({ attachmentId: nonEmptyString }),
    query: z.object({ preview: queryBoolean.optional() }).strict(),
    body: strictEmpty,
  },
  'POST /auto-reopen-pended': { body: strictEmpty },
  'POST /:caseId/track-open': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/track-view': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/track-exit': { params: caseIdParams, body: strictEmpty },
  'GET /:caseId/history': { params: caseIdParams, query: strictEmpty },
  'GET /:caseId/audit': {
    params: caseIdParams,
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).strict(),
  },
  'GET /:caseId/timeline': {
    params: caseIdParams,
    query: z.object({
      type: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).strict(),
  },
  'GET /:caseId/ai-routing': {
    params: caseIdParams,
    query: strictEmpty,
  },
  'GET /:caseId': { params: caseIdParams, query: paginationQuery },
  'POST /:caseId/comments': {
    params: caseIdParams,
    body: z.object({
      text: z.string().trim().min(1).max(2000),
      note: z.string().trim().min(1).max(500).optional(),
    }).strict(),
  },
  'POST /:caseId/upload-link': {
    params: caseIdParams,
    body: z.object({
      requirePin: queryBoolean.optional(),
      expiry: z.enum(['24h', '7d']).optional(),
      sendEmail: queryBoolean.optional(),
    }).strict(),
  },
  'GET /:caseId/upload-link': {
    params: caseIdParams,
    query: strictEmpty,
  },
  'POST /:caseId/upload-link/revoke': {
    params: caseIdParams,
    body: strictEmpty,
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
  'POST /:caseId/clone': { params: caseIdParams, body: cloneCaseBody },
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

  'POST /:caseId/route': {
    params: caseIdParams,
    body: z.object({
      toTeamId: objectIdString,
      note: z.string().trim().max(500).optional(),
    }).strict(),
  },
  'POST /:caseId/accept': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/return': {
    params: caseIdParams,
    body: z.object({ note: z.string().trim().max(500).optional() }).strict(),
  },
  'POST /:caseId/routed-status': {
    params: caseIdParams,
    body: z.object({ status: z.enum(['IN_PROGRESS', 'PENDING', 'FILED']) }).strict(),
  },
  'GET /:caseId/client-fact-sheet': { params: caseIdParams, query: strictEmpty },
  'GET /:caseId/client-fact-sheet/files/:fileId/view': {
    params: z.object({ caseId: caseIdString, fileId: nonEmptyString }),
    query: strictEmpty,
  },
  'GET /:caseId/client-cfs/files': { params: caseIdParams, query: strictEmpty },
  'GET /:caseId/client-cfs/files/:attachmentId/download': { params: caseAndAttachmentParams, query: strictEmpty },

  'GET /:caseId/summary-pdf': { params: caseIdParams, query: strictEmpty },
  'GET /:caseId/comments': { params: caseIdParams, query: z.object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }).passthrough() },
  'POST /:caseId/comment': { params: caseIdParams, body: z.object({ text: z.string().trim().min(1).max(2000), note: z.string().trim().min(1).max(500).optional() }).strict() },
  'POST /:caseId/assign': { params: caseIdParams, body: z.object({ assignTo: xidString.optional(), assignedTo: xidString.optional() }).passthrough() },
  'PATCH /:caseId/assign': { params: caseIdParams, body: z.object({ assignTo: xidString.optional(), assignedTo: xidString.optional() }).passthrough() },
  'POST /:caseId/transition': { params: caseIdParams, body: z.object({ status: nonEmptyString }).passthrough() },
  'POST /:caseId/reopen-pending': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/qc-action': { params: caseIdParams, body: z.object({ action: nonEmptyString }).passthrough() },
  'POST /:caseId/reassign': { params: caseIdParams, body: z.object({ assignTo: xidString }).passthrough() },
  'POST /:caseId/apply-ai-routing': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/reject-ai-routing': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/manager-move': { params: caseIdParams, body: z.object({ targetTeamId: objectIdString.optional() }).passthrough() },
};
