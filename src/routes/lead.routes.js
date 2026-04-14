const express = require('express');
const { createLead, listLeads, updateLeadStatus, convertLead } = require('../controllers/lead.controller');

const router = express.Router();

router.post('/', createLead);
router.get('/', listLeads);
router.patch('/:id', updateLeadStatus);
router.post('/:id/convert', convertLead);

module.exports = router;
