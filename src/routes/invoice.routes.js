const express = require('express');
const { createInvoice, listInvoices, markAsPaid } = require('../controllers/invoice.controller');

const router = express.Router();

router.post('/', createInvoice);
router.get('/', listInvoices);
router.patch('/:id/pay', markAsPaid);

module.exports = router;
