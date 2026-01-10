const express = require('express');
const router = express.Router();
const { getFirmBySlug } = require('../controllers/superadmin.controller');

/**
 * Public API Routes
 * 
 * These routes are publicly accessible (no authentication required)
 * Used for login page and other public-facing functionality
 */

// Get firm metadata by slug (for firm-scoped login page)
router.get('/firms/:firmSlug', getFirmBySlug);

module.exports = router;
