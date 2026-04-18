const express = require('express');
const { submitCmsIntake } = require('../controllers/cms.controller');

const router = express.Router();

router.post('/submit', submitCmsIntake);

module.exports = router;
