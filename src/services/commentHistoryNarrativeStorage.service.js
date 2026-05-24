const crypto = require('crypto');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const { requireWritableBusinessStorage } = require('./strictStoragePolicy.service');

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
    if (!fallback) { const err = new Error('No active storage backend available for comments/history'); err.code = 'STORAGE_NOT_CONNECTED'; throw err; }
    return fallback;
  }
}

async function uploadJsonAtPath({ firmId, objectPath, fileName, payload, targetPathCategory }) {
  await requireWritableBusinessStorage({ firmId, targetPathCategory });
  const backend = await resolveStorageBackend(firmId);
  const body = JSON.stringify(payload);
  if (backend.type === 'firm_connected') {
    const storageRoot = backend.provider.rootFolderId || null;
    const parts = String(objectPath).split('/').filter(Boolean);
    let parent = storageRoot;
    for (let i = 0; i < parts.length - 1; i += 1) parent = await backend.provider.getOrCreateFolder(parent, parts[i]);
    const uploaded = await backend.provider.uploadFile(parent, fileName, Readable.from(body), 'application/json');
    return { provider: backend.provider.providerName || 'google-drive', mode: 'firm_connected', fileId: uploaded.fileId, objectKey: objectPath, checksum: sha256(body) };
  }
  const objectKey = `${backend.prefix}/${objectPath}`;
  await backend.client.send(new PutObjectCommand({ Bucket: backend.bucket, Key: objectKey, Body: body, ContentType: 'application/json' }));
  return { provider: 'docketra_managed', mode: 'managed_fallback', fileId: null, objectKey, checksum: sha256(body) };
}

async function readJsonByRef({ firmId, ref }) {
  if (!ref?.provider) return null;
  if (ref.mode === 'managed_fallback' || ref.provider === 'docketra_managed') {
    const backend = buildManagedFallbackClient();
    if (!backend) throw new Error('Managed fallback unavailable');
    const output = await backend.client.send(new GetObjectCommand({ Bucket: backend.bucket, Key: ref.objectKey }));
    return JSON.parse(await streamToString(output.Body));
  }
  const backend = await resolveStorageBackend(firmId);
  if (backend.type !== 'firm_connected') throw new Error('Firm storage unavailable');
  const stream = await backend.provider.downloadFile(ref.fileId);
  return JSON.parse(await streamToString(stream));
}

async function uploadComment({ firmId, docketId, commentId, payload }) {
  const objectPath = `firms/${firmId}/dockets/${docketId}/comments/${commentId}.json`;
  return uploadJsonAtPath({ firmId, objectPath, fileName: `${commentId}.json`, payload, targetPathCategory: 'comment_narrative' });
}
async function uploadHistory({ firmId, docketId, historyId, payload }) {
  const objectPath = `firms/${firmId}/dockets/${docketId}/history/${historyId}.json`;
  return uploadJsonAtPath({ firmId, objectPath, fileName: `${historyId}.json`, payload, targetPathCategory: 'history_narrative' });
}

module.exports = { uploadComment, uploadHistory, readJsonByRef };
