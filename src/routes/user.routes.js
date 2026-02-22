const express = require('express');
const router = express.Router();
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { updateUserStatus } = require('../controllers/auth.controller');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/user.controller');

/**
 * User Routes
 * RESTful API endpoints for user management
 */

// GET /api/users - Get all users
router.get('/', authorizeFirmPermission('USER_VIEW'), userReadLimiter, getUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', authorizeFirmPermission('USER_VIEW'), userReadLimiter, getUserById);

// POST /api/users - Create new user
router.post('/', authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, createUser);

// PUT /api/users/:id - Update user
router.put('/:id', authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, updateUser);

// PATCH /api/users/:xID/status - Update user status (Admin only)
router.patch('/:xID/status', authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, updateUserStatus);

// DELETE /api/users/:id - Deactivate user
router.delete('/:id', authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, deleteUser);

module.exports = router;
