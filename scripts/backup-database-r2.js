#!/usr/bin/env node
'use strict';

/**
 * Docketra - Cloudflare R2 Database Backup Runner
 * Streams compressed MongoDB collection archives directly to Cloudflare R2.
 *
 * Usage:
 *   node scripts/backup-database-r2.js [--dry-run]
 */

require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const zlib = require('zlib');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const isDryRun = process.argv.includes('--dry-run');

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'docketra-db-backups';
const R2_REGION = process.env.R2_REGION || 'auto';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

function validateConfig() {
  const missing = [];
  if (!R2_ENDPOINT) missing.push('R2_ENDPOINT');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!MONGO_URI) missing.push('MONGO_URI');

  if (missing.length > 0) {
    throw new Error(`[R2-BACKUP] Configuration error: Missing ${missing.join(', ')} in environment.`);
  }
}

async function runBackup() {
  const startTime = Date.now();
  console.log(`[R2-BACKUP] Starting backup at ${new Date().toISOString()}`);

  validateConfig();

  if (isDryRun) {
    console.log('[R2-BACKUP] Mode: DRY RUN (no data will be written to R2)');
  }

  // Step 1: Connect to MongoDB
  console.log('[R2-BACKUP] Connecting to database...');
  const connection = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  const db = connection.connection.db;
  const dbName = db.databaseName || 'docketra';
  console.log(`[R2-BACKUP] Connected to: ${dbName}`);

  // Step 2: List collections
  const rawCollections = await db.listCollections().toArray();
  const collections = rawCollections
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'));

  console.log(`[R2-BACKUP] Found ${collections.length} collection(s) to archive.`);

  // Step 3: Stream and compress collections
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tempFilePath = path.join(os.tmpdir(), `docketra-${dbName}-${timestamp}.json.gz`);

  const gzipStream = zlib.createGzip({ level: 9 });
  const fileStream = fs.createWriteStream(tempFilePath);
  const hash = crypto.createHash('sha256');

  gzipStream.on('data', (chunk) => hash.update(chunk));
  gzipStream.pipe(fileStream);

  let totalDocs = 0;
  const manifest = {};

  try {
    for (const collName of collections) {
      const cursor = db.collection(collName).find({});
      let count = 0;

      gzipStream.write(`{"collection":"${collName}","data":[\n`);
      let isFirst = true;

      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (!isFirst) {
          gzipStream.write(',\n');
        } else {
          isFirst = false;
        }
        gzipStream.write(JSON.stringify(doc));
        count += 1;
        totalDocs += 1;
      }

      gzipStream.write('\n]}\n');
      manifest[collName] = count;
      console.log(`[R2-BACKUP] Exported "${collName}": ${count} records`);
    }

    gzipStream.end();

    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    const sha256 = hash.digest('hex');
    const stat = await fsp.stat(tempFilePath);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    console.log(`[R2-BACKUP] Archive built: ${sizeMb} MB | SHA-256: ${sha256} | Total Records: ${totalDocs}`);

    const dateFolder = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    const objectKey = `mongodb-backups/${dateFolder}/docketra-${dbName}-${timestamp}.json.gz`;

    // Step 4: Upload to Cloudflare R2
    if (isDryRun) {
      console.log(`[R2-BACKUP] [DRY RUN] Would write to R2 key: ${objectKey}`);
    } else {
      console.log(`[R2-BACKUP] Uploading to R2 (${R2_BUCKET}/${objectKey})...`);
      const s3Client = new S3Client({
        region: R2_REGION,
        endpoint: R2_ENDPOINT,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });

      const fileBuffer = await fsp.readFile(tempFilePath);
      const uploadResult = await s3Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: objectKey,
          Body: fileBuffer,
          ContentType: 'application/gzip',
          Metadata: {
            sha256,
            database: dbName,
            totalDocs: String(totalDocs),
            exportedAt: new Date().toISOString(),
          },
        })
      );
      console.log(`[R2-BACKUP] Upload successful! ETag: ${uploadResult.ETag}`);
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[R2-BACKUP] Complete in ${elapsedSeconds}s`);
  } finally {
    // Step 5: Clean up temporary disk files
    try {
      await fsp.unlink(tempFilePath);
    } catch (_ignore) {}
    await mongoose.disconnect();
  }
}

runBackup().catch((error) => {
  console.error('[R2-BACKUP] Fatal error:', error.message);
  process.exit(1);
});
