const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/user.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requirePrimaryAdmin } = require('../middleware/rbac.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { updateUserStatus } = require('../controllers/auth.controller');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  completeTutorial,
  patchUserRole,
  patchUserReporting,
} = require('../controllers/user.controller');
const { markUpdateSeen } = require('../controllers/productUpdate.controller');

/**
 * User Routes
 * RESTful API endpoints for user management
 */

router.patch('/mark-update-seen', userWriteLimiter, markUpdateSeen);
router.patch('/tutorial/complete', userWriteLimiter, completeTutorial);

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

router.patch('/:id/role', requirePrimaryAdmin, userWriteLimiter, patchUserRole);
router.patch('/:id/reporting', requirePrimaryAdmin, userWriteLimiter, patchUserReporting);

router.delete('/:id', requirePrimaryAdmin, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, deleteUser);

module.exports = router;
