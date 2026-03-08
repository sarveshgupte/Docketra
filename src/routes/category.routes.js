const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/category.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { firmReadAccess, firmWriteAccess } = require('./routeGroups');
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
 * Category Routes for user-facing category access.
 * 
 * User-access endpoints:
 * - GET /api/categories
 * - GET /api/categories/:id
 * 
 * Legacy admin-management aliases remain here for compatibility.
 * New admin-managed endpoints live under /api/admin/categories.
 */

router.get('/', ...firmReadAccess, authorizeFirmPermission('CATEGORY_VIEW'), getCategories);

router.get('/:id', ...firmReadAccess, authorizeFirmPermission('CATEGORY_VIEW'), getCategoryById);

// Legacy admin-only aliases retained for backward compatibility.
router.post('/', ...firmWriteAccess, authorizeFirmPermission('CATEGORY_MANAGE'), createCategory);
router.put('/:id', ...firmWriteAccess, authorizeFirmPermission('CATEGORY_MANAGE'), updateCategory);
router.patch('/:id/status', ...firmWriteAccess, authorizeFirmPermission('CATEGORY_MANAGE'), toggleCategoryStatus);
router.delete('/:id', ...firmWriteAccess, authorizeFirmPermission('CATEGORY_MANAGE'), deleteCategory);

router.post('/:id/subcategories', ...firmWriteAccess, authorizeFirmPermission('CATEGORY_MANAGE'), addSubcategory);
router.put('/:id/subcategories/:subcategoryId', ...firmWriteAccess, authorizeFirmPermission('CATEGORY_MANAGE'), updateSubcategory);
router.patch('/:id/subcategories/:subcategoryId/status', ...firmWriteAccess, authorizeFirmPermission('CATEGORY_MANAGE'), toggleSubcategoryStatus);
router.delete('/:id/subcategories/:subcategoryId', ...firmWriteAccess, authorizeFirmPermission('CATEGORY_MANAGE'), deleteSubcategory);

module.exports = router;
