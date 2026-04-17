const crypto = require('crypto');
const EncryptionProvider = require('./encryption.interface');
const TenantKey = require('./tenantKey.model');
const log = require('../utils/log');

/**
 * LocalEncryptionProvider — AES-256-GCM envelope encryption using a local KEK.
 *
 * Envelope model (local version):
 *  1. On first use for a tenant, generate a random 32-byte DEK.
 *  2. Encrypt the DEK with MASTER_ENCRYPTION_KEY (KEK) using AES-256-GCM.
 *  3. Persist only the encrypted DEK in the `tenantkeys` collection.
 *  4. Discard the plaintext DEK from memory after use (buffer zeroing).
 *
 * Field encryption format:
 *   <iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * All three segments are base64 encoded and joined with ':'.
 * This is a self-describing format — no external metadata needed to decrypt.
 *
 * Security properties:
 *  - AES-256-GCM provides authenticated encryption (integrity + confidentiality).
 *  - 12-byte random IV per encryption operation prevents IV reuse attacks.
 *  - 16-byte auth tag detects tampering.
 *  - KEK lives only in environment (never in DB); DB compromise alone is insufficient.
 *  - Superadmin with DB-only access cannot decrypt tenant data.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 12 bytes = 96 bits (GCM recommended)
const AUTH_TAG_LENGTH = 16; // 16 bytes = 128 bits (maximum)
const KEY_LENGTH = 32;      // 32 bytes = 256 bits
const PAYLOAD_VERSION = 'v1';
const TENANT_KEY_CACHE_MAX_SIZE = 500;

/**
 * Derive a usable 32-byte Buffer from the MASTER_ENCRYPTION_KEY env variable.
 * Supports both hex (64 chars) and base64 (44 chars for 32 bytes) encodings.
 *
 * @throws {Error} If MASTER_ENCRYPTION_KEY is absent or wrong length.
 * @returns {Buffer}
 */
function loadMasterKey() {
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY environment variable is required but not set. ' +
      'Generate one with: node -e "process.stdout.write(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  let buf;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, 'hex');
  } else {
    buf = Buffer.from(raw, 'base64');
  }

  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `MASTER_ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes. ` +
      `Got ${buf.length} bytes.`
    );
  }
  return buf;
}

/**
 * Encrypt a Buffer with AES-256-GCM using the provided key.
 *
 * @param {Buffer} plainBuf - Data to encrypt
 * @param {Buffer} key      - 32-byte encryption key
 * @returns {{ iv: Buffer, authTag: Buffer, ciphertext: Buffer }}
 */
function aesgcmEncrypt(plainBuf, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv, authTag, ciphertext };
}

/**
 * Decrypt a Buffer with AES-256-GCM using the provided key.
 *
 * @param {Buffer} iv         - Initialisation vector
 * @param {Buffer} authTag    - Authentication tag
 * @param {Buffer} ciphertext - Encrypted data
 * @param {Buffer} key        - 32-byte encryption key
 * @returns {Buffer} Decrypted plaintext
 */
function aesgcmDecrypt(iv, authTag, ciphertext, key) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encode encryption output as a colon-delimited base64 string.
 *
 * @param {Buffer} iv
 * @param {Buffer} authTag
 * @param {Buffer} ciphertext
 * @returns {string}
 */
