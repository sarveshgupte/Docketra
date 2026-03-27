const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/firmStorage.routes.schema');
const { userWriteLimiter } = require('../middleware/rateLimiters');
const { changeFirmStorage } = require('../controllers/storage.controller');
const { requireAdmin } = require('../middleware/permission.middleware');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/storage/change', userWriteLimiter, requireAdmin, changeFirmStorage);

module.exports = router;
