const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const routeSchemas = require('../schemas/knowledgeItem.routes.schema');
const {
  createKnowledgeItem,
  listKnowledgeItems,
  getKnowledgeItem,
  updateKnowledgeItem,
  archiveKnowledgeItem,
} = require('../controllers/knowledgeItem.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

// Read operations: all firm users
router.get('/', userReadLimiter, listKnowledgeItems);
router.get('/:id', userReadLimiter, getKnowledgeItem);

// Write operations: admin only
router.post('/', userWriteLimiter, requireAdmin, createKnowledgeItem);
router.patch('/:id', userWriteLimiter, requireAdmin, updateKnowledgeItem);
router.post('/:id/archive', userWriteLimiter, requireAdmin, archiveKnowledgeItem);

module.exports = router;
