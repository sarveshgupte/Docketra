const assert = require('assert');
const { serializeDocketDetailDto } = require('../src/serializers/docketDetail.serializer');

(() => {
  const dto = serializeDocketDetailDto({
    caseObject: {
      caseId: 'DKT-1001',
      title: 'Title',
      description: 'Desc',
      lifecycle: 'OPEN',
      status: 'new',
      dueDate: '2026-05-20T00:00:00.000Z',
      slaDueAt: '2026-05-21T00:00:00.000Z',
      pendingUntil: null,
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T01:00:00.000Z',
      isInternal: false,
      accessMode: { canEdit: true },
      assignedToXID: 'X-1',
      assignedToName: 'Assignee',
      category: 'Billing',
      subcategory: 'Invoice',
    },
    client: { _id: 'c1', clientId: 'CL-1', businessName: 'Acme', businessEmail: 'a@b.com', primaryContactNumber: '123' },
    ownerTeam: { _id: 't1', name: 'Queue A' },
    attachments: [{ createdAt: '2026-05-18T03:00:00.000Z' }],
    timeline: [{ timestamp: '2026-05-18T05:00:00.000Z' }],
  });

  assert.equal(dto.docketId, 'DKT-1001');
  assert.equal(dto.client.name, 'Acme');
  assert.equal(dto.assignee.xID, 'X-1');
  assert.equal(dto.workbasket.name, 'Queue A');
  assert.equal(dto.attachmentsSummary.total, 1);
  assert.equal(dto.timelineSummary.total, 1);
})();

console.log('docketDetail.serializer.test.js passed');
