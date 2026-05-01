const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
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
router.get('/', listKnowledgeItems);
router.get('/:id', getKnowledgeItem);

// Write operations: admin only
router.post('/', requireAdmin, createKnowledgeItem);
router.patch('/:id', requireAdmin, updateKnowledgeItem);
router.post('/:id/archive', requireAdmin, archiveKnowledgeItem);

module.exports = router;
