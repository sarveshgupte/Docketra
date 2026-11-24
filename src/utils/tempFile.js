/**
 * Temporary File Utilities
 * 
 * Provides helper functions for managing temporary files during uploads.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const log = require('../utils/log');

const ALLOWED_TEMP_ROOTS = [
  path.resolve(__dirname, '../../uploads'),
  path.resolve(os.tmpdir()),
];

/**
 * Validates that a path is strictly located within an allowlisted temporary directory
 * and is at least one level beneath the root.
 */
const isUnderAllowedRoot = (resolvedPath) => {
  return ALLOWED_TEMP_ROOTS.some((root) => {
    const relative = path.relative(root, resolvedPath);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  });
};

/**
 * Clean up a temporary file
 * Safely deletes a file if and only if it resides within allowlisted temp roots.
 * 
 * @param {string} filePath - Path to the temporary file
 * @returns {Promise<boolean>} True if deleted, false if skipped or failed
 */
const cleanupTempFile = async (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }
  
  try {
    const resolved = path.resolve(filePath);
    if (!isUnderAllowedRoot(resolved)) {
      log.warn(`[TempFile] Refusing to delete file outside allowlisted temp directories: ${filePath}`);
      return false;
    }
    await fs.unlink(resolved);
    log.info(`[TempFile] Cleaned up temporary file: ${resolved}`);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      log.error(`[TempFile] Error deleting temp file ${filePath}:`, error.message);
    }
    return false;
  }
};

module.exports = {
  cleanupTempFile,
  isUnderAllowedRoot,
};

