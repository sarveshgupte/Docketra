const { z } = require('zod');

const emptyObjectSchema = z.object({}).strict();
const POLLUTION_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const isDangerousKey = (key) => (
  POLLUTION_KEYS.has(key)
  || key.startsWith('$')
  || key.includes('.')
);

const sanitizeInput = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeInput(item));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      if (isDangerousKey(key)) {
        return acc;
      }
      acc[key] = sanitizeInput(nestedValue);
      return acc;
    }, {});
  }
  return value;
};

const validateRequest = (schema = {}) => (req, res, next) => {
  const errors = [];
  const sections = ['body', 'params', 'query'];

  for (const section of sections) {
    const sectionSchema = schema[section] || emptyObjectSchema;
    const parseResult = sectionSchema.safeParse(sanitizeInput(req[section] || {}));

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
      const key = `${method.toUpperCase()} ${path}`;
      const routeSchema = routeSchemas[key];
      if (routeSchema === undefined) {
        throw new Error(
          `[Validation] Missing schema for route: ${key}. ` +
          'Every route must have an explicit validation schema. ' +
          'Add an entry to the corresponding src/schemas/<route-file>.routes.schema.js file. ' +
          'See docs/VALIDATION.md for guidance.',
        );
      }
      return original(path, validateRequest(routeSchema), ...handlers);
    };
  });

  return router;
};

module.exports = {
  validateRequest,
  applyRouteValidation,
  emptyObjectSchema,
  sanitizeInput,
};
