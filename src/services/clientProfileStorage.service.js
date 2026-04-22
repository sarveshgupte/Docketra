const crypto = require('crypto');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const log = require('../utils/log');

const PROFILE_SCHEMA_VERSION = 1;
const PROFILE_FOLDER = 'client-profiles';

const SENSITIVE_TOP_LEVEL_FIELDS = [
  'businessAddress',
  'secondaryContactNumber',
  'PAN',
  'GST',
  'TAN',
  'CIN',
  'contactPersonName',
  'contactPersonDesignation',
  'contactPersonPhoneNumber',
  'contactPersonEmailAddress',
  'clientFactSheet',
];

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
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
      const err = new Error('No active storage backend available for client profiles');
      err.code = 'STORAGE_NOT_CONNECTED';
      throw err;
    }
    return fallback;
  }
}

function getManagedFallbackBackend() {
  return buildManagedFallbackClient();
}

function buildProfilePayload({ client, profileInput = {}, actorXID = null }) {
  const now = new Date().toISOString();
  const existingVersion = Number(client?.profileRef?.version || 0);
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    clientId: client.clientId,
    firmId: String(client.firmId),
    profileVersion: existingVersion + 1,
    updatedAt: now,
    updatedBy: actorXID || 'SYSTEM',
    profile: {
      legalName: profileInput.legalName || client.businessName || '',
      identifiers: {
        pan: profileInput.PAN || null,
        gstin: profileInput.GST || null,
        tan: profileInput.TAN || null,
        cin: profileInput.CIN || null,
      },
      contacts: {
        primaryEmail: profileInput.businessEmail || client.businessEmail || null,
        primaryPhone: profileInput.primaryContactNumber || client.primaryContactNumber || null,
        secondaryPhone: profileInput.secondaryContactNumber || null,
        contactPerson: {
          name: profileInput.contactPersonName || null,
          designation: profileInput.contactPersonDesignation || null,
          phone: profileInput.contactPersonPhoneNumber || null,
          email: profileInput.contactPersonEmailAddress || null,
        },
      },
      addresses: {
        businessAddress: profileInput.businessAddress || null,
      },
      factSheet: profileInput.clientFactSheet || null,
      customFields: profileInput.customFields || {},
    },
  };
}

function redactSensitiveFields(clientDoc) {
  if (!clientDoc) return clientDoc;
  SENSITIVE_TOP_LEVEL_FIELDS.forEach((field) => {
    clientDoc[field] = undefined;
  });
  return clientDoc;
}

async function uploadProfileToGoogle(provider, payload, { firmId, clientId }) {
  const rootId = await provider.getOrCreateFolder(null, 'Docketra');
  const firmFolder = await provider.getOrCreateFolder(rootId, String(firmId));
  const profilesFolder = await provider.getOrCreateFolder(firmFolder, PROFILE_FOLDER);
  const filename = `${clientId}-v${payload.profileVersion}.json`;
  const body = JSON.stringify(payload);
  const uploaded = await provider.uploadFile(profilesFolder, filename, Readable.from(body), 'application/json');

  return {
    storageProvider: provider.providerName || 'google-drive',
    fileId: uploaded.fileId,
    objectKey: `${profilesFolder}/${filename}`,
    checksum: sha256(body),
    version: payload.profileVersion,
    mode: 'firm_connected',
  };
}

async function uploadProfileToManagedFallback(backend, payload, { firmId, clientId }) {
  const body = JSON.stringify(payload);
  const objectKey = `${backend.prefix}/firms/${firmId}/${PROFILE_FOLDER}/${clientId}/v${payload.profileVersion}.json`;
  await backend.client.send(new PutObjectCommand({
    Bucket: backend.bucket,
    Key: objectKey,
    Body: body,
    ContentType: 'application/json',
  }));

  return {
    storageProvider: 'docketra_managed',
    fileId: null,
    objectKey,
    checksum: sha256(body),
    version: payload.profileVersion,
    mode: 'managed_fallback',
  };
}

