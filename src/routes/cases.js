const express = require('express');
const router = express.Router();
const {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  addCaseNote,
  getCaseStats,
} = require('../controllers/caseController');

/**
 * Case Routes
 * RESTful API endpoints for case management
 */

// GET /api/cases/stats - Get case statistics
router.get('/stats', getCaseStats);

// GET /api/cases - Get all cases
router.get('/', getCases);

// GET /api/cases/:id - Get case by ID
router.get('/:id', getCaseById);

// POST /api/cases - Create new case
router.post('/', createCase);

// PUT /api/cases/:id - Update case
router.put('/:id', updateCase);

// DELETE /api/cases/:id - Delete case
router.delete('/:id', deleteCase);

// POST /api/cases/:id/notes - Add note to case
router.post('/:id/notes', addCaseNote);

module.exports = router;
