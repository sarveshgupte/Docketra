const crypto = require('crypto');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const log = require('../utils/log');

const DOCKETS_HISTORY_OBJECT_NAME = 'dockets_history.json';
const DOCKETS_HISTORY_SCHEMA_VERSION = 1;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function buildManagedFallbackClient() {
  const bucket = process.env.MANAGED_STORAGE_S3_BUCKET;
  const region = process.env.MANAGED_STORAGE_S3_REGION;
  if (!bucket || !region) return null;

  const credentials = process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID && process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY,
        ...(process.env.MANAGED_STORAGE_S3_SESSION_TOKEN ? { sessionToken: process.env.MANAGED_STORAGE_S3_SESSION_TOKEN } : {}),
      }
    : undefined;

  return {
    type: 'managed_fallback_s3',
    bucket,
    region,
    prefix: (process.env.MANAGED_STORAGE_S3_PREFIX || 'docketra-managed').replace(/^\/+|\/+$/g, ''),
    client: new S3Client({ region, credentials }),
  };
}

async function resolveStorageBackend(firmId) {
  try {
    const provider = await StorageProviderFactory.getProvider(firmId);
    return { type: 'firm_connected', provider };
  } catch (error) {
    const fallback = buildManagedFallbackClient();
    if (!fallback) {
      return null;
    }
    return fallback;
  }
}

class ClientDocketHistoryStorageService {
  /**
   * Build the structured JSON docket history snapshot for a client
   */
  async buildDocketHistoryPayload(firmId, clientId) {
    const [client, dockets] = await Promise.all([
      Client.findOne({ firmId, clientId, status: { $ne: 'deleted' } })
        .select('clientId businessName clientName')
        .lean(),
      Case.find({ firmId, clientId })
        .sort({ createdAt: -1 })
        .populate('assignedTo', 'name xID')
        .populate('workbasketId', 'name')
        .populate('ownerTeamId', 'name')
        .lean(),
    ]);

    if (!client) return null;

    const mappedDockets = (dockets || []).map((d) => {
      const category = d.category || d.caseCategory || d.workType || d.workTypeName || d.categorySnapshot?.name || null;
      const subcategory = d.subcategory || d.subCategory || d.caseSubCategory || d.subCategoryName || d.subcategoryName || d.subCategorySnapshot?.name || null;
      const workType = d.workType || d.serviceType || category || 'General';
      const assigneeName = d.assignedTo?.name || d.assignedToName || d.assignedToXID || null;
      const assigneeXID = d.assignedTo?.xID || d.assignedToXID || null;
      const teamName = d.workbasketId?.name || d.ownerTeamId?.name || d.workbasketName || null;
      const status = String(d.status || 'OPEN').toUpperCase();

      return {
        docketId: d.caseId || d.caseNumber || String(d._id),
        caseName: d.caseName || d.title || `${workType} - ${client.businessName || 'Client'}`,
        category,
        subcategory,
        workType,
        status,
        lifecycle: d.lifecycle || 'ACTIVE',
        assignedTo: assigneeName ? `${assigneeName}${assigneeXID ? ` (${assigneeXID})` : ''}` : 'Unassigned',
        assignedToXID: assigneeXID,
        team: teamName || 'Default Team',
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
        filedAt: d.filedAt ? new Date(d.filedAt).toISOString() : null,
        resolvedAt: d.resolvedAt ? new Date(d.resolvedAt).toISOString() : null,
        closedAt: d.closedAt ? new Date(d.closedAt).toISOString() : null,
      };
    });

    return {
      schemaVersion: DOCKETS_HISTORY_SCHEMA_VERSION,
      firmId: String(firmId),
      clientId: client.clientId,
      clientName: client.businessName || client.clientName || 'Client',
      lastSyncedAt: new Date().toISOString(),
      totalDockets: mappedDockets.length,
      dockets: mappedDockets,
    };
  }

  /**
   * Synchronize the client's docket history snapshot to BYOS cloud storage
   */
  async syncClientDocketHistory(firmId, clientId) {
    if (!firmId || !clientId) return null;

    try {
      const payload = await this.buildDocketHistoryPayload(firmId, clientId);
      if (!payload) return null;

      const backend = await resolveStorageBackend(firmId);
      if (!backend) {
        log.info('CLIENT_DOCKET_HISTORY_STORAGE_NO_BACKEND', { firmId, clientId });
        return { synced: false, reason: 'NO_STORAGE_BACKEND' };
      }

      const body = JSON.stringify(payload, null, 2);
      const checksum = sha256(body);

      if (backend.type === 'firm_connected') {
        const provider = backend.provider;
        const storageRoot = provider.rootFolderId || null;
        const firmsFolder = await provider.getOrCreateFolder(storageRoot, 'firms');
        const firmFolder = await provider.getOrCreateFolder(firmsFolder, String(firmId));
        const clientsFolder = await provider.getOrCreateFolder(firmFolder, 'clients');
        const clientFolder = await provider.getOrCreateFolder(clientsFolder, String(clientId));

        const uploaded = await provider.uploadFile(
          clientFolder,
          DOCKETS_HISTORY_OBJECT_NAME,
          Readable.from(body),
          'application/json'
        );

        log.info('CLIENT_DOCKET_HISTORY_SYNCED_BYOS', {
          firmId: String(firmId),
          clientId,
          fileId: uploaded?.fileId,
          totalDockets: payload.totalDockets,
        });

        return {
          synced: true,
          mode: 'firm_connected',
          fileId: uploaded?.fileId,
          objectKey: `firms/${firmId}/clients/${clientId}/${DOCKETS_HISTORY_OBJECT_NAME}`,
          checksum,
          lastSyncedAt: payload.lastSyncedAt,
          totalDockets: payload.totalDockets,
        };
      }

      if (backend.type === 'managed_fallback_s3') {
        const objectKey = `${backend.prefix}/firms/${firmId}/clients/${clientId}/${DOCKETS_HISTORY_OBJECT_NAME}`;
        await backend.client.send(
          new PutObjectCommand({
            Bucket: backend.bucket,
            Key: objectKey,
            Body: body,
            ContentType: 'application/json',
          })
        );

        log.info('CLIENT_DOCKET_HISTORY_SYNCED_MANAGED_S3', {
          firmId: String(firmId),
          clientId,
          objectKey,
          totalDockets: payload.totalDockets,
        });

        return {
          synced: true,
          mode: 'managed_fallback_s3',
          objectKey,
          checksum,
          lastSyncedAt: payload.lastSyncedAt,
          totalDockets: payload.totalDockets,
        };
      }

      return { synced: false };
    } catch (err) {
      log.warn('CLIENT_DOCKET_HISTORY_SYNC_FAILED', {
        firmId: String(firmId),
        clientId,
        error: err.message,
      });
      return { synced: false, error: err.message };
    }
  }
}

const clientDocketHistoryStorageService = new ClientDocketHistoryStorageService();

module.exports = {
  clientDocketHistoryStorageService,
  ClientDocketHistoryStorageService,
  DOCKETS_HISTORY_OBJECT_NAME,
};
