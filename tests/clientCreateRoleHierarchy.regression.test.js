#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildRoleContext } = require('../src/services/authorization.service');

assert(buildRoleContext('PRIMARY_ADMIN').permissions.includes('CLIENT_MANAGE'), 'PRIMARY_ADMIN should have CLIENT_MANAGE');
assert(buildRoleContext('ADMIN').permissions.includes('CLIENT_MANAGE'), 'ADMIN should have CLIENT_MANAGE');
assert(buildRoleContext('MANAGER').permissions.includes('CLIENT_MANAGE'), 'MANAGER should have CLIENT_MANAGE');
assert(!buildRoleContext('USER').permissions.includes('CLIENT_MANAGE'), 'USER should not have CLIENT_MANAGE by default');
assert(!buildRoleContext('USER').permissions.includes('CLIENT_CREATE'), 'USER should not have CLIENT_CREATE by default');

console.log('clientCreateRoleHierarchy.regression.test.js passed');
