const crypto = require('crypto');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const { requireWritableBusinessStorage } = require('./strictStoragePolicy.service');

const DOCKET_OBJECT_NAME = 'docket.json';

function sha256(value) { return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex'); }
async function streamToString(stream) { const chunks = []; for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks).toString('utf8'); }
function buildManagedFallbackClient() {
  const bucket = process.env.MANAGED_STORAGE_S3_BUCKET;
  const region = process.env.MANAGED_STORAGE_S3_REGION;
  if (!bucket || !region) return null;
  const credentials = process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID && process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY,
    ...(process.env.MANAGED_STORAGE_S3_SESSION_TOKEN ? { sessionToken: process.env.MANAGED_STORAGE_S3_SESSION_TOKEN } : {}),
  } : undefined;
  return { type: 'managed_fallback_s3', bucket, region, prefix: (process.env.MANAGED_STORAGE_S3_PREFIX || 'docketra-managed').replace(/^\/+|\/+$/g, ''), client: new S3Client({ region, credentials }) };
}
async function resolveStorageBackend(firmId) {
  try { return { type: 'firm_connected', provider: await StorageProviderFactory.getProvider(firmId) }; } catch (_error) {
    const fallback = buildManagedFallbackClient();
    if (!fallback) { const err = new Error('No active storage backend available for docket narratives'); err.code = 'STORAGE_NOT_CONNECTED'; throw err; }
    return fallback;
  }
}
async function uploadNarrative({ firmId, docketId, payload }) {
  await requireWritableBusinessStorage({ firmId, targetPathCategory: 'docket_narrative' });
  const backend = await resolveStorageBackend(firmId);
  const body = JSON.stringify(payload);
  if (backend.type === 'firm_connected') {
    const storageRoot = backend.provider.rootFolderId || null;
    const firmsFolder = await backend.provider.getOrCreateFolder(storageRoot, 'firms');
    const firmFolder = await backend.provider.getOrCreateFolder(firmsFolder, String(firmId));
    const docketsFolder = await backend.provider.getOrCreateFolder(firmFolder, 'dockets');
    const docketFolder = await backend.provider.getOrCreateFolder(docketsFolder, String(docketId));
    const uploaded = await backend.provider.uploadFile(docketFolder, DOCKET_OBJECT_NAME, Readable.from(body), 'application/json');
    return { provider: backend.provider.providerName || 'google-drive', mode: 'firm_connected', fileId: uploaded.fileId, objectKey: `firms/${firmId}/dockets/${docketId}/${DOCKET_OBJECT_NAME}`, checksum: sha256(body) };
  }
  const objectKey = `${backend.prefix}/firms/${firmId}/dockets/${docketId}/${DOCKET_OBJECT_NAME}`;
  await backend.client.send(new PutObjectCommand({ Bucket: backend.bucket, Key: objectKey, Body: body, ContentType: 'application/json' }));
  return { provider: 'docketra_managed', mode: 'managed_fallback', fileId: null, objectKey, checksum: sha256(body) };
}
async function readNarrative({ firmId, docketRef }) {
  if (!docketRef?.provider) return null;
  if (docketRef.mode === 'managed_fallback' || docketRef.provider === 'docketra_managed') {
    const backend = buildManagedFallbackClient();
    if (!backend) throw new Error('Managed fallback unavailable');
    const output = await backend.client.send(new GetObjectCommand({ Bucket: backend.bucket, Key: docketRef.objectKey }));
    return JSON.parse(await streamToString(output.Body));
  }
  const backend = await resolveStorageBackend(firmId);
  if (backend.type !== 'firm_connected') throw new Error('Firm storage unavailable');
  const stream = await backend.provider.downloadFile(docketRef.fileId);
  return JSON.parse(await streamToString(stream));
}

module.exports = { uploadNarrative, readNarrative };
