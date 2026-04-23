const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');
const StorageProvider = require('./StorageProvider');
const { StorageAccessError } = require('../errors');

const MAX_URL_EXPIRY_SECONDS = 10 * 60;
const DEFAULT_URL_EXPIRY_SECONDS = 10 * 60;

class S3Provider extends StorageProvider {
  constructor({ tenantId, bucket, region, prefix, credentials }) {
    super();
    this.tenantId = tenantId;
    this.bucket = bucket;
    this.region = region;
    this.prefix = prefix || '';
    this.client = new S3Client({
      region,
      credentials,
    });
  }

  normalizeExpiry(expiresIn) {
    const parsed = Number(expiresIn);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_URL_EXPIRY_SECONDS;
    }
    return Math.min(Math.floor(parsed), MAX_URL_EXPIRY_SECONDS);
  }

  async generateUploadUrl(objectKey, expiresIn = DEFAULT_URL_EXPIRY_SECONDS) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });
      const expires = this.normalizeExpiry(expiresIn);
      return getSignedUrl(this.client, command, { expiresIn: expires });
    } catch (error) {
      throw new StorageAccessError('Failed to generate upload URL', this.tenantId, error);
    }
  }

  async generateDownloadUrl(objectKey, expiresIn = DEFAULT_URL_EXPIRY_SECONDS) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });
      const expires = this.normalizeExpiry(expiresIn);
      return getSignedUrl(this.client, command, { expiresIn: expires });
    } catch (error) {
      throw new StorageAccessError('Failed to generate download URL', this.tenantId, error);
    }
  }

  async deleteObject(objectKey) {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        })
      );
    } catch (error) {
      throw new StorageAccessError('Failed to delete object', this.tenantId, error);
    }
  }

  async testConnection() {
    const keyPrefix = this.prefix ? `${this.prefix.replace(/^\/+|\/+$/g, '')}/` : '';
    const probeKey = `${keyPrefix}__docketra_probe__/${randomUUID()}`;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: probeKey,
          Body: 'docketra-storage-probe',
        })
      );
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: probeKey }));
      return { ok: true };
    } catch (error) {
      throw new StorageAccessError('Failed storage connection test', this.tenantId, error);
    }
  }

  buildTenantScopedKey(objectKey = '') {
    const keyPrefix = this.prefix ? `${this.prefix.replace(/^\/+|\/+$/g, '')}/` : '';
    return `${keyPrefix}${String(objectKey).replace(/^\/+/, '')}`;
  }

  async createDirectUploadSession({ objectKey, mimeType = 'application/octet-stream' }) {
    const scopedKey = this.buildTenantScopedKey(objectKey || randomUUID());
    const uploadUrl = await this.generateUploadUrl(scopedKey);
    return {
      provider: 's3',
      method: 'PUT',
      uploadUrl,
      headers: { 'Content-Type': mimeType },
      providerFileId: null,
      objectKey: scopedKey,
    };
  }

  async verifyUploadedObject({ objectKey, expectedSize, expectedMimeType }) {
    if (!objectKey) {
      return { ok: false, reason: 'missing_object_key' };
    }
    try {
      const meta = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }));

      const sizeMatch = Number(meta.ContentLength || 0) === Number(expectedSize || 0);
      const mimeMatch = !expectedMimeType || String(meta.ContentType || '').toLowerCase() === String(expectedMimeType).toLowerCase();
      if (!sizeMatch || !mimeMatch) {
        return { ok: false, reason: 'metadata_mismatch' };
      }
      return {
        ok: true,
        provider: 's3',
        fileId: objectKey,
        checksum: meta?.ETag
          ? {
              algorithm: 'md5',
              value: String(meta.ETag).replace(/"/g, '').toLowerCase(),
              raw: `md5:${String(meta.ETag).replace(/"/g, '').toLowerCase()}`,
            }
          : null,
      };
    } catch (error) {
      return { ok: false, reason: error.message };
    }
  }
}

module.exports = {
  S3Provider,
  MAX_URL_EXPIRY_SECONDS,
};
