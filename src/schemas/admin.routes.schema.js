const { z, nonEmptyString, objectIdString, xidString, clientIdString, queryBoolean } = require('./common');

const objectIdOrString = z.union([objectIdString, nonEmptyString]);
const passthroughQuery = z.object({}).passthrough();
const passthroughBody = z.object({}).passthrough();

module.exports = {
  'GET /stats': { query: passthroughQuery },

  'GET /clients': { query: passthroughQuery },
  'POST /clients': { body: passthroughBody },
  'PUT /clients/:clientId': {
    params: z.object({ clientId: clientIdString }),
    body: passthroughBody,
  },
  'PATCH /clients/:clientId/status': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).passthrough(),
  },
  'POST /clients/:clientId/change-name': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({ legalName: nonEmptyString }).passthrough(),
  },
  'PUT /clients/:clientId/fact-sheet': {
    params: z.object({ clientId: clientIdString }),
    body: passthroughBody,
  },
  'POST /clients/:clientId/fact-sheet/files': {
    params: z.object({ clientId: clientIdString }),
    body: passthroughBody,
  },
  'DELETE /clients/:clientId/fact-sheet/files/:fileId': {
    params: z.object({ clientId: clientIdString, fileId: nonEmptyString }),
  },

  'GET /categories': {
    query: z.object({ activeOnly: queryBoolean.optional() }).passthrough(),
  },
  'POST /categories': {
    body: z.object({ name: nonEmptyString }).passthrough(),
  },
  'PUT /categories/:id': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ name: nonEmptyString.optional() }).passthrough(),
  },
  'PATCH /categories/:id/status': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ isActive: z.boolean() }).passthrough(),
  },
  'DELETE /categories/:id': {
    params: z.object({ id: objectIdOrString }),
  },
  'POST /categories/:id/subcategories': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ name: nonEmptyString, workbasketId: objectIdString }).passthrough(),
  },
  'PUT /categories/:id/subcategories/:subcategoryId': {
    params: z.object({ id: objectIdOrString, subcategoryId: nonEmptyString }),
    body: z.object({ name: nonEmptyString.optional(), workbasketId: objectIdString.optional() }).passthrough(),
  },
  'PATCH /categories/:id/subcategories/:subcategoryId/status': {
    params: z.object({ id: objectIdOrString, subcategoryId: nonEmptyString }),
    body: z.object({ isActive: z.boolean() }).passthrough(),
  },
  'DELETE /categories/:id/subcategories/:subcategoryId': {
    params: z.object({ id: objectIdOrString, subcategoryId: nonEmptyString }),
  },

  'GET /hierarchy': { query: passthroughQuery },
  'GET /audit-logs': {
    query: z.object({
      userId: objectIdOrString.optional(),
      action: nonEmptyString.optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.coerce.number().int().positive().max(500).optional(),
    }).passthrough(),
  },
  'GET /users': { query: passthroughQuery },
  'POST /users': { body: passthroughBody },
  'PUT /users/:xID/activate': {
    params: z.object({ xID: xidString }),
    body: passthroughBody,
  },
  'PUT /users/:xID/deactivate': {
    params: z.object({ xID: xidString }),
    body: passthroughBody,
  },
  'POST /users/:xID/resend-invite': {
    params: z.object({ xID: xidString }),
    body: passthroughBody,
  },
  'PATCH /users/:xID/restrict-clients': {
    params: z.object({ xID: xidString }),
    body: passthroughBody,
  },
  'PATCH /users/:xID/workbaskets': {
    params: z.object({ xID: xidString }),
    body: z.object({ teamIds: z.array(objectIdOrString).min(1) }).passthrough(),
  },
  'PATCH /users/:id/hierarchy': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({
      adminId: objectIdOrString.nullish(),
      managerId: objectIdOrString.nullish(),
    }).passthrough(),
  },
  'GET /firm-settings': { query: passthroughQuery },
  'GET /firm-settings/activity': { query: passthroughQuery },
  'GET /settings/audit': {
    query: z.object({
      key: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
  'PUT /firm-settings': { body: passthroughBody },
  'GET /cms-intake-settings': { query: passthroughQuery },
  'PUT /cms-intake-settings': { body: passthroughBody },
  'POST /cms-intake-settings/intake-api-key/regenerate': { body: passthroughBody },
  'GET /workbaskets': { query: passthroughQuery },
  'POST /workbaskets': { body: z.object({ name: nonEmptyString }).passthrough() },
  'PUT /workbaskets/:workbasketId': {
    params: z.object({ workbasketId: objectIdOrString }),
    body: z.object({ name: nonEmptyString }).passthrough(),
  },
  'PATCH /workbaskets/:workbasketId/status': {
    params: z.object({ workbasketId: objectIdOrString }),
    body: z.object({ isActive: z.boolean() }).passthrough(),
  },
  'POST /users/:id/restore': {
    params: z.object({ id: objectIdOrString }),
    body: passthroughBody,
  },

  'GET /system-diagnostics': { query: passthroughQuery },

  'GET /cases/open': { query: passthroughQuery },
  'GET /cases/pending': { query: passthroughQuery },
  'GET /cases/filed': { query: passthroughQuery },
  'GET /cases/resolved': { query: passthroughQuery },
  'POST /cases/:id/restore': {
    params: z.object({ id: objectIdOrString }),
    body: passthroughBody,
  },

  'GET /storage': { query: passthroughQuery },
  'PUT /storage': { body: passthroughBody },
  'POST /storage/disconnect': { body: passthroughBody },

  'POST /clients/:id/restore': {
    params: z.object({ id: objectIdOrString }),
    body: passthroughBody,
  },
  'POST /tasks/:id/restore': {
    params: z.object({ id: objectIdOrString }),
    body: passthroughBody,
  },
  'GET /retention-preview': { query: passthroughQuery },
};
