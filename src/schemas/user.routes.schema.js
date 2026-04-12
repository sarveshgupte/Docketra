const { z, nonEmptyString } = require('./common');

module.exports = {
  'PATCH /mark-update-seen': {
    body: z.object({
      updateId: nonEmptyString,
    }).strip(),
  },
  'PATCH /tutorial/complete': {
    body: z.object({}).strip(),
  },
  'GET /': {
    query: z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().optional(),
      role: nonEmptyString.optional(),
      isActive: z.enum(['true', 'false']).optional(),
    }).passthrough(),
  },
  'GET /:id': {
    params: z.object({ id: nonEmptyString }),
  },
  'POST /': {
    body: z.object({
      email: z.string().trim().email(),
      role: z.enum(['SUPER_ADMIN', 'Admin', 'Employee']).optional(),
      name: nonEmptyString.optional(),
    }).passthrough(),
  },
  'PUT /:id': {
    params: z.object({ id: nonEmptyString }),
    body: z.object({
      firmId: z.undefined().optional(),
      xID: z.undefined().optional(),
      name: nonEmptyString.optional(),
      role: z.enum(['SUPER_ADMIN', 'Admin', 'Employee']).optional(),
      isActive: z.boolean().optional(),
    }).passthrough(),
  },
  'PATCH /:xID/status': {
    params: z.object({ xID: z.string().trim().regex(/^X\d{6}$/i) }),
    body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) }).passthrough(),
  },
  'DELETE /:id': {
    params: z.object({ id: nonEmptyString }),
  },
};
