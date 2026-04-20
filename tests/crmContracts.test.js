#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const invoiceRoutes = read('src/routes/invoice.routes.js');
const invoiceSchema = read('src/schemas/invoice.routes.schema.js');
const crmApi = read('ui/src/api/crm.api.js');

assert.ok(invoiceRoutes.includes("router.patch('/:id/paid'"), 'Invoice routes should expose PATCH /:id/paid');
assert.ok(invoiceRoutes.includes("router.patch('/:id/pay'"), 'Invoice routes should keep legacy PATCH /:id/pay route for backward compatibility');
assert.ok(invoiceSchema.includes("'PATCH /:id/paid'"), 'Invoice schema should validate PATCH /:id/paid');
assert.ok(invoiceSchema.includes("'PATCH /:id/pay'"), 'Invoice schema should validate PATCH /:id/pay');
assert.ok(crmApi.includes('http.patch(`/invoices/${id}/paid`)'), 'CRM API should mark invoices paid using /paid route');

console.log('crmContracts.test.js passed');
