const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { attachFirmContext } = require('../middleware/firmContext.middleware');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  toggleSubcategoryStatus,
  deleteSubcategory,
} = require('../controllers/category.controller');

/**
 * Category Routes for Admin-Managed Categories
 * 
 * Public endpoints:
 * - GET /api/categories (for case creation dropdowns)
 * 
 * Admin-only endpoints:
 * - All other operations require authentication and admin role
 * - SuperAdmin is blocked from accessing firm-specific categories
 */

// Public endpoint - Get active categories (for case creation)
router.get('/', getCategories);

// Get category by ID - require auth and block SuperAdmin
router.get('/:id', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_VIEW'), getCategoryById);

// Admin-only endpoints - require authentication, block SuperAdmin, and require admin role
router.post('/', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_MANAGE'), createCategory);
router.put('/:id', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_MANAGE'), updateCategory);
router.patch('/:id/status', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_MANAGE'), toggleCategoryStatus);
router.delete('/:id', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_MANAGE'), deleteCategory);

// Subcategory management (Admin only)
router.post('/:id/subcategories', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_MANAGE'), addSubcategory);
router.put('/:id/subcategories/:subcategoryId', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_MANAGE'), updateSubcategory);
router.patch('/:id/subcategories/:subcategoryId/status', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_MANAGE'), toggleSubcategoryStatus);
router.delete('/:id/subcategories/:subcategoryId', authenticate, attachFirmContext, authorizeFirmPermission('CATEGORY_MANAGE'), deleteSubcategory);

module.exports = router;
