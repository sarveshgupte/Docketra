const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/invoice.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { checkClientAccess, applyClientAccessFilter } = require('../middleware/clientAccess.middleware');
const { createInvoice, listInvoices, markAsPaid } = require('../controllers/invoice.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, checkClientAccess, createInvoice);
router.get('/', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, applyClientAccessFilter, listInvoices);
router.patch('/:id/paid', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, markAsPaid);
router.patch('/:id/pay', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, markAsPaid);

module.exports = router;