function encodePayload(iv, authTag, ciphertext, version = null) {
  const payload = [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
  if (!version) return payload;
  return `${version}:${payload}`;
}

/**
 * Parse a colon-delimited base64 string back into its parts.
 *
 * @param {string} encoded
 * @returns {{ iv: Buffer, authTag: Buffer, ciphertext: Buffer }}
 */
function decodePayload(encoded) {
  const parts = encoded.split(':');
  const version = parts[0] === PAYLOAD_VERSION ? parts[0] : null;
  const payloadParts = version ? parts.slice(1) : parts;
  if (payloadParts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected [v1:]iv:authTag:ciphertext');
  }
  return {
    version,
    iv: Buffer.from(payloadParts[0], 'base64'),
    authTag: Buffer.from(payloadParts[1], 'base64'),
    ciphertext: Buffer.from(payloadParts[2], 'base64'),
  };
}

/**
 * Overwrite a Buffer's contents with zeros to remove sensitive key material
 * from memory as soon as it is no longer needed.
 *
 * @param {Buffer} buf
 */
function zeroBuffer(buf) {
  if (buf && Buffer.isBuffer(buf)) {
    buf.fill(0);
  }
}


function getCachedDek(cache, tenantId) {
  if (!cache.has(tenantId)) return null;
  const dek = cache.get(tenantId);
  cache.delete(tenantId);
  cache.set(tenantId, dek);
  return Buffer.from(dek);
}

function setCachedDek(cache, tenantId, dek) {
  if (cache.has(tenantId)) {
    const previous = cache.get(tenantId);
    zeroBuffer(previous);
    cache.delete(tenantId);
  }
  const cached = Buffer.from(dek);
  cache.set(tenantId, cached);
  while (cache.size > TENANT_KEY_CACHE_MAX_SIZE) {
    const oldestTenantId = cache.keys().next().value;
    const oldestDek = cache.get(oldestTenantId);
    zeroBuffer(oldestDek);
    cache.delete(oldestTenantId);
  }
}

class LocalEncryptionProvider extends EncryptionProvider {
  constructor() {
    super();
    this._tenantKeyCache = new Map();
  }

  /**
   * Generate a new encrypted DEK without persisting it.
   * Used for atomic tenant key creation inside a MongoDB transaction.
   *
   * @returns {Promise<string>}  Encrypted DEK as iv:authTag:ciphertext (base64)
   */
  async generateEncryptedDek() {
    const masterKey = loadMasterKey();
    const dek = crypto.randomBytes(KEY_LENGTH);
    try {
      const { iv, authTag, ciphertext } = aesgcmEncrypt(dek, masterKey);
      return encodePayload(iv, authTag, ciphertext, PAYLOAD_VERSION);
    } finally {
      zeroBuffer(dek);
      zeroBuffer(masterKey);
    }
  }

  /**
   * Generate a new DEK for `tenantId`, encrypt it with the KEK, and persist
   * the encrypted DEK.  A no-op if the tenant already has a key.
   *
   * @param {string} tenantId
   * @returns {Promise<void>}
   */
  async generateTenantKey(tenantId, { session } = {}) {
    if (!tenantId) {
      throw new Error('tenantId is required to generate a tenant key');
    }

    const masterKey = loadMasterKey();
    const dek = crypto.randomBytes(KEY_LENGTH);

    try {
      const { iv, authTag, ciphertext } = aesgcmEncrypt(dek, masterKey);
      const encryptedDek = encodePayload(iv, authTag, ciphertext);

      await TenantKey.updateOne(
        { tenantId },
        { $setOnInsert: { tenantId, encryptedDek } },
        { upsert: true, session }
      );
    } finally {
      // Zero sensitive buffers immediately after use
      zeroBuffer(dek);
      zeroBuffer(masterKey);
    }
  }

  /**
   * Retrieve and unwrap the tenant's DEK, then use it to encrypt `plaintext`.
   *
   * @param {string} plaintext
   * @param {string} tenantId
   * @returns {Promise<string>}  iv:authTag:ciphertext (base64)
   */
  async encrypt(plaintext, tenantId, { session } = {}) {
    if (!tenantId) {
      throw new Error('tenantId is required for encryption');
    }

    const dek = await this._unwrapDek(tenantId, session);
    try {
      const plainBuf = Buffer.from(String(plaintext), 'utf8');
      const { iv, authTag, ciphertext } = aesgcmEncrypt(plainBuf, dek);
      return encodePayload(iv, authTag, ciphertext, PAYLOAD_VERSION);
    } finally {
      zeroBuffer(dek);
    }
  }

  /**
   * Retrieve and unwrap the tenant's DEK, then use it to decrypt `ciphertext`.
   *
   * @param {string} ciphertext  iv:authTag:ciphertext (base64)
   * @param {string} tenantId
   * @returns {Promise<string>}  Plaintext
   */
  async decrypt(ciphertext, tenantId, { session } = {}) {
    if (!tenantId) {
      throw new Error('tenantId is required for decryption');
    }

    const dek = await this._unwrapDek(tenantId, session);
    try {
      const { iv, authTag, ciphertext: ctBuf } = decodePayload(ciphertext);
      const plainBuf = aesgcmDecrypt(iv, authTag, ctBuf, dek);
      return plainBuf.toString('utf8');
    } finally {
      zeroBuffer(dek);
    }
  }

  /**
   * Retrieve the encrypted DEK from MongoDB, decrypt it with the KEK, and
   * return the raw DEK buffer.
   *
   * The caller is responsible for zeroing the returned buffer after use.
   *
   * @param {string} tenantId
   * @returns {Promise<Buffer>}  32-byte plaintext DEK
   * @private
   */
  async _unwrapDek(tenantId, session) {
    const cachedDek = getCachedDek(this._tenantKeyCache, tenantId);
    if (cachedDek) {
      return cachedDek;
    }

    const query = TenantKey.findOne({ tenantId });
    if (session) {
      query.session(session);
    }

    const record = await query.lean();
    if (!record) {
      throw new Error(`No encryption key found for tenant ${tenantId}. Call ensureTenantKey() first.`);
    }

    const masterKey = loadMasterKey();
    try {
      const { iv, authTag, ciphertext } = decodePayload(record.encryptedDek);
      const dek = aesgcmDecrypt(iv, authTag, ciphertext, masterKey);
      setCachedDek(this._tenantKeyCache, tenantId, dek);
      return dek;
    } finally {
      zeroBuffer(masterKey);
    }
  }

  _clearTenantKeyCache() {
    for (const dek of this._tenantKeyCache.values()) {
      zeroBuffer(dek);
    }
    this._tenantKeyCache.clear();
  }

  _tenantKeyCacheSize() {
    return this._tenantKeyCache.size;
  }
}

module.exports = LocalEncryptionProvider;
