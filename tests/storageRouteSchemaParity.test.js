#!/usr/bin/env node
const assert = require('assert');

const storageRouter = require('../src/routes/storage.routes');
const storageRouteSchemas = require('../src/schemas/storage.routes.schema');

function collectRouteKeys(router) {
  const keys = new Set();
  const stack = [...(router.stack || [])];

  while (stack.length > 0) {
    const layer = stack.pop();
    if (!layer) continue;

    if (layer.route && layer.route.path && layer.route.methods) {
      const path = layer.route.path;
      Object.entries(layer.route.methods).forEach(([method, enabled]) => {
        if (enabled) keys.add(`${method.toUpperCase()} ${path}`);
      });
      continue;
    }

    if (layer.handle && Array.isArray(layer.handle.stack)) {
      stack.push(...layer.handle.stack);
    }
  }

  return keys;
}

(function run() {
  const routeKeys = collectRouteKeys(storageRouter);
  const schemaKeys = new Set(Object.keys(storageRouteSchemas));

  assert(routeKeys.size > 0, 'Expected storage router to register routes.');

  for (const routeKey of routeKeys) {
    assert(schemaKeys.has(routeKey), `Missing schema for storage route: ${routeKey}`);
  }

  for (const schemaKey of schemaKeys) {
    assert(routeKeys.has(schemaKey), `Stale storage schema key (no matching route): ${schemaKey}`);
  }

  console.log('[storageRouteSchemaParity] All storage routes have matching validation schemas.');
})();
