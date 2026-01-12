const express = require('express');
const router = express.Router();
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
} = require('../controllers/taskController');

/**
 * Task Routes
 * RESTful API endpoints for task management
 */

// GET /api/tasks/stats - Get task statistics
router.get('/stats', authorizeFirmPermission('TASK_VIEW'), getTaskStats);

// GET /api/tasks - Get all tasks
router.get('/', authorizeFirmPermission('TASK_VIEW'), getTasks);

// GET /api/tasks/:id - Get task by ID
router.get('/:id', authorizeFirmPermission('TASK_VIEW'), getTaskById);

// POST /api/tasks - Create new task
router.post('/', authorizeFirmPermission('TASK_MANAGE'), createTask);

// PUT /api/tasks/:id - Update task
router.put('/:id', authorizeFirmPermission('TASK_MANAGE'), updateTask);

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', authorizeFirmPermission('TASK_MANAGE'), deleteTask);

module.exports = router;
