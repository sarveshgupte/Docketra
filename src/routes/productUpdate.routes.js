const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/productUpdate.routes.schema');
const { requirePlatformSuperAdmin } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const {
  createProductUpdate,
  getLatestProductUpdate,
  listProductUpdates,
} = require('../controllers/productUpdate.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/latest', userReadLimiter, getLatestProductUpdate);
router.get('/', userReadLimiter, listProductUpdates);
router.post('/', requirePlatformSuperAdmin, userWriteLimiter, createProductUpdate);

module.exports = router;
