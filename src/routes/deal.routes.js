const express = require('express');
const { createDeal, listDeals, updateDealStage } = require('../controllers/deal.controller');

const router = express.Router();

router.post('/', createDeal);
router.get('/', listDeals);
router.patch('/:id', updateDealStage);

module.exports = router;
