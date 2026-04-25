#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');

assert.ok(
  serverSource.includes("app.post('/api/cms/submit', contactLimiter"),
  'server should explicitly deprecate legacy /api/cms/submit endpoint'
);

assert.ok(
  serverSource.includes('ROUTE_DEPRECATED'),
  'legacy /api/cms/submit endpoint should return ROUTE_DEPRECATED code'
);

assert.ok(
  !serverSource.includes("const cmsRoutes = require('./routes/cms.routes');"),
  'legacy cms.routes should no longer be mounted'
);

console.log('Legacy CMS submit deprecation checks passed.');
