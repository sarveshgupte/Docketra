const { gzip } = require('zlib');
const { promisify } = require('util');

const gzipAsync = promisify(gzip);
const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIN_SAVINGS_RATIO = 0.05;

function shouldUseCompressedVersion(originalSize, compressedSize) {
  if (!originalSize || compressedSize >= originalSize) return false;
  return (originalSize - compressedSize) / originalSize >= MIN_SAVINGS_RATIO;
}

async function compressBuffer(buffer, mimeType, compressionLevel = 6) {
  const originalBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  const originalSize = originalBuffer.length;
  const level = Math.min(9, Math.max(1, Number(compressionLevel) || 6));

  if (!originalSize || DOCX_MIME_TYPES.has(mimeType)) {
    return {
      buffer: originalBuffer,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  if (mimeType === 'application/pdf') {
    return {
      buffer: originalBuffer,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    try {
      const sharp = require('sharp');
      const image = sharp(originalBuffer);
      const metadata = await image.metadata();
      if (metadata.format === 'jpeg') {
        const compressed = await image.jpeg({ quality: 80 }).toBuffer();
        if (shouldUseCompressedVersion(originalSize, compressed.length)) {
          return {
            buffer: compressed,
            wasCompressed: true,
            originalSize,
            compressedSize: compressed.length,
          };
        }
      }
    } catch (_) {
      // Optional dependency not available or unsupported input; skip compression.
    }
    return {
      buffer: originalBuffer,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  if (mimeType.startsWith('text/') || mimeType === 'message/rfc822') {
    const compressed = await gzipAsync(originalBuffer, { level });
    if (shouldUseCompressedVersion(originalSize, compressed.length)) {
      return {
        buffer: compressed,
        wasCompressed: true,
        originalSize,
        compressedSize: compressed.length,
      };
    }
  }

  return {
    buffer: originalBuffer,
    wasCompressed: false,
    originalSize,
    compressedSize: originalSize,
  };
}

module.exports = {
  compressBuffer,
};
