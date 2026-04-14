const express = require('express');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { createInvoice, listInvoices, markAsPaid } = require('../controllers/invoice.controller');

const router = express.Router();

router.post('/', userWriteLimiter, createInvoice);
router.get('/', userReadLimiter, listInvoices);
router.patch('/:id/pay', userWriteLimiter, markAsPaid);

module.exports = router;
