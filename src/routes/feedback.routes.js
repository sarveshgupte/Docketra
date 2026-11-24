const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/feedback.routes.schema');
const { userWriteLimiter } = require('../middleware/rateLimiters');
const { submitFeedback } = require('../controllers/feedback.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', userWriteLimiter, submitFeedback);

module.exports = router;
