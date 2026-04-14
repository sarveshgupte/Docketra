'use strict';

const MAX_EXTRACTED_CHARS = Number(process.env.AI_ANALYSIS_MAX_EXTRACTED_CHARS || 60000);

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function extractTextFromFile({ stream, mimeType }) {
  const fileBuffer = await streamToBuffer(stream);

  if (mimeType === 'application/pdf') {
    let pdfParse;
    try {
      pdfParse = require('pdf-parse');
    } catch (error) {
      throw new Error('PDF parsing dependency missing: install pdf-parse');
    }
    const parsed = await pdfParse(fileBuffer);
    return {
      extractedText: String(parsed.text || '').slice(0, MAX_EXTRACTED_CHARS),
    };
  }

  if (String(mimeType || '').startsWith('image/')) {
    // OCR intentionally deferred; phase-1 returns empty payload for images.
    return { extractedText: '' };
  }

  return { extractedText: '' };
}

module.exports = {
  extractTextFromFile,
};
