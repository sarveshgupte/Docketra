const express = require('express');
const { liveness, readiness } = require('../controllers/health.controller');

const router = express.Router();

router.get('/liveness', liveness);
router.get('/readiness', readiness);
router.get('/', liveness);

module.exports = router;
