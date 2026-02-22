const express = require('express');
const router = express.Router();
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
} = require('../controllers/task.controller');

/**
 * Task Routes
 * RESTful API endpoints for task management
 */

// GET /api/tasks/stats - Get task statistics
router.get('/stats', authorizeFirmPermission('TASK_VIEW'), userReadLimiter, getTaskStats);

// GET /api/tasks - Get all tasks
router.get('/', authorizeFirmPermission('TASK_VIEW'), userReadLimiter, getTasks);

// GET /api/tasks/:id - Get task by ID
router.get('/:id', authorizeFirmPermission('TASK_VIEW'), userReadLimiter, getTaskById);

// POST /api/tasks - Create new task
router.post('/', authorizeFirmPermission('TASK_MANAGE'), userWriteLimiter, createTask);

// PUT /api/tasks/:id - Update task
router.put('/:id', authorizeFirmPermission('TASK_MANAGE'), userWriteLimiter, updateTask);

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', authorizeFirmPermission('TASK_MANAGE'), userWriteLimiter, deleteTask);

module.exports = router;
