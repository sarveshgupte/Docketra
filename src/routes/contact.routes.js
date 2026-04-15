const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/contact.routes.schema');
const { submitEnterpriseInquiry } = require('../controllers/contact.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', submitEnterpriseInquiry);

module.exports = router;
