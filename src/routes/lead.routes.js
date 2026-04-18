const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/lead.routes.schema');
const { createLead, listLeads, updateLeadStatus, convertLead } = require('../controllers/lead.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', createLead);
router.get('/', listLeads);
router.patch('/:id', updateLeadStatus);
router.patch('/:id/status', updateLeadStatus);
router.post('/:id/convert', convertLead);

module.exports = router;
