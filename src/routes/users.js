const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/permission.middleware');
const { authorize } = require('../middleware/authorize');
const UserPolicy = require('../policies/user.policy');
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
router.get('/', authorize(UserPolicy.canView), getUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', authorize(UserPolicy.canView), getUserById);

// POST /api/users - Create new user
router.post('/', authorize(UserPolicy.canCreate), createUser);

// PUT /api/users/:id - Update user
router.put('/:id', authorize(UserPolicy.canUpdate), updateUser);

// PATCH /api/users/:xID/status - Update user status (Admin only)
router.patch('/:xID/status', authorize(UserPolicy.canUpdate), updateUserStatus);

// DELETE /api/users/:id - Deactivate user
router.delete('/:id', authorize(UserPolicy.canDelete), deleteUser);

module.exports = router;
