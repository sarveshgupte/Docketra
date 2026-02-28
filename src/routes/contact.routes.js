const express = require('express');
const { submitEnterpriseInquiry } = require('../controllers/contact.controller');

const router = express.Router();

router.post('/', submitEnterpriseInquiry);

module.exports = router;
