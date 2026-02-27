const { z } = require('zod');

const emptyObjectSchema = z.object({}).passthrough();

const validateRequest = (schema = {}) => (req, res, next) => {
  const errors = [];
  const sections = ['body', 'params', 'query'];

  for (const section of sections) {
    const sectionSchema = schema[section] || emptyObjectSchema;
    const parseResult = sectionSchema.safeParse(req[section] || {});

    if (!parseResult.success) {
      errors.push(
        ...parseResult.error.issues.map((issue) => ({
          location: section,
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        }))
      );
    } else {
      req[section] = parseResult.data;
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        details: errors,
      },
    });
  }

  return next();
};

const applyRouteValidation = (router, routeSchemas = {}) => {
  const methods = ['get', 'post', 'put', 'patch', 'delete'];

  methods.forEach((method) => {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) => {
      const routeSchema = routeSchemas[`${method.toUpperCase()} ${path}`] || {};
      return original(path, validateRequest(routeSchema), ...handlers);
    };
  });

  return router;
};

module.exports = {
  validateRequest,
  applyRouteValidation,
  emptyObjectSchema,
};
