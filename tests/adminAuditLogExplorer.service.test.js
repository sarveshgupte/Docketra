#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const toObjectId = (value) => ({ __oid: String(value) });

const baseRows = [
  {
    _id: 'log-1',
    firmId: toObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'),
    actorId: { _id: 'u1', name: 'Primary Admin', email: 'primary@example.com' },
    targetId: { _id: 'u2', name: 'Admin User', email: 'admin@example.com' },
    action: 'ROLE_UPDATED',
    metadata: {
      module: 'users',
      targetEntity: 'USER',
      severity: 'high',
      apiToken: 'never-return-me',
    },
    createdAt: new Date('2026-04-20T12:00:00Z'),
  },
  {
    _id: 'log-2',
    firmId: toObjectId('bbbbbbbbbbbbbbbbbbbbbbbb'),
    actorId: { _id: 'u9', name: 'Other Firm Admin' },
    targetId: null,
    action: 'CATEGORY_CONFIG_UPDATED',
    metadata: { module: 'categories', targetEntity: 'FIRM', severity: 'medium' },
    createdAt: new Date('2026-04-21T12:00:00Z'),
  },
];

const normalizeOid = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.__oid) return String(value.__oid);
  return String(value);
};

const matchesQuery = (row, query) => {
  if (query.firmId && normalizeOid(row.firmId) !== normalizeOid(query.firmId)) return false;
  if (query.actorId && normalizeOid(row.actorId?._id) !== normalizeOid(query.actorId)) return false;
  if (query.action && row.action !== query.action) return false;
  if (query['metadata.module'] && row.metadata?.module !== query['metadata.module']) return false;
  if (query['metadata.targetEntity'] && row.metadata?.targetEntity !== query['metadata.targetEntity']) return false;
  if (query['metadata.severity'] && row.metadata?.severity !== query['metadata.severity']) return false;
  if (query.createdAt?.$gte && row.createdAt < query.createdAt.$gte) return false;
  if (query.createdAt?.$lte && row.createdAt > query.createdAt.$lte) return false;
  return true;
};

const buildFindChain = (query) => {
  const filtered = baseRows.filter((row) => matchesQuery(row, query));
  const chain = {
    _rows: filtered,
    sort() {
      this._rows = [...this._rows].sort((a, b) => b.createdAt - a.createdAt);
      return this;
    },
    skip(n) {
      this._rows = this._rows.slice(Number(n) || 0);
      return this;
    },
    limit(n) {
      this._rows = this._rows.slice(0, Number(n) || this._rows.length);
      return this;
    },
    populate() { return this; },
    lean() { return Promise.resolve(this._rows); },
  };
  return chain;
};

const AdminAuditLogMock = {
  countDocuments: async (query) => baseRows.filter((row) => matchesQuery(row, query)).length,
  find: (query) => buildFindChain(query),
};

const mongooseMock = {
  Types: {
    ObjectId: class ObjectId {
      constructor(value) {
        this.__oid = String(value);
      }
      toString() {
        return this.__oid;
      }
      static isValid(value) {
        return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
      }
    },
  },
};

Module._load = function(request, parent, isMain) {
  if (request === '../models/AdminAuditLog.model') {
    return AdminAuditLogMock;
  }
  if (request === 'mongoose') {
    return mongooseMock;
  }
  return originalLoad.apply(this, arguments);
};

async function run() {
  try {
    const { getAuditLogs } = require('../src/services/adminActionAudit.service');

    const tenantScoped = await getAuditLogs({
      firmId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      page: 1,
      limit: 25,
    });

    assert.strictEqual(tenantScoped.data.length, 1, 'should only return logs for the requested firm');
    assert.strictEqual(tenantScoped.data[0]._id, 'log-1');
    assert.strictEqual(tenantScoped.pagination.total, 1, 'pagination total should be tenant-scoped');

    const filtered = await getAuditLogs({
      firmId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      actor: 'u1',
      actionType: 'role_updated',
      module: 'users',
      targetEntity: 'user',
      severity: 'HIGH',
      startDate: '2026-04-19T00:00:00.000Z',
      endDate: '2026-04-22T00:00:00.000Z',
      page: 1,
      limit: 25,
    });

    assert.strictEqual(filtered.data.length, 1, 'combined filters should keep matching rows');
    assert.strictEqual(filtered.data[0].module, 'users', 'module should be present in response');
    assert.strictEqual(filtered.data[0].severity, 'high', 'severity should be normalized to lowercase');
    assert.ok(!Object.prototype.hasOwnProperty.call(filtered.data[0].metadata, 'apiToken'), 'sensitive metadata keys must be removed');

    const paged = await getAuditLogs({
      firmId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      page: 2,
      limit: 1,
    });
    assert.strictEqual(paged.pagination.page, 2, 'page should be reflected in pagination metadata');
    assert.strictEqual(paged.pagination.limit, 1, 'limit should be reflected in pagination metadata');

    console.log('✓ admin audit explorer service enforces tenant scope, filtering, and redaction');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  console.error('adminAuditLogExplorer.service.test failed:', error);
  process.exit(1);
});
