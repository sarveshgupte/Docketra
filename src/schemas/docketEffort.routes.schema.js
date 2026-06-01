const { z, nonEmptyString, objectIdString, caseIdString } = require('./common');

const effortIdParams = z.object({ id: nonEmptyString });

const createEffortBody = z.object({
  caseInternalId: objectIdString,
  minutes: z.number().int().min(1, 'Minutes must be at least 1'),
  activityType: z.enum(['filing', 'review', 'communication', 'data_entry', 'reconciliation', 'other']),
  date: z.coerce.date().optional(),
  note: z.string().trim().max(1000).optional(),
}).strict();

const updateEffortBody = z.object({
  minutes: z.number().int().min(1, 'Minutes must be at least 1').optional(),
  activityType: z.enum(['filing', 'review', 'communication', 'data_entry', 'reconciliation', 'other']).optional(),
  date: z.coerce.date().optional(),
  note: z.string().trim().max(1000).optional(),
}).strict();

const updateBudgetBody = z.object({
  expectedMinutes: z.number().int().min(0, 'Expected minutes must be >= 0').optional(),
  estimatedBudget: z.number().min(0, 'Estimated budget must be >= 0').optional(),
}).strict().superRefine((body, ctx) => {
  if (body.expectedMinutes === undefined && body.estimatedBudget === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either expectedMinutes or estimatedBudget must be provided',
    });
  }
});

const listEffortQuery = z.object({
  caseInternalId: objectIdString.optional(),
  clientId: objectIdString.optional(),
  userXID: z.string().trim().optional(),
  activityType: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

module.exports = {
  'POST /': {
    body: createEffortBody,
  },
  'DELETE /:id': {
    params: effortIdParams,
  },
  'PATCH /docket/:caseId/budget': {
    params: z.object({ caseId: caseIdString }),
    body: updateBudgetBody,
  },
  'GET /': {
    query: listEffortQuery,
  },
  'GET /reports/profitability': {
    query: z.object({}).strict(),
  },
};
