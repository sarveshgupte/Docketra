const { z, nonEmptyString, objectIdString } = require('./common');

const firmIdParams = z.object({ id: objectIdString });
const firmIdAndAdminParams = z.object({ firmId: objectIdString, adminId: objectIdString });
const firmIdParams2 = z.object({ firmId: objectIdString });
const passthroughQuery = z.object({}).passthrough();

module.exports = {
  'GET /stats': { query: passthroughQuery },
  'GET /onboarding-insights': { query: passthroughQuery },
  'GET /onboarding-insights/details': { query: passthroughQuery },
  'GET /onboarding-alerts': { query: passthroughQuery },
  'GET /health': { query: passthroughQuery },
  'GET /diagnostics': {
    query: z.object({
      limit: z.coerce.number().int().min(5).max(30).optional(),
    }).strict(),
  },
  'GET /firm-health': {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      status: z.enum(['healthy', 'watch', 'at_risk', 'critical']).optional(),
      search: z.string().trim().max(100).optional(),
    }).strict(),
  },
  'GET /search': {
    query: z.object({
      q: z.string().trim().max(100).optional(),
      types: z.string().trim().optional(),
      limit: z.coerce.number().int().min(1).max(25).optional(),
    }).strict(),
  },
  'GET /audit-logs': { query: passthroughQuery },
  'GET /plans': { query: passthroughQuery },
  'GET /pilot-readiness': { query: passthroughQuery },
  'GET /feature-flags': { query: passthroughQuery },
  'PATCH /feature-flags/:key': {
    params: z.object({ key: z.string().trim().min(1).max(100) }),
    body: z.object({
      enabledGlobally: z.boolean().optional(),
      rolloutStage: z.enum(['off', 'internal', 'pilot', 'beta', 'general']).optional(),
      firmIds: z.array(objectIdString).max(100).optional(),
      notes: z.string().trim().max(500).optional(),
    }).strict().refine((data) => Object.keys(data).length > 0, { message: 'At least one editable field is required.' }),
  },

  'POST /firms': {
    body: z.object({
      name: nonEmptyString,
      slug: z.string().trim().min(1).optional(),
    }).strict(),
  },
  'GET /firms': { query: passthroughQuery },
  'PATCH /firms/:id': {
    params: firmIdParams,
    body: z.object({}).strict(),
  },
  'PATCH /firms/:id/status': {
    params: firmIdParams,
    body: z.object({
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    }).strict(),
  },
  'PATCH /firms/:id/activate': {
    params: firmIdParams,
    body: z.object({}).strict(),
  },
  'PATCH /firms/:id/deactivate': {
    params: firmIdParams,
    body: z.object({}).strict(),
  },
  'POST /firms/:id/disable': {
    params: firmIdParams,
    body: z.object({}).strict(),
  },

  'PATCH /firms/:firmId/plan-capacity': {
    params: firmIdParams2,
    body: z.object({
      plan: z.enum(['pilot', 'starter', 'professional', 'enterprise']).optional(),
      maxUsers: z.coerce.number().int().min(1).max(500).optional(),
      subscriptionStatus: z.string().trim().max(100).nullable().optional(),
      billingStatus: z.string().trim().max(100).nullable().optional(),
    }).strict().refine((data) => Object.keys(data).length > 0, { message: 'At least one editable field is required.' }),
  },

  'POST /firms/:firmId/admin': {
    params: firmIdParams2,
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email(),
    }).strict(),
  },
  'POST /firms/:firmId/admins': {
    params: firmIdParams2,
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email(),
    }).strict(),
  },

  'POST /firms/:firmId/admin/resend-access': {
    params: firmIdParams2,
    body: z.object({}).strict(),
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
    }).strict(),
  },
  'PATCH /firms/:firmId/admins/:adminId/status': {
    params: firmIdAndAdminParams,
    body: z.object({
      isActive: z.boolean().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    }).strict(),
  },
  'POST /firms/:firmId/admin/force-reset': {
    params: firmIdParams2,
    body: z.object({}).strict(),
  },
  'POST /firms/:firmId/admins/:adminId/force-reset': {
    params: firmIdAndAdminParams,
    body: z.object({}).strict(),
  },
  'DELETE /firms/:firmId/admins/:adminId': {
    params: firmIdAndAdminParams,
  },

  'POST /switch-firm': {
    body: z.object({
      firmId: objectIdString,
    }).strict(),
  },
  'POST /exit-firm': {
    body: z.object({}).strict(),
  },
  'POST /ai-assistant/chat': {
    body: z.object({
      mode: z.enum(['Product Advisor', 'Developer Advisor', 'Marketing Advisor']),
      message: z.string().trim().min(1).max(4000),
      conversationId: z.string().trim().optional(),
    }).strict(),
  },
};

