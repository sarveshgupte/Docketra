const express = require('express');
const router = express.Router();
const {
  login,
  logout,
  changePassword,
  resetPassword,
  getProfile,
  updateProfile,
  createUser,
  activateUser,
  deactivateUser,
} = require('../controllers/auth.controller');

/**
 * Authentication and User Management Routes
 * PART B - xID-based Authentication & Identity Management
 */

// Authentication endpoints
router.post('/login', login);
router.post('/logout', logout);
router.post('/change-password', changePassword);
router.post('/reset-password', resetPassword);

// Profile endpoints
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Admin user management endpoints
router.post('/admin/users', createUser);
router.put('/admin/users/:xID/activate', activateUser);
router.put('/admin/users/:xID/deactivate', deactivateUser);

module.exports = router;
