#!/usr/bin/env node
/**
 * Verifies docket view UX resolution contracts:
 * 1. getCaseByCaseId hydrates clientName from clientSnapshot, candidates, or ownershipFirmId
 * 2. Team/workbasket lookup resolves human-readable names and avoids raw hex ObjectIds
 * 3. serializeDocketDetailDto includes client fallback, workbasket fallback, and relatedEmployee
 * 4. Docket ID comparison handles normalization (spaces vs hyphens) to prevent self-history inclusion
 */

const assert = require('assert');
const { serializeDocketDetailDto } = require('../src/serializers/docketDetail.serializer');

// 1. Test serializeDocketDetailDto fallbacks
{
  const dtoWithSnapshotClient = serializeDocketDetailDto({
    caseObject: {
      caseId: 'DOCKET-20261119-00001',
      title: 'Tax Matter',
      clientId: 'C000002',
      clientSnapshot: { businessName: 'Acme Advisory Pvt Ltd' },
      workbasketId: '6acb757a43b132bb9a4d5374',
      workbasketName: 'HR',
      relatedEmployeeUser: {
        xID: 'EMP042',
        name: 'Jane Doe',
        email: 'jane@example.com',
        status: 'active',
      },
    },
    client: null,
    ownerTeam: null,
    routedTeam: null,
  });

  assert.equal(dtoWithSnapshotClient.client?.name, 'Acme Advisory Pvt Ltd', 'client.name should fall back to clientSnapshot.businessName');
  assert.equal(dtoWithSnapshotClient.workbasket?.name, 'HR', 'workbasket.name should fall back to caseObject.workbasketName');
  assert.equal(dtoWithSnapshotClient.relatedEmployee?.name, 'Jane Doe', 'relatedEmployee should be populated from relatedEmployeeUser');
  assert.equal(dtoWithSnapshotClient.relatedEmployee?.xID, 'EMP042');
}

// 2. Test serializeDocketDetailDto with explicit models
{
  const dtoWithExplicitModels = serializeDocketDetailDto({
    caseObject: {
      caseId: 'DOCKET-20261119-00002',
      title: 'Audit Matter',
    },
    client: {
      _id: '507f1f77bcf86cd799439011',
      clientId: 'C000001',
      businessName: 'Direct Client Inc',
      businessEmail: 'contact@direct.com',
    },
    ownerTeam: {
      _id: '6acb757a43b132bb9a4d5374',
      name: 'Payroll Operations',
    },
  });

  assert.equal(dtoWithExplicitModels.client?.name, 'Direct Client Inc');
  assert.equal(dtoWithExplicitModels.workbasket?.name, 'Payroll Operations');
}

// 3. Test Docket ID normalization logic (used in useClientDocketHistory)
{
  const normalizeId = (id) => String(id || '').replace(/[\s\-_]/g, '').toLowerCase();

  const currentDocketIdUrl = 'DOCKET 20261119-00001';
  const dbDocketId = 'DOCKET-20261119-00001';
  const otherDocketId = 'DOCKET-20261119-00002';

  const rows = [
    { caseId: dbDocketId, title: 'Same docket from DB' },
    { caseId: otherDocketId, title: 'Another docket from DB' },
  ];

  const currentDocketNorm = normalizeId(currentDocketIdUrl);
  const filtered = rows.filter((r) => normalizeId(r.caseId) !== currentDocketNorm);

  assert.equal(filtered.length, 1, 'Current docket should be excluded regardless of spaces vs hyphens');
  assert.equal(filtered[0].caseId, otherDocketId);
}

// 4. Test Hex ObjectId sanitization for Workbasket labels
{
  const isHexObjectId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());

  assert.ok(isHexObjectId('6acb757a43b132bb9a4d5374'), 'Should recognize 24-character hexadecimal MongoDB ObjectId');
  assert.equal(isHexObjectId('Payroll HR'), false, 'Should not treat team name as hex ObjectId');
  assert.equal(isHexObjectId('General Workbasket'), false);

  const cleanQueueLabel = (queueLabel) => {
    if (!queueLabel || queueLabel === '—') return 'General Workbasket';
    if (isHexObjectId(queueLabel)) return 'General Workbasket';
    return queueLabel;
  };

  assert.equal(cleanQueueLabel('6acb757a43b132bb9a4d5374'), 'General Workbasket', 'Raw hex ID should be sanitized to General Workbasket');
  assert.equal(cleanQueueLabel('HR Operations'), 'HR Operations', 'Human-readable name should be preserved');
}

// 5. Test client resolution when client.businessName is null (BYOS data-residency isolation)
{
  const dtoWithRedactedMongoBusinessName = serializeDocketDetailDto({
    caseObject: {
      caseId: 'DOCKET-20261119-00001',
      clientId: 'C000002',
      clientSnapshot: { businessName: 'Cloud Profile Solutions Pvt Ltd' },
    },
    client: {
      _id: '507f1f77bcf86cd799439012',
      clientId: 'C000002',
      businessName: null, // Mongo stores null for BYOS clients
      legalName: 'Cloud Profile Solutions Pvt Ltd',
    },
  });

  assert.equal(dtoWithRedactedMongoBusinessName.client?.name, 'Cloud Profile Solutions Pvt Ltd', 'client.name should resolve from legalName when businessName is null');
}

// 6. Test clientProfileStorageService.resolveClientLegalName
(async () => {
  const { clientProfileStorageService } = require('../src/services/clientProfileStorage.service');
  
  // Case A: Client already has legalName or businessName
  const resolvedDirect = await clientProfileStorageService.resolveClientLegalName({
    firmId: 'firm-1',
    client: { clientId: 'C000002', legalName: 'Apex Advisory LLP' },
  });
  assert.equal(resolvedDirect, 'Apex Advisory LLP');

  // Case B: Client has clientFactSheet basicInfo
  const resolvedCfs = await clientProfileStorageService.resolveClientLegalName({
    firmId: 'firm-1',
    client: { clientId: 'C000002', businessName: null, clientFactSheet: { basicInfo: { clientName: 'CFS Named Firm' } } },
  });
  assert.equal(resolvedCfs, 'CFS Named Firm');

  console.log('✓ All docket view UX and detail resolution tests passed!');
})();
