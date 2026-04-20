const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/invoice.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { createInvoice, listInvoices, markAsPaid } = require('../controllers/invoice.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', userWriteLimiter, createInvoice);
router.get('/', userReadLimiter, listInvoices);
router.patch('/:id/paid', userWriteLimiter, markAsPaid);
router.patch('/:id/pay', userWriteLimiter, markAsPaid);

module.exports = router;
