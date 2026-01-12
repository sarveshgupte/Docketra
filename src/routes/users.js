const express = require('express');
const router = express.Router();
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { updateUserStatus } = require('../controllers/auth.controller');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/userController');

/**
 * User Routes
 * RESTful API endpoints for user management
 */

// GET /api/users - Get all users
router.get('/', authorizeFirmPermission('USER_VIEW'), getUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', authorizeFirmPermission('USER_VIEW'), getUserById);

// POST /api/users - Create new user
router.post('/', authorizeFirmPermission('USER_MANAGE'), createUser);

// PUT /api/users/:id - Update user
router.put('/:id', authorizeFirmPermission('USER_MANAGE'), updateUser);

// PATCH /api/users/:xID/status - Update user status (Admin only)
router.patch('/:xID/status', authorizeFirmPermission('USER_MANAGE'), updateUserStatus);

// DELETE /api/users/:id - Deactivate user
router.delete('/:id', authorizeFirmPermission('USER_MANAGE'), deleteUser);

module.exports = router;
