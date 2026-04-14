const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const {
  applyAiRouting,
  createDocketFromAttachment,
  getAiRoutingSuggestion,
  getDocketAiSuggestions,
  rejectAiRouting,
} = require('../controllers/docketAi.controller');
const { createCase } = require('../controllers/case.controller');
const { getTimeline } = require('../controllers/docketActivity.controller');
const { previewDocketBulkUpload, uploadDocketBulk } = require('../controllers/docketBulkUpload.controller');

const router = express.Router();

router.post('/bulk/preview', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, previewDocketBulkUpload);
router.post('/bulk/upload', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, uploadDocketBulk);

router.get('/ai-suggestions/:attachmentId', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getDocketAiSuggestions);
router.post('/create', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, createCase);
router.post('/from-attachment/:attachmentId', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, createDocketFromAttachment);
router.get('/:docketId/ai-routing', authorizeFirmPermission('CASE_UPDATE'), userReadLimiter, getAiRoutingSuggestion);
router.post('/:docketId/apply-ai-routing', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, applyAiRouting);
router.post('/:docketId/reject-ai-routing', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, rejectAiRouting);
router.get('/:id/timeline', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getTimeline);

module.exports = router;
