const crypto = require('crypto');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const { requireWritableBusinessStorage } = require('./strictStoragePolicy.service');

function sha256(value) { return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex'); }
async function streamToString(stream) { const chunks = []; for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks).toString('utf8'); }

function getRedisSafely() {
  try {
    const { getRedisClient } = require('../config/redis');
    return getRedisClient();
  } catch (_e) {
    return null;
  }
}

// In-memory narrative cache for sub-millisecond retrieval of immutable past narratives
const narrativeMemoryCache = new Map();
const MAX_MEMORY_CACHE_ENTRIES = 5000;
const MEMORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (narratives are immutable content-addressed payloads)

function getCacheKey(firmId, ref) {
  if (!ref) return null;
  const identifier = ref.checksum || ref.fileId || ref.objectKey;
  if (!identifier) return null;
  return `narrative:${firmId}:${identifier}`;
}

function getFromMemoryCache(key) {
  const entry = narrativeMemoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    narrativeMemoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setInMemoryCache(key, data) {
  if (narrativeMemoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = narrativeMemoryCache.keys().next().value;
    if (oldestKey) narrativeMemoryCache.delete(oldestKey);
  }
  narrativeMemoryCache.set(key, {
    data,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  });
}

function clearNarrativeMemoryCache() {
  narrativeMemoryCache.clear();
}

async function getFromRedisCache(key) {
  try {
    const client = getRedisSafely();
    if (client && client.status === 'ready') {
      const raw = await client.get(key);
      if (raw) return JSON.parse(raw);
    }
  } catch (_e) {
    // Ignore cache error, continue to cloud
  }
  return null;
}

async function setInRedisCache(key, data) {
  try {
    const client = getRedisSafely();
    if (client && client.status === 'ready') {
      await client.set(key, JSON.stringify(data), 'EX', 86400);
    }
  } catch (_e) {
    // Ignore cache write error
  }
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

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

  const cacheKey = getCacheKey(firmId, ref);
  if (cacheKey) {
    const mem = getFromMemoryCache(cacheKey);
    if (mem !== null) return mem;

    const red = await getFromRedisCache(cacheKey);
    if (red !== null) {
      setInMemoryCache(cacheKey, red);
      return red;
    }
  }

  let result;
  if (ref.mode === 'managed_fallback' || ref.provider === 'docketra_managed') {
    const backend = buildManagedFallbackClient();
    if (!backend) throw new Error('Managed fallback unavailable');
    const output = await backend.client.send(new GetObjectCommand({ Bucket: backend.bucket, Key: ref.objectKey }));
    result = JSON.parse(await streamToString(output.Body));
  } else {
    const backend = await resolveStorageBackend(firmId);
    if (backend.type !== 'firm_connected') throw new Error('Firm storage unavailable');
    const stream = await backend.provider.downloadFile(ref.fileId);
    result = JSON.parse(await streamToString(stream));
  }

  if (cacheKey && result) {
    setInMemoryCache(cacheKey, result);
    setInRedisCache(cacheKey, result).catch(() => {});
  }

  return result;
}

async function readManyJsonByRef({ firmId, refs = [], concurrency = 5 }) {
  if (!Array.isArray(refs) || refs.length === 0) return [];

  const results = new Array(refs.length);
  const misses = [];

  // Step 1: Memory cache lookup
  for (let i = 0; i < refs.length; i += 1) {
    const ref = refs[i];
    if (!ref?.provider) {
      results[i] = null;
      continue;
    }
    const cacheKey = getCacheKey(firmId, ref);
    if (cacheKey) {
      const cached = getFromMemoryCache(cacheKey);
      if (cached !== null) {
        results[i] = cached;
        continue;
      }
    }
    misses.push({ index: i, ref, cacheKey });
  }

  if (misses.length === 0) return results;

  // Step 2: Batched Redis lookup for memory cache misses
  const client = getRedisSafely();
  if (client && client.status === 'ready') {
    const validMisses = misses.filter((m) => m.cacheKey);
    if (validMisses.length > 0) {
      try {
        const keys = validMisses.map((m) => m.cacheKey);
        const redisVals = await client.mget(keys);
        const stillMissing = [];
        for (let j = 0; j < validMisses.length; j += 1) {
          const raw = redisVals[j];
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              results[validMisses[j].index] = parsed;
              setInMemoryCache(validMisses[j].cacheKey, parsed);
              continue;
            } catch (_e) {}
          }
          stillMissing.push(validMisses[j]);
        }
        misses.length = 0;
        misses.push(...stillMissing);
      } catch (_e) {
        // Fall through to bounded parallel cloud reads
      }
    }
  }

  if (misses.length === 0) return results;

  // Step 3: Bounded parallel cloud reads
  await mapConcurrent(misses, concurrency, async ({ index, ref }) => {
    try {
      results[index] = await readJsonByRef({ firmId, ref });
    } catch (err) {
      results[index] = { error: err.message || 'read_failed' };
    }
  });

  return results;
}

async function uploadComment({ firmId, docketId, commentId, payload }) {
  const objectPath = `firms/${firmId}/dockets/${docketId}/comments/${commentId}.json`;
  const ref = await uploadJsonAtPath({ firmId, objectPath, fileName: `${commentId}.json`, payload, targetPathCategory: 'comment_narrative' });
  const cacheKey = getCacheKey(firmId, ref);
  if (cacheKey) {
    setInMemoryCache(cacheKey, payload);
    setInRedisCache(cacheKey, payload).catch(() => {});
  }
  return ref;
}

async function uploadHistory({ firmId, docketId, historyId, payload }) {
  const objectPath = `firms/${firmId}/dockets/${docketId}/history/${historyId}.json`;
  const ref = await uploadJsonAtPath({ firmId, objectPath, fileName: `${historyId}.json`, payload, targetPathCategory: 'history_narrative' });
  const cacheKey = getCacheKey(firmId, ref);
  if (cacheKey) {
    setInMemoryCache(cacheKey, payload);
    setInRedisCache(cacheKey, payload).catch(() => {});
  }
  return ref;
}

module.exports = {
  uploadComment,
  uploadHistory,
  readJsonByRef,
  readManyJsonByRef,
  clearNarrativeMemoryCache,
};
