const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/firmStorage.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { changeFirmStorage } = require('../controllers/storage.controller');
const { getFirmSetupStatus } = require('../controllers/firm.controller');
const { requireAdmin } = require('../middleware/permission.middleware');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/setup-status', userReadLimiter, getFirmSetupStatus);
router.post('/storage/change', userWriteLimiter, requireAdmin, changeFirmStorage);

module.exports = router;
