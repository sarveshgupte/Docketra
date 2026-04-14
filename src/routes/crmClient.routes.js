const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/crmClient.routes.schema');
const { createCrmClient, listCrmClients, getCrmClientById } = require('../controllers/crmClient.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', createCrmClient);
router.get('/', listCrmClients);
router.get('/:id', getCrmClientById);

module.exports = router;
