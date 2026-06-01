const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/docketException.routes.schema');
const {
  createDocketException,
  getDocketExceptions,
  updateDocketException,
  getExceptionDashboard,
} = require('../controllers/docketException.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', createDocketException);
router.get('/', getDocketExceptions);
router.get('/dashboard', getExceptionDashboard);
router.patch('/:id', updateDocketException);

module.exports = router;
