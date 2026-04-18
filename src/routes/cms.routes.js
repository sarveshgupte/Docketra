const express = require('express');
const { handleFormSubmission } = require('../services/cmsIntake.service');

const router = express.Router();

router.post('/submit', async (req, res) => {
  try {
    const result = await handleFormSubmission({
      firmId: req.body.firmId,
      formData: req.body,
      source: 'CMS_FORM',
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
