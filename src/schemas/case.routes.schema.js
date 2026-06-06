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

const prioritySchema = z
  .enum(['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'])
  .transform((value) => String(value).toLowerCase());

const createCaseBody = z.object({
  // Title is intentionally optional in createCase controller for backward compatibility.
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  categoryId: objectIdString,
  subcategoryId: nonEmptyString,
  category: z.string().trim().optional(),
  caseCategory: z.string().trim().optional(),
  caseSubCategory: z.string().trim().optional(),
  clientId: clientIdString.optional(),
  isInternal: queryBoolean.optional(),
  // Deprecated in create payloads; retained for backward compatibility.
  workType: z.enum(['client', 'internal']).optional(),
  priority: prioritySchema.optional(),
  assignedTo: xidString.optional(),
  employeeXID: xidString.optional(),
  relatedEmployeeUserId: objectIdString.optional(),
  relatedEmployeeUser: z.object({
    userId: objectIdString,
  }).strict().optional(),
  slaDueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  compliance_state: z.enum(['not_started', 'in_progress', 'awaiting_client', 'awaiting_partner', 'ready_to_file', 'filed', 'blocked', 'closed']).optional(),
  statutory_due_date: z.coerce.date().optional(),
  internal_due_date: z.coerce.date().optional(),
  pend_until: z.coerce.date().optional(),
  filed_at: z.coerce.date().optional(),
  obligation_type: z.string().trim().min(1).max(120).optional(),
  obligation_period: z.string().trim().min(1).max(120).optional(),
  reviewer_xid: xidString.optional(),
  approver_xid: xidString.optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  blocked_reason: z.string().trim().max(600).optional(),
  eventDate: z.coerce.date().optional(),
  forceCreate: z.boolean().optional(),
  clientData: z.record(z.any()).optional(),
  payload: z.record(z.any()).optional(),
  workTypeId: objectIdString.optional(),
  subWorkTypeId: objectIdString.optional(),
  workbasketId: objectIdString.optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
  expectedMinutes: z.number().int().min(0).optional(),
  estimatedBudget: z.number().min(0).optional(),
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
      employeeXID: z.string().trim().min(1).optional(),
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
  'GET /eligible-users': { query: strictEmpty },
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
  'GET /:caseId/request-checklist': {
    params: caseIdParams,
    query: strictEmpty,
  },
  'PUT /:caseId/request-checklist': {
    params: caseIdParams,
    body: z.object({
      items: z.array(z.object({
        id: z.string().trim().optional(),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(1000).optional(),
        required: z.boolean().optional(),
        dueDate: z.coerce.date().optional().nullable(),
        status: z.enum(['requested', 'submitted', 'accepted', 'rejected', 'waived']).optional(),
        reviewerNotes: z.string().trim().max(1200).optional(),
      }).strict()).max(100),
    }).strict(),
  },
  'PATCH /:caseId/request-checklist/:itemId/review': {
    params: z.object({ caseId: caseIdString, itemId: nonEmptyString }).strict(),
    body: z.object({
      status: z.enum(['requested', 'accepted', 'rejected', 'waived']),
      reviewerNotes: z.string().trim().max(1200).optional(),
    }).strict(),
  },
  'GET /:caseId/approval-stage': {
    params: caseIdParams,
    query: strictEmpty,
  },
  'POST /:caseId/approval-stage/request': {
    params: caseIdParams,
    body: z.object({
      approvalType: z.enum(['internal_partner', 'client', 'authorised_signatory', 'other']),
      approver: xidString,
      dueAt: z.string().trim().optional(),
      comments: z.string().trim().max(1200).optional(),
      evidenceAttachmentId: z.string().trim().max(120).optional(),
      resumeToState: z.enum(['ready_to_file', 'in_progress']).optional(),
    }).strict(),
  },
  'POST /:caseId/approval-stage/decision': {
    params: caseIdParams,
    body: z.object({
      decision: z.enum(['approved', 'rejected', 'cancelled']),
      comment: z.string().trim().max(1200).optional(),
    }).strict(),
  },
  'POST /:caseId/attachments': {
    params: caseIdParams,
    body: z.object({
      description: z.string().trim().min(1).max(500),
      note: z.string().trim().min(1).max(500).optional(),
    }).strict(),
  },
  'POST /:caseId/attachments/upload-intent': {
    params: caseIdParams,
    body: z.object({
      fileName: nonEmptyString,
      mimeType: nonEmptyString,
      size: z.coerce.number().int().positive(),
      description: z.string().trim().min(1).max(500),
      note: z.string().trim().min(1).max(500).optional(),
      checksum: z.string().trim().optional(),
    }).strict(),
  },
  'POST /:caseId/attachments/finalize': {
    params: caseIdParams,
    body: z.object({
      uploadId: nonEmptyString,
      completion: z.object({
        providerFileId: z.string().trim().optional(),
        objectKey: z.string().trim().optional(),
      }).optional(),
      checksum: z.string().trim().optional(),
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
  'POST /:caseId/resolve': { params: caseIdParams, body: z.object({ comment: nonEmptyString, sendToQC: z.boolean().optional() }).strict() },
  'POST /:caseId/pend': { params: caseIdParams, body: z.object({ comment: nonEmptyString, reopenDate: nonEmptyString }).strict() },
  'POST /:caseId/file': { params: caseIdParams, body: z.object({ comment: nonEmptyString }).strict() },

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
  'POST /:caseId/transition': {
    params: caseIdParams,
    body: z.object({
      toState: nonEmptyString.optional(),
      status: nonEmptyString.optional(),
      comment: z.string().trim().optional(),
      reopenAt: z.string().trim().optional(),
      sendToQC: z.boolean().optional(),
      duplicateOf: z.string().trim().optional(),
    }).passthrough().superRefine((body, ctx) => {
      if (!body.toState && !body.status) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Either toState or status is required",
        });
      }
    }),
  },
  'POST /:caseId/reopen-pending': { params: caseIdParams, body: z.object({}).passthrough() },
  'POST /:caseId/qc-action': { params: caseIdParams, body: z.object({ action: nonEmptyString }).passthrough() },
  'POST /:caseId/reassign': { params: caseIdParams, body: z.object({ assignTo: xidString }).passthrough() },
  'POST /:caseId/move': {
    params: caseIdParams,
    body: z.object({
      destinationType: z.enum(['USER_WORKLIST', 'WORKBASKET', 'QC_WORKBASKET']),
      assigneeXID: xidString.optional(),
      destinationId: objectIdString.optional(),
      note: z.string().trim().max(500).optional(),
    }).strict().superRefine((body, ctx) => {
      if (body.destinationType === 'USER_WORKLIST' && !body.assigneeXID) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assigneeXID'], message: 'assigneeXID is required for USER_WORKLIST' });
      }
      if ((body.destinationType === 'WORKBASKET' || body.destinationType === 'QC_WORKBASKET') && !body.destinationId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destinationId'], message: 'destinationId is required for workbasket destinations' });
      }
    }),
  },
  'POST /:caseId/apply-ai-routing': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/reject-ai-routing': { params: caseIdParams, body: strictEmpty },
  'POST /:caseId/manager-move': { params: caseIdParams, body: z.object({ targetTeamId: objectIdString.optional() }).passthrough() },
};
