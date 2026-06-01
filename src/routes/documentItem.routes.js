const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/documentItem.routes.schema');
const {
  createDocumentItem,
  addDocumentVersion,
  getDocumentItems,
  getDocumentItemById,
  updateDocumentStatus,
  selectCurrentVersion,
} = require('../controllers/documentItem.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', createDocumentItem);
router.post('/:id/versions', addDocumentVersion);
router.get('/', getDocumentItems);
router.get('/:id', getDocumentItemById);
router.patch('/:id/status', updateDocumentStatus);
router.patch('/:id/current-version', selectCurrentVersion);

module.exports = router;
