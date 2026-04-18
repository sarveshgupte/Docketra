const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/deal.routes.schema');
const { createDeal, listDeals, getDealById, updateDealStage } = require('../controllers/deal.controller');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', userWriteLimiter, createDeal);
router.get('/', userReadLimiter, listDeals);
router.get('/:id', userReadLimiter, getDealById);
router.patch('/:id', userWriteLimiter, updateDealStage);

module.exports = router;
