const { z, nonEmptyString, objectIdString, paginationQuery } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      caseInternalId: objectIdString,
      name: nonEmptyString,
      category: nonEmptyString,
      fileReference: objectIdString,
      notes: z.string().trim().optional(),
      changeNote: z.string().trim().optional(),
    }).passthrough(),
  },
  'POST /:id/versions': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      fileReference: objectIdString,
      changeNote: nonEmptyString,
    }).passthrough(),
  },
  'GET /': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      caseInternalId: objectIdString.optional(),
      status: z.enum(['draft', 'under_review', 'approved', 'filed', 'archived']).optional(),
      category: z.string().trim().optional(),
    }).passthrough(),
  },
  'GET /:id': {
    params: z.object({ id: objectIdString }),
  },
  'PATCH /:id/status': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      status: z.enum(['draft', 'under_review', 'approved', 'filed', 'archived']),
    }).passthrough(),
  },
  'PATCH /:id/current-version': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      versionNumber: z.number().int().min(1),
    }).passthrough(),
  },
};
