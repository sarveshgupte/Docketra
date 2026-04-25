const { z, nonEmptyString, objectIdString } = require('./common');

const firmIdParams = z.object({ id: objectIdString });
const firmIdAndAdminParams = z.object({ firmId: objectIdString, adminId: objectIdString });
const firmIdParams2 = z.object({ firmId: objectIdString });
const passthroughQuery = z.object({}).passthrough();
const passthroughBody = z.object({}).passthrough();

module.exports = {
  'GET /stats': { query: passthroughQuery },
  'GET /onboarding-insights': { query: passthroughQuery },
  'GET /onboarding-insights/details': { query: passthroughQuery },
  'GET /onboarding-alerts': { query: passthroughQuery },
  'GET /health': { query: passthroughQuery },
  'GET /diagnostics': {
    query: z.object({
      limit: z.coerce.number().int().min(5).max(30).optional(),
    }).passthrough(),
  },

  'POST /firms': {
    body: z.object({
      name: nonEmptyString,
      slug: z.string().trim().min(1).optional(),
    }).passthrough(),
  },
  'GET /firms': { query: passthroughQuery },
  'PATCH /firms/:id': {
    params: firmIdParams,
    body: passthroughBody,
  },
  'PATCH /firms/:id/status': {
    params: firmIdParams,
    body: z.object({
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    }).passthrough(),
  },
  'PATCH /firms/:id/activate': {
    params: firmIdParams,
    body: passthroughBody,
  },
  'PATCH /firms/:id/deactivate': {
    params: firmIdParams,
    body: passthroughBody,
  },
  'POST /firms/:id/disable': {
    params: firmIdParams,
    body: passthroughBody,
  },

  'POST /firms/:firmId/admin': {
    params: firmIdParams2,
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email(),
    }).passthrough(),
  },
  'POST /firms/:firmId/admins': {
    params: firmIdParams2,
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email(),
    }).passthrough(),
  },

  'POST /firms/:firmId/admin/resend-access': {
    params: firmIdParams2,
    body: passthroughBody,
  },
  'GET /firms/:firmId/admin': {
    params: firmIdParams2,
    query: passthroughQuery,
  },
  'GET /firms/:firmId/admins': {
    params: firmIdParams2,
    query: passthroughQuery,
  },
  'PATCH /firms/:firmId/admin/status': {
    params: firmIdParams2,
    body: z.object({
      isActive: z.boolean().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    }).passthrough(),
  },
  'PATCH /firms/:firmId/admins/:adminId/status': {
    params: firmIdAndAdminParams,
    body: z.object({
      isActive: z.boolean().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    }).passthrough(),
  },
  'POST /firms/:firmId/admin/force-reset': {
    params: firmIdParams2,
    body: passthroughBody,
  },
  'POST /firms/:firmId/admins/:adminId/force-reset': {
    params: firmIdAndAdminParams,
    body: passthroughBody,
  },
  'DELETE /firms/:firmId/admins/:adminId': {
    params: firmIdAndAdminParams,
  },

  'POST /switch-firm': {
    body: z.object({
      firmId: objectIdString,
    }).passthrough(),
  },
  'POST /exit-firm': {
    body: passthroughBody,
  },
};
