#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const routeSchemas = require('../src/schemas/auth.routes.schema');

(() => {
  const schema = routeSchemas['GET /debug-cookie-state'];
  assert.ok(schema, 'auth route schema must include GET /debug-cookie-state');
  assert.ok(schema.query, 'GET /debug-cookie-state schema must define query validation');
  assert.deepStrictEqual(schema.query.parse({}), {}, 'GET /debug-cookie-state must allow empty query');
})();

(() => {
  const controllerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'auth.controller.js'), 'utf8');

  assert(
    controllerSource.includes("if (!authSessionService.isAuthDebugDiagnosticsEnabled())")
      && controllerSource.includes("return res.status(404).json({ success: false, message: 'Not found' });"),
    'debug cookie diagnostics endpoint must return 404 when AUTH_DEBUG_DIAGNOSTICS is not true',
  );

  assert(
    controllerSource.includes('cookieNames: Array.from(new Set(cookieNames))'),
    'debug cookie diagnostics endpoint should expose cookie names metadata',
  );

  assert(
    controllerSource.includes('hasAccessTokenCookie: Boolean(accessToken)')
      && controllerSource.includes('hasRefreshTokenCookie: Boolean(refreshToken)'),
    'debug cookie diagnostics endpoint should expose boolean cookie-presence metadata',
  );

  const responseSegment = controllerSource.slice(
    controllerSource.indexOf('return res.json({', controllerSource.indexOf('const debugCookieState')),
    controllerSource.indexOf('});\n};', controllerSource.indexOf('const debugCookieState')),
  );

  assert(!responseSegment.includes('accessToken,'), 'diagnostics response must not include access token values');
  assert(!responseSegment.includes('refreshToken,'), 'diagnostics response must not include refresh token values');
})();

console.log('auth debug diagnostics tests passed');
