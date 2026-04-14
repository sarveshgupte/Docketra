const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/deal.routes.schema');
const { createDeal, listDeals, getDealById, updateDealStage } = require('../controllers/deal.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', createDeal);
router.get('/', listDeals);
router.get('/:id', getDealById);
router.patch('/:id', updateDealStage);

module.exports = router;
