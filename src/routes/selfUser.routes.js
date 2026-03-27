const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/selfUser.routes.schema');
const { userWriteLimiter } = require('../middleware/rateLimiters');
const { completeProfile } = require('../controllers/user.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/complete-profile', userWriteLimiter, completeProfile);

module.exports = router;
