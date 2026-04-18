const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/lead.routes.schema');
const { createLead, listLeads, updateLeadStatus, convertLead } = require('../controllers/lead.controller');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', userWriteLimiter, createLead);
router.get('/', userReadLimiter, listLeads);
router.patch('/:id', userWriteLimiter, updateLeadStatus);
router.post('/:id/convert', userWriteLimiter, convertLead);

module.exports = router;
