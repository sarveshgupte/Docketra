/**
 * File Utilities for Attachment Handling
 * Provides common functions for MIME type detection and filename sanitization
 */

const path = require('path');
const fs = require('fs');

/**
 * Determine MIME type based on file extension
 * @param {string} filename - The filename with extension
 * @returns {string} MIME type string
 */
const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.eml': 'message/rfc822',
    '.msg': 'application/vnd.ms-outlook',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Sanitize filename for use in HTTP headers
 * Removes control characters, newlines, and quotes that could cause header injection
 * @param {string} filename - The original filename
 * @returns {string} Sanitized filename safe for HTTP headers
 */
const sanitizeFilename = (filename) => {
  if (!filename) return 'download';
  
  return filename
    .replace(/[\r\n\t]/g, '') // Remove newlines and tabs
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
    .replace(/["']/g, '') // Remove quotes
    .trim()
    .substring(0, 255); // Limit length
};

/**
 * Get file extension without the dot
 * @param {string} filename - The filename
 * @returns {string} Extension string
 */
const getExtension = (filename) => {
  if (!filename) return '';
  const ext = path.extname(filename);
  return ext.startsWith('.') ? ext.slice(1) : ext;
};

/**
 * Ensures that a directory exists, creating it if necessary
 * @param {string} dir - The directory path
 */
const ensureDirectoryExists = async (dir) => {
  try {
    await fs.promises.access(dir, fs.constants.F_OK);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.promises.mkdir(dir, { recursive: true });
    } else {
      throw err;
    }
  }
};

module.exports = {
  getMimeType,
  sanitizeFilename,
  getExtension,
  ensureDirectoryExists,
};
