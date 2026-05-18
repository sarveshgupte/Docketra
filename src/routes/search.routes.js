const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/search.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { searchLimiter } = require('../middleware/rateLimiters');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { globalSearch } = require('../controllers/search.controller');

/**
 * Search and Worklist Routes
 * PART A - READ-ONLY operations for finding cases and viewing worklists
 * Rate limited to prevent query abuse and expensive database operations
 */

// GET /api/search?q=term - Global search
router.get('/', authorizeFirmPermission('CASE_VIEW'), searchLimiter, globalSearch);


module.exports = router;
