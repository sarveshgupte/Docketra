const { z, nonEmptyString, objectIdString, queryBoolean } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({
      activeOnly: queryBoolean.optional(),
    }).passthrough(),
  },
  'GET /:id': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
  },
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
    }).passthrough(),
  },
  'PUT /:id': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
    body: z.object({
      name: nonEmptyString.optional(),
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
    }).passthrough(),
  },
  'PATCH /:id/status': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
    body: z.object({ isActive: z.boolean() }).passthrough(),
  },
  'DELETE /:id': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
  },
  'POST /:id/subcategories': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
    body: z.object({
      name: nonEmptyString,
      workbasketId: objectIdString,
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
    }).passthrough(),
  },
  'PUT /:id/subcategories/:subcategoryId': {
    params: z.object({
      id: z.union([objectIdString, nonEmptyString]),
      subcategoryId: nonEmptyString,
    }),
    body: z.object({
      name: nonEmptyString.optional(),
      workbasketId: objectIdString.optional(),
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
    }).passthrough(),
  },
  'PATCH /:id/subcategories/:subcategoryId/status': {
    params: z.object({
      id: z.union([objectIdString, nonEmptyString]),
      subcategoryId: nonEmptyString,
    }),
    body: z.object({ isActive: z.boolean() }).passthrough(),
  },
  'DELETE /:id/subcategories/:subcategoryId': {
    params: z.object({
      id: z.union([objectIdString, nonEmptyString]),
      subcategoryId: nonEmptyString,
    }),
  },
};
