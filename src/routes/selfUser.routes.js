const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/selfUser.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { completeProfile, getCurrentUser } = require('../controllers/user.controller');
const { getCoreWork } = require('../controllers/workbasket.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/me', userReadLimiter, getCurrentUser);
router.get('/core-work', userReadLimiter, getCoreWork);
router.post('/complete-profile', userWriteLimiter, completeProfile);

module.exports = router;
