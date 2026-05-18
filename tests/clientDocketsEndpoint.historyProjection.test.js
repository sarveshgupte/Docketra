const assert = require('node:assert/strict');

const controllerPath = require.resolve('../src/controllers/client.controller');
const modelPath = require.resolve('../src/models/Case.model');

const clear = (p) => { delete require.cache[p]; };

(async () => {
  const rows = [{ caseId: 'D-1', category: 'Tax', subcategory: 'GST', lifecycle: 'OPEN', createdAt: new Date() }];
  const queries = [];
  const projection = [];

  clear(controllerPath);
  clear(modelPath);

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      find: (query) => {
        queries.push(query);
        return {
          sort: () => ({
            limit: () => ({
              select: (value) => {
                projection.push(value);
                return { lean: async () => rows };
              },
            }),
          }),
        };
      },
    },
  };

  const { listClientDockets } = require('../src/controllers/client.controller');

  const req = {
    params: { clientId: 'C-101' },
    query: { order: 'desc', limit: '20' },
    user: { firmId: 'FIRM-1' },
  };
  let payload;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };

  await listClientDockets(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(payload.data, rows);
  assert.deepEqual(queries[0], { firmId: 'FIRM-1', clientId: 'C-101' }, 'Query must enforce firm and client scoping.');
  const selected = String(projection[0] || '');
  [
    'category', 'subCategory', 'status', 'lifecycle', 'createdAt', 'updatedAt', 'resolvedAt', 'filedAt', 'closedAt', 'completedAt',
    'assignedToName', 'ownerName', 'workbasketName', 'queueName',
  ].forEach((field) => assert.ok(selected.includes(field), `Projection must include ${field}`));

  console.log('clientDocketsEndpoint.historyProjection.test.js passed');
})();
