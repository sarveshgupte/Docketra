#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const express = require('express');
const request = require('supertest');
const routeSchemas = require('../src/schemas/auth.routes.schema');

function passThrough(_req, _res, next) {
  return next();
}

async function testDebugCookieStateRouteReturns404InProduction() {
  const originalLoad = Module._load;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDebugDiagnostics = process.env.AUTH_DEBUG_DIAGNOSTICS;
  let authenticateCalls = 0;
  let debugHandlerCalls = 0;

  Module._load = function (requestName, parent, isMain) {
    if (requestName === '../controllers/auth.controller') {
      return new Proxy({}, {
        get: (_target, property) => {
          if (property === 'debugCookieState') {
            return (_req, res) => {
              debugHandlerCalls += 1;
              return res.json({ success: true });
            };
          }
          return (_req, res) => res.status(501).json({ success: false, message: 'mocked' });
        },
      });
    }

    if (requestName === '../middleware/auth.middleware') {
      return {
        authenticate: (_req, _res, next) => {
          authenticateCalls += 1;
          return next();
        },
      };
    }

    if (requestName === '../middleware/attachFirmFromSlug.middleware') {
      return {
        attachFirmFromSlug: passThrough,
        attachOptionalFirmFromSlug: passThrough,
      };
    }

    if (requestName === '../middleware/firmContext.middleware') {
      return { attachFirmContext: passThrough };
    }

    if (requestName === '../middleware/permission.middleware') {
      return { authorizeFirmPermission: () => passThrough };
    }

    if (requestName === '../middleware/csrfOrigin.middleware') {
      return { enforceSameOriginForCookieAuth: passThrough };
    }

    if (requestName === '../middleware/turnstile.middleware') {
      return {
        requireTurnstileForSignup: passThrough,
        requireTurnstileForForgotPassword: passThrough,
        requireTurnstileForLoginVerify: passThrough,
      };
    }

    if (requestName === '../middleware/rateLimiters') {
      return new Proxy({}, { get: () => passThrough });
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DEBUG_DIAGNOSTICS = 'true';
    delete require.cache[require.resolve('../src/routes/auth.routes.js')];

    const authRoutes = require('../src/routes/auth.routes.js');
    const app = express();
    app.use('/auth', authRoutes);

    const response = await request(app)
      .get('/auth/debug-cookie-state')
      .set('Cookie', 'accessToken=redacted; refreshToken=redacted');

    assert.strictEqual(response.status, 404, 'debug diagnostics route must return 404 in production');
    assert.strictEqual(authenticateCalls, 0, 'production debug diagnostics route must not invoke auth middleware');
    assert.strictEqual(debugHandlerCalls, 0, 'production debug diagnostics route must not invoke diagnostics handler');
  } finally {
    delete require.cache[require.resolve('../src/routes/auth.routes.js')];
    Module._load = originalLoad;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalDebugDiagnostics === undefined) delete process.env.AUTH_DEBUG_DIAGNOSTICS;
    else process.env.AUTH_DEBUG_DIAGNOSTICS = originalDebugDiagnostics;
  }
}

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
    controllerSource.indexOf('  });', controllerSource.indexOf('return res.json({', controllerSource.indexOf('const debugCookieState'))),
  );

  assert(!/^\s*accessToken\s*[:,]/m.test(responseSegment), 'diagnostics response must not include access token values');
  assert(!/^\s*refreshToken\s*[:,]/m.test(responseSegment), 'diagnostics response must not include refresh token values');
})();

(async function run() {
  await testDebugCookieStateRouteReturns404InProduction();
  console.log('auth debug diagnostics tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
