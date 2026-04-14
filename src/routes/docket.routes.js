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

const router = express.Router();

router.get('/ai-suggestions/:attachmentId', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getDocketAiSuggestions);
router.post('/from-attachment/:attachmentId', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, createDocketFromAttachment);
router.get('/:docketId/ai-routing', authorizeFirmPermission('CASE_UPDATE'), userReadLimiter, getAiRoutingSuggestion);
router.post('/:docketId/apply-ai-routing', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, applyAiRouting);
router.post('/:docketId/reject-ai-routing', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, rejectAiRouting);

module.exports = router;
