#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildRoleContext } = require('../src/services/authorization.service');

const clientsPage = fs.readFileSync(path.join(__dirname, '..', 'ui', 'src', 'pages', 'ClientsPage.jsx'), 'utf8');
const navSource = fs.readFileSync(path.join(__dirname, '..', 'ui', 'src', 'constants', 'platformNavigation.js'), 'utf8');
const protectedRoute = fs.readFileSync(path.join(__dirname, '..', 'ui', 'src', 'components', 'auth', 'ProtectedRoute.jsx'), 'utf8');
const clientController = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'client.controller.js'), 'utf8');
const softDeleteTest = fs.readFileSync(path.join(__dirname, 'softDelete.test.js'), 'utf8');

assert(buildRoleContext('PRIMARY_ADMIN').permissions.includes('CLIENT_MANAGE'), 'PRIMARY_ADMIN should have CLIENT_MANAGE');
assert(buildRoleContext('ADMIN').permissions.includes('CLIENT_MANAGE'), 'ADMIN should have CLIENT_MANAGE');
assert(!buildRoleContext('MANAGER').permissions.includes('CLIENT_MANAGE'), 'MANAGER should not have CLIENT_MANAGE by default');

assert(navSource.includes("if (item.id === 'clients') return canManageClients(accessContext);"), 'Clients sidebar visibility must be guarded by canManageClients');
assert(protectedRoute.includes('requireClientManage'), 'Clients route must use requireClientManage guard');
assert(clientsPage.includes('const isProtectedClient = client?.isDefaultClient || client?.isSystemClient || client?.isInternal;'), 'Default/system clients must be protected in UI actions');
assert(clientController.includes('await ensureDefaultClientForFirm('), 'Client list must self-heal missing default client');
assert(clientController.includes('Default client cannot be deactivated'), 'Default/system client deactivation must be blocked');
assert(softDeleteTest.includes('Default client cannot be deleted'), 'Default client deletion must be blocked');

console.log('clientManagementAdminAndDefaultClient.regression.test.js passed');