async function readProfileFromGoogle(provider, fileId) {
  const stream = await provider.downloadFile(fileId);
  const raw = await streamToString(stream);
  return JSON.parse(raw);
}

async function readProfileFromManagedFallback(backend, objectKey) {
  const output = await backend.client.send(new GetObjectCommand({
    Bucket: backend.bucket,
    Key: objectKey,
  }));
  const raw = await streamToString(output.Body);
  return JSON.parse(raw);
}

class ClientProfileStorageService {
  async createClientProfile({ firmId, client, profileInput, actorXID }) {
    const payload = buildProfilePayload({ client, profileInput, actorXID });
    const backend = await resolveStorageBackend(firmId);
    const ref = backend.type === 'firm_connected'
      ? await uploadProfileToGoogle(backend.provider, payload, { firmId, clientId: client.clientId })
      : await uploadProfileToManagedFallback(backend, payload, { firmId, clientId: client.clientId });

    client.profileRef = {
      provider: ref.storageProvider,
      mode: ref.mode,
      fileId: ref.fileId,
      objectKey: ref.objectKey,
      checksum: ref.checksum,
      version: ref.version,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      migratedAt: new Date(),
      updatedAt: new Date(),
    };

    redactSensitiveFields(client);
    await client.save();

    return { ref: client.profileRef, payload };
  }

  async getClientProfile({ firmId, client }) {
    if (!client?.profileRef?.provider) return null;
    const profileRef = client.profileRef;

    if (profileRef.mode === 'managed_fallback' || profileRef.provider === 'docketra_managed') {
      const backend = getManagedFallbackBackend();
      if (!backend) return null;
      return readProfileFromManagedFallback(backend, profileRef.objectKey);
    }

    const backend = await resolveStorageBackend(firmId);
    if (backend.type !== 'firm_connected') return null;
    return readProfileFromGoogle(backend.provider, profileRef.fileId);
  }

  async updateClientProfile({ firmId, client, partialProfileInput = {}, actorXID }) {
    let current = null;
    try {
      current = await this.getClientProfile({ firmId, client });
    } catch (error) {
      log.warn('[CLIENT_PROFILE]', { event: 'read_before_update_failed', firmId: String(firmId), clientId: client.clientId, message: error.message });
    }

    const merged = {
      ...(current?.profile || {}),
      ...partialProfileInput,
      identifiers: {
        ...(current?.profile?.identifiers || {}),
        pan: partialProfileInput.PAN ?? current?.profile?.identifiers?.pan ?? null,
        gstin: partialProfileInput.GST ?? current?.profile?.identifiers?.gstin ?? null,
        tan: partialProfileInput.TAN ?? current?.profile?.identifiers?.tan ?? null,
        cin: partialProfileInput.CIN ?? current?.profile?.identifiers?.cin ?? null,
      },
      contacts: {
        ...(current?.profile?.contacts || {}),
        primaryEmail: partialProfileInput.businessEmail ?? current?.profile?.contacts?.primaryEmail ?? null,
        primaryPhone: partialProfileInput.primaryContactNumber ?? current?.profile?.contacts?.primaryPhone ?? null,
        secondaryPhone: partialProfileInput.secondaryContactNumber ?? current?.profile?.contacts?.secondaryPhone ?? null,
        contactPerson: {
          ...(current?.profile?.contacts?.contactPerson || {}),
          name: partialProfileInput.contactPersonName ?? current?.profile?.contacts?.contactPerson?.name ?? null,
          designation: partialProfileInput.contactPersonDesignation ?? current?.profile?.contacts?.contactPerson?.designation ?? null,
          phone: partialProfileInput.contactPersonPhoneNumber ?? current?.profile?.contacts?.contactPerson?.phone ?? null,
          email: partialProfileInput.contactPersonEmailAddress ?? current?.profile?.contacts?.contactPerson?.email ?? null,
        },
      },
      addresses: {
        ...(current?.profile?.addresses || {}),
        businessAddress: partialProfileInput.businessAddress ?? current?.profile?.addresses?.businessAddress ?? null,
      },
      factSheet: partialProfileInput.clientFactSheet ?? current?.profile?.factSheet ?? null,
    };

    return this.createClientProfile({
      firmId,
      client,
      profileInput: {
        legalName: partialProfileInput.legalName || client.businessName,
        businessEmail: merged?.contacts?.primaryEmail,
        primaryContactNumber: merged?.contacts?.primaryPhone,
        secondaryContactNumber: merged?.contacts?.secondaryPhone,
        businessAddress: merged?.addresses?.businessAddress,
        contactPersonName: merged?.contacts?.contactPerson?.name,
        contactPersonDesignation: merged?.contacts?.contactPerson?.designation,
        contactPersonPhoneNumber: merged?.contacts?.contactPerson?.phone,
        contactPersonEmailAddress: merged?.contacts?.contactPerson?.email,
        PAN: merged?.identifiers?.pan,
        GST: merged?.identifiers?.gstin,
        TAN: merged?.identifiers?.tan,
        CIN: merged?.identifiers?.cin,
        clientFactSheet: merged?.factSheet,
      },
      actorXID,
    });
  }

