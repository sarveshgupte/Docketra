const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/crmClient.routes.schema');
const {
  createCrmClient,
  listCrmClients,
  getCrmClientById,
  updateCrmClient,
  deactivateCrmClient,
} = require('../controllers/crmClient.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', createCrmClient);
router.get('/', listCrmClients);
router.get('/:id', getCrmClientById);
router.patch('/:id', updateCrmClient);
router.patch('/:id/deactivate', deactivateCrmClient);

module.exports = router;
