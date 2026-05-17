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
    body: z.object({ name: nonEmptyString }).strict(),
  },
  'PUT /categories/:id': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ name: nonEmptyString.optional(), defaultSlaDays: z.number().int().min(0).optional() }).strict(),
  },
  'PATCH /categories/:id/status': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ isActive: z.boolean() }).strict(),
  },
  'DELETE /categories/:id': {
    params: z.object({ id: objectIdOrString }),
  },
  'POST /categories/:id/subcategories': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ name: nonEmptyString, workbasketId: objectIdString, defaultSlaDays: z.number().int().min(0).optional() }).strict(),
  },
  'PUT /categories/:id/subcategories/:subcategoryId': {
    params: z.object({ id: objectIdOrString, subcategoryId: nonEmptyString }),
    body: z.object({ name: nonEmptyString.optional(), workbasketId: objectIdString.optional(), defaultSlaDays: z.number().int().min(0).optional() }).strict(),
  },
  'PATCH /categories/:id/subcategories/:subcategoryId/status': {
    params: z.object({ id: objectIdOrString, subcategoryId: nonEmptyString }),
    body: z.object({ isActive: z.boolean() }).strict(),
  },
  'DELETE /categories/:id/subcategories/:subcategoryId': {
    params: z.object({ id: objectIdOrString, subcategoryId: nonEmptyString }),
  },

  'GET /hierarchy': { query: passthroughQuery },
  'GET /audit-logs': {
    query: z.object({
      userId: objectIdOrString.optional(),
      actor: objectIdOrString.optional(),
      action: nonEmptyString.optional(),
      actionType: nonEmptyString.optional(),
      module: nonEmptyString.optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targetEntity: nonEmptyString.optional(),
      severity: nonEmptyString.optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
    }).passthrough(),
  },
  'GET /users': { query: passthroughQuery },
  'POST /users': { body: z.object({ name: nonEmptyString, email: z.string().trim().email(), role: z.enum(['ADMIN','MANAGER','USER']), teamIds: z.array(objectIdOrString).min(1), department: z.string().trim().max(120).optional(), assignQcWorkbaskets: z.boolean().optional() }).strict() },
  'PUT /users/:xID/activate': {
    params: z.object({ xID: xidString }),
    body: z.object({}).strict(),
  },
  'PUT /users/:xID/deactivate': {
    params: z.object({ xID: xidString }),
    body: z.object({}).strict(),
  },
  'POST /users/:xID/resend-invite': {
    params: z.object({ xID: xidString }),
    body: z.object({}).strict(),
  },
  'PATCH /users/:xID/restrict-clients': {
    params: z.object({ xID: xidString }),
    body: z.union([
      z.object({
        accessMode: z.literal('ALL'),
      }).strict(),
      z.object({
        accessMode: z.literal('SELECTED'),
        clientIds: z.array(clientIdString).min(1),
      }).strict(),
    ]),
  },
  'PATCH /users/:xID/workbaskets': {
    params: z.object({ xID: xidString }),
    body: z.object({ teamIds: z.array(objectIdOrString).min(1) }).strict(),
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
  'POST /work-settings/default-routing': { body: z.object({}).strict() },
  'POST /workbaskets': { body: z.object({ name: nonEmptyString }).strict() },
  'PUT /workbaskets/:workbasketId': {
    params: z.object({ workbasketId: objectIdOrString }),
    body: z.object({ name: nonEmptyString }).strict(),
  },
  'PATCH /workbaskets/:workbasketId/status': {
    params: z.object({ workbasketId: objectIdOrString }),
    body: z.object({ isActive: z.boolean() }).strict(),
  },
  'POST /workbaskets/:workbasketId/qc-members': {
    params: z.object({ workbasketId: objectIdOrString }),
    body: z.object({ userId: objectIdOrString }).strict(),
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