  async migrateClientProfileToStorage({ firmId, client, actorXID = 'MIGRATION' }) {
    const profileInput = {
      legalName: client.businessName,
      businessEmail: client.businessEmail,
      primaryContactNumber: client.primaryContactNumber,
      secondaryContactNumber: client.secondaryContactNumber,
      businessAddress: client.businessAddress,
      contactPersonName: client.contactPersonName,
      contactPersonDesignation: client.contactPersonDesignation,
      contactPersonPhoneNumber: client.contactPersonPhoneNumber,
      contactPersonEmailAddress: client.contactPersonEmailAddress,
      PAN: client.PAN,
      GST: client.GST,
      TAN: client.TAN,
      CIN: client.CIN,
      clientFactSheet: client.clientFactSheet,
    };

    return this.createClientProfile({ firmId, client, profileInput, actorXID });
  }

  hydrateClientWithProfile(client, profilePayload) {
    if (!client || !profilePayload?.profile) return client;
    const profile = profilePayload.profile;
    const clone = typeof client.toObject === 'function' ? client.toObject() : { ...client };
    clone.businessAddress = profile?.addresses?.businessAddress || null;
    clone.secondaryContactNumber = profile?.contacts?.secondaryPhone || null;
    clone.contactPersonName = profile?.contacts?.contactPerson?.name || null;
    clone.contactPersonDesignation = profile?.contacts?.contactPerson?.designation || null;
    clone.contactPersonPhoneNumber = profile?.contacts?.contactPerson?.phone || null;
    clone.contactPersonEmailAddress = profile?.contacts?.contactPerson?.email || null;
    clone.PAN = profile?.identifiers?.pan || null;
    clone.GST = profile?.identifiers?.gstin || null;
    clone.TAN = profile?.identifiers?.tan || null;
    clone.CIN = profile?.identifiers?.cin || null;
    clone.clientFactSheet = profile?.factSheet || null;
    return clone;
  }

  async deleteClientProfile({ firmId, client }) {
    if (!client?.profileRef) return;
    const profileRef = client.profileRef;

    if (profileRef.mode === 'managed_fallback' || profileRef.provider === 'docketra_managed') {
      const backend = getManagedFallbackBackend();
      if (backend && profileRef.objectKey) {
        await backend.client.send(new DeleteObjectCommand({ Bucket: backend.bucket, Key: profileRef.objectKey }));
      }
      return;
    }

    const backend = await resolveStorageBackend(firmId);
    if (backend.type === 'firm_connected' && profileRef.fileId && typeof backend.provider.deleteFile === 'function') {
      await backend.provider.deleteFile(profileRef.fileId);
    }
  }
}

module.exports = {
  clientProfileStorageService: new ClientProfileStorageService(),
  SENSITIVE_TOP_LEVEL_FIELDS,
};
