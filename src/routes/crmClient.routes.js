const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/crmClient.routes.schema');
const { createCrmClient, listCrmClients, getCrmClientById } = require('../controllers/crmClient.controller');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', userWriteLimiter, createCrmClient);
router.get('/', userReadLimiter, listCrmClients);
router.get('/:id', userReadLimiter, getCrmClientById);

module.exports = router;
