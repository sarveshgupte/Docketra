const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/form.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const {
  createForm,
  listForms,
  getForm,
  updateForm,
} = require('../controllers/form.controller');

router.post('/', userWriteLimiter, createForm);
router.get('/', userReadLimiter, listForms);
router.get('/:id', userReadLimiter, getForm);
router.patch('/:id', userWriteLimiter, updateForm);

module.exports = router;
