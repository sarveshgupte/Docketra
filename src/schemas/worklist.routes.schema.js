const { z, nonEmptyString, xidString } = require('./common');

const EMPLOYEE_WORKLIST_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'QC_PENDING', 'PENDING'];
const employeeWorklistStatusEnum = z.enum(EMPLOYEE_WORKLIST_STATUSES);
const employeeWorklistStatusCsv = z.string().trim().refine((value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  const values = normalized.split(',').map((status) => status.trim().toUpperCase()).filter(Boolean);
  return values.length > 0 && values.every((status) => EMPLOYEE_WORKLIST_STATUSES.includes(status));
}, {
  message: `status must include only allowed values: ${EMPLOYEE_WORKLIST_STATUSES.join(', ')}`,
});

module.exports = {
  'GET /global': {
    query: z.object({
      clientId: nonEmptyString.optional(),
      category: nonEmptyString.optional(),
      createdAtFrom: nonEmptyString.optional(),
      createdAtTo: nonEmptyString.optional(),
      slaStatus: z.enum(['overdue', 'due_soon', 'on_track']).optional(),
      sortBy: z.enum(['clientId', 'category', 'slaDueAt', 'slaDueDate', 'createdAt']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().optional(),
    }).passthrough(),
  },
  'GET /category/:categoryId': {
    params: z.object({ categoryId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
  'GET /employee/me': {
    query: z.object({
      assigneeXID: xidString.optional(),
      status: z.union([
        employeeWorklistStatusCsv,
        z.array(employeeWorklistStatusEnum),
      ]).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      search: z.string().trim().min(1).max(200).optional(),
      category: nonEmptyString.optional(),
      subcategory: nonEmptyString.optional(),
      sortBy: z.enum(['caseId', 'clientId', 'clientName', 'category', 'subcategory', 'dueDate', 'pendingUntil', 'updatedAt', 'createdAt']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    }).strict(),
  },
  'POST /employee/:caseId/move': {
    params: z.object({ caseId: nonEmptyString }),
    body: z.object({
      destinationType: nonEmptyString,
      destinationId: nonEmptyString.optional(),
      assigneeXID: xidString.optional(),
      note: z.string().trim().max(500).optional(),
    }).strict(),
  },
};
