const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/emailCapture.routes.schema');
const {
  createEmailCapture,
  getEmailCaptures,
  getEmailCaptureById,
  updateEmailCapture,
  linkToDocket,
  createDocketFromEmail,
} = require('../controllers/emailCapture.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/', createEmailCapture);
router.get('/', getEmailCaptures);
router.get('/:id', getEmailCaptureById);
router.patch('/:id', updateEmailCapture);
router.post('/:id/link', linkToDocket);
router.post('/:id/create-docket', createDocketFromEmail);

module.exports = router;
