const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/category.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authenticate } = require('../middleware/auth.middleware');
const { attachFirmContext } = require('../middleware/firmContext.middleware');
const requireTenant = require('../middleware/requireTenant');
const invariantGuard = require('../middleware/invariantGuard');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
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
 * Authenticated read endpoints:
 * - GET /api/categories
 * 
 * Admin-only endpoints:
 * - All other operations require authentication and admin role
 * - SuperAdmin is blocked from accessing firm-specific categories
 */

// Authenticated read endpoint - categories are firm-scoped and require tenant context
router.get('/', authenticate, userReadLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_VIEW'), getCategories);

// Get category by ID - require auth and block SuperAdmin
router.get('/:id', authenticate, userReadLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_VIEW'), getCategoryById);

// Admin-only endpoints - require authentication, block SuperAdmin, and require admin role
router.post('/', authenticate, userWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), createCategory);
router.put('/:id', authenticate, userWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), updateCategory);
router.patch('/:id/status', authenticate, userWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), toggleCategoryStatus);
router.delete('/:id', authenticate, userWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), deleteCategory);

// Subcategory management (Admin only)
router.post('/:id/subcategories', authenticate, userWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), addSubcategory);
router.put('/:id/subcategories/:subcategoryId', authenticate, userWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), updateSubcategory);
router.patch('/:id/subcategories/:subcategoryId/status', authenticate, userWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), toggleSubcategoryStatus);
router.delete('/:id/subcategories/:subcategoryId', authenticate, userWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), deleteSubcategory);

module.exports = router;
