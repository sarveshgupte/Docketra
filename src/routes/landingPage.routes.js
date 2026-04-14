const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/landingPage.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { createLandingPage, listLandingPages, getLandingPage } = require('../controllers/landingPage.controller');

router.post('/', userWriteLimiter, createLandingPage);
router.get('/', userReadLimiter, listLandingPages);
router.get('/:id', userReadLimiter, getLandingPage);

module.exports = router;
