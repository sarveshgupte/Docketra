const express = require('express');
const { createDeal, listDeals, getDealById, updateDealStage } = require('../controllers/deal.controller');

const router = express.Router();

router.post('/', createDeal);
router.get('/', listDeals);
router.get('/:id', getDealById);
router.patch('/:id', updateDealStage);

module.exports = router;
