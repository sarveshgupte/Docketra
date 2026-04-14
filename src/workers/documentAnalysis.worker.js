'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const Attachment = require('../models/Attachment.model');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const { googleDriveService } = require('../services/googleDrive.service');
const { extractTextFromFile } = require('../services/documentIntelligence/textExtraction.service');
const { sanitizeTextForAI } = require('../services/documentIntelligence/textSanitizer.service');
const aiService = require('../services/ai/ai.service');

const redisUrl = process.env.REDIS_URL;
const isAnalysisEnabled = String(process.env.ENABLE_AI_ANALYSIS || 'false').toLowerCase() === 'true';

let documentAnalysisWorker = null;

if (!redisUrl || !isAnalysisEnabled) {
  setWorkerStatus('documentAnalysis', 'disabled');
} else {
  setWorkerStatus('documentAnalysis', 'starting');
  documentAnalysisWorker = new Worker(
    'documentAnalysisQueue',
    async (job) => {
      if (job.name !== 'ANALYZE_DOCUMENT') {
        throw new UnrecoverableError(`Unknown document analysis job type: ${job.name}`);
      }

      const { attachmentId, firmId } = job.data || {};
      if (!attachmentId || !firmId) {
        throw new UnrecoverableError('Document analysis job payload missing attachmentId/firmId');
      }

      const attachment = await Attachment.findOne({ _id: attachmentId, firmId });
      if (!attachment) {
        throw new UnrecoverableError('Attachment not found for document analysis');
      }

      const providerFileId = attachment.storageFileId || attachment.driveFileId;
      if (!providerFileId) {
        throw new UnrecoverableError('Attachment missing storage reference');
      }

      console.info('[AI] document_analysis_started', { attachmentId, firmId });
      try {
        attachment.analysis = {
          status: 'PROCESSING',
          updatedAt: new Date(),
        };
        await attachment.save();

        const stream = await googleDriveService.downloadFile(firmId, providerFileId);
        const { extractedText } = await extractTextFromFile({ stream, mimeType: attachment.mimeType });
        const sanitizedText = sanitizeTextForAI(extractedText);

        if (!sanitizedText) {
          attachment.analysis = {
            status: 'FAILED',
            updatedAt: new Date(),
          };
          await attachment.save();
          console.warn('[AI] document_analysis_failed', { attachmentId, firmId, reason: 'empty_text' });
          return;
        }

        const insight = await aiService.analyzeDocument(sanitizedText, firmId);
        attachment.analysis = {
          documentType: insight.documentType,
          extractedFields: insight.extractedFields,
          tags: insight.tags,
          suggestedTeam: insight.suggestedTeam,
          status: 'COMPLETED',
          updatedAt: new Date(),
        };
        await attachment.save();
        console.info('[AI] document_analysis_completed', { attachmentId, firmId });
      } catch (error) {
        attachment.analysis = {
          status: 'FAILED',
          updatedAt: new Date(),
        };
        await attachment.save();
        console.error('[AI] document_analysis_failed', { attachmentId, firmId, message: error.message });
        throw error;
      }
    },
    { connection: { url: redisUrl } }
  );

  documentAnalysisWorker.on('ready', () => setWorkerStatus('documentAnalysis', 'running'));
  documentAnalysisWorker.on('error', () => setWorkerStatus('documentAnalysis', 'error'));
}

module.exports = documentAnalysisWorker;
