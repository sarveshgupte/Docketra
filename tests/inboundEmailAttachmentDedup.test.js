#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const attachments = [];
const uploadCalls = [];
const usageCalls = [];

const caseByToken = {
  '550e8400-e29b-41d4-a716-446655440000': {
    caseId: 'DCK-1001',
    caseNumber: 'DCK-1001',
    firmId: 'FIRM_A',
    status: 'Open',
    drive: { attachmentsFolderId: 'folder-a' },
  },
  '550e8400-e29b-41d4-a716-446655440001': {
    caseId: 'DCK-2001',
    caseNumber: 'DCK-2001',
    firmId: 'FIRM_B',
    status: 'Open',
    drive: { attachmentsFolderId: 'folder-b' },
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../models/Case.model') {
    return {
      findOne: ({ publicEmailToken }) => ({
        lean: async () => caseByToken[publicEmailToken] || null,
      }),
    };
  }
  if (request === '../models/Comment.model') return { create: async () => ({}) };
  if (request === '../models/Attachment.model') {
    return {
      findOne: (query) => ({
        lean: async () => (
          attachments.find(
            (attachment) =>
              attachment.firmId === query.firmId &&
              attachment.contentHash === query.contentHash &&
              attachment.isDuplicate === false
          ) || null
        ),
      }),
      create: async (doc) => {
        attachments.push(doc);
        return doc;
      },
    };
  }
  if (request === '../models/EmailThread.model') return { create: async () => ({ _id: 'thread-1' }) };
  if (request === '../models/User.model') return { findOne: async () => null };
  if (request === '../models/TenantStorageConfig.model') {
    return {
      findOne: ({ tenantId }) => ({
        lean: async () => ({
          tenantId,
          isActive: true,
          status: 'ACTIVE',
          compressionEnabled: false,
          compressionLevel: 6,
        }),
      }),
    };
  }
  if (request === '../storage/StorageProviderFactory') {
    return {
      getProviderForTenant: async () => ({
        uploadFile: async (firmId, folderId, buffer, options) => {
          uploadCalls.push({ firmId, folderId, size: buffer.length, name: options?.name });
          return { fileId: `drive-${uploadCalls.length}` };
        },
      }),
    };
  }
  if (request === '../services/email.service') return { sendEmail: async () => ({ success: true }) };
  if (request === '../queues/inboundEmail.queue') return { enqueueInboundEmailJob: async () => ({ id: 'job-1' }) };
  if (request === '../services/cfsDrive.service') return { getFolderIdForFileType: () => 'attachments-folder' };
  if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
  if (request === '../utils/updateTenantStorageUsage') {
    return {
      updateTenantStorageUsage: async (tenantId, bytesDelta) => {
        usageCalls.push({ tenantId, bytesDelta });
        return { tenantId, totalBytes: bytesDelta };
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

const { processInboundEmailPayload } = require('../src/controllers/inboundEmail.controller');

async function run() {
  console.log('Running inbound email attachment dedup tests...');
  try {
    const sharedAttachment = {
      filename: 'evidence.txt',
      contentBase64: Buffer.from('same-content').toString('base64'),
      size: 12,
    };

    await processInboundEmailPayload({
      to: 'case-550e8400-e29b-41d4-a716-446655440000@inbound.docketra.com',
      from: 'external@example.com',
      attachments: [sharedAttachment],
    });

    assert.strictEqual(uploadCalls.length, 1);
    assert.strictEqual(usageCalls.length, 1);
    assert.strictEqual(attachments[0].isDuplicate, false);
    assert.ok(attachments[0].contentHash);

    await processInboundEmailPayload({
      to: 'case-550e8400-e29b-41d4-a716-446655440000@inbound.docketra.com',
      from: 'external@example.com',
      attachments: [sharedAttachment],
    });

    assert.strictEqual(uploadCalls.length, 1, 'Duplicate should reuse existing stored file');
    assert.strictEqual(usageCalls.length, 1, 'Duplicate should not increment tenant usage');
    assert.strictEqual(attachments.length, 2);
    assert.strictEqual(attachments[1].isDuplicate, true);
    assert.strictEqual(attachments[1].driveFileId, attachments[0].driveFileId);

    await processInboundEmailPayload({
      to: 'case-550e8400-e29b-41d4-a716-446655440001@inbound.docketra.com',
      from: 'external@example.com',
      attachments: [sharedAttachment],
    });

    assert.strictEqual(uploadCalls.length, 2, 'Cross-tenant identical content must upload separately');
    assert.strictEqual(usageCalls.length, 2, 'Cross-tenant storage is accounted independently');
    assert.strictEqual(attachments[2].isDuplicate, false);

    console.log('All inbound email attachment dedup tests passed.');
  } catch (error) {
    console.error('inboundEmailAttachmentDedup tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
