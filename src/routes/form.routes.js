const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/form.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { createForm, listForms, getForm } = require('../controllers/form.controller');

router.post('/', createForm);
router.get('/', listForms);
router.get('/:id', getForm);

module.exports = router;
