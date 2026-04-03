const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({
      activeOnly: z.coerce.boolean().optional(),
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
