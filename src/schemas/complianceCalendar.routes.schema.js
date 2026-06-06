const { z, nonEmptyString, objectIdString } = require('./common');

const recurrencePatternSchema = z.object({
  frequency: z.enum(['none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  interval: z.coerce.number().int().min(1).max(52).optional(),
  untilDate: z.string().trim().optional(),
}).passthrough();

module.exports = {
  'GET /': {
    query: z.object({}).passthrough(),
  },
  'POST /': {
    body: z.object({
      title: nonEmptyString,
      description: z.string().trim().optional(),
      dueDate: nonEmptyString,
      clientId: z.string().trim().optional(),
      clientName: z.string().trim().optional(),
      categoryId: z.string().trim().optional(),
      categoryName: z.string().trim().optional(),
      linkedCaseId: z.string().trim().optional(),
      calendarEntryType: z.enum(['important_date', 'holiday', 'birthday', 'working_day', 'off_day']).optional(),
      reminderDaysBefore: z.coerce.number().int().min(0).max(30).optional(),
      recurrencePattern: recurrencePatternSchema.optional(),
    }).passthrough(),
  },
  'PUT /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().optional(),
      dueDate: z.string().trim().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
      clientId: z.string().trim().optional(),
      clientName: z.string().trim().optional(),
      categoryId: z.string().trim().optional(),
      categoryName: z.string().trim().optional(),
      linkedCaseId: z.string().trim().optional(),
      calendarEntryType: z.enum(['important_date', 'holiday', 'birthday', 'working_day', 'off_day']).optional(),
      reminderDaysBefore: z.coerce.number().int().min(0).max(30).optional(),
      recurrencePattern: recurrencePatternSchema.nullable().optional(),
    }).passthrough(),
  },
  'DELETE /:id': {
    params: z.object({ id: objectIdString }),
  },
};
