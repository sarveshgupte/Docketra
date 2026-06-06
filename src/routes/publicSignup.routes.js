const express = require('express');
const router = express.Router();

const deprecationHandler = (req, res) => {
  res.status(410).json({
    success: false,
    code: 'ROUTE_DEPRECATED',
    message: 'Legacy public signup endpoint is retired. Use the canonical /auth/signup/* endpoints.',
  });
};

router.post('/initiate-signup', deprecationHandler);
router.post('/resend-otp', deprecationHandler);
router.post('/verify-otp', deprecationHandler);
router.post('/complete-signup', deprecationHandler);

module.exports = router;
