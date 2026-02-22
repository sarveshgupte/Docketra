'use strict';

/**
 * Temp Upload Cleanup Utility
 *
 * Scans the uploads/tmp directory and deletes files that are older than a
 * configurable threshold (default 24 hours). Safe to call on a schedule.
 *
 * No external cron dependency — call this function from a startup timer,
 * a setInterval, or any existing scheduler in the application.
 */

const fs = require('fs').promises;
const path = require('path');

const TMP_DIR = path.join(__dirname, '../../uploads/tmp');
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Delete files under `uploads/tmp` that have not been modified within `maxAgeMs`.
 * Recurses one level deep (firm-scoped subdirectories).
 *
 * @param {number} [maxAgeMs=86400000] - Age threshold in milliseconds.
 * @returns {Promise<number>} Number of files deleted.
 */
async function cleanupStaleTmpUploads(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  let deleted = 0;
  const cutoff = Date.now() - maxAgeMs;

  let entries;
  try {
    entries = await fs.readdir(TMP_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return 0; // Directory does not exist yet — nothing to clean
    }
    throw err;
  }

  for (const entry of entries) {
    const entryPath = path.join(TMP_DIR, entry.name);

    if (entry.isDirectory()) {
      // Firm-scoped subdirectory — scan its contents
      let subEntries;
      try {
        subEntries = await fs.readdir(entryPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const sub of subEntries) {
        if (!sub.isFile()) continue;
        const filePath = path.join(entryPath, sub.name);
        deleted += await _deleteIfStale(filePath, cutoff);
      }
    } else if (entry.isFile()) {
      deleted += await _deleteIfStale(entryPath, cutoff);
    }
  }

  if (deleted > 0) {
    console.info(`[cleanupTmpUploads] Deleted ${deleted} stale temp file(s)`);
  }
  return deleted;
}

/**
 * @param {string} filePath
 * @param {number} cutoff - Epoch ms; files with mtime before this are deleted.
 * @returns {Promise<number>} 1 if deleted, 0 otherwise.
 */
async function _deleteIfStale(filePath, cutoff) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.mtimeMs < cutoff) {
      await fs.unlink(filePath);
      return 1;
    }
  } catch {
    // File may have been deleted between readdir and stat — ignore
  }
  return 0;
}

module.exports = { cleanupStaleTmpUploads };
