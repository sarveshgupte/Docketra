const express = require('express');
const rateLimit = require('express-rate-limit');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/category.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authenticate } = require('../middleware/auth.middleware');
const { attachFirmContext } = require('../middleware/firmContext.middleware');
const requireTenant = require('../middleware/requireTenant');
const invariantGuard = require('../middleware/invariantGuard');
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

const categoryReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const categoryWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoint - Get active categories (for case creation)
router.get('/', getCategories);

// Get category by ID - require auth and block SuperAdmin
router.get('/:id', authenticate, categoryReadLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_VIEW'), getCategoryById);

// Admin-only endpoints - require authentication, block SuperAdmin, and require admin role
router.post('/', authenticate, categoryWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), createCategory);
router.put('/:id', authenticate, categoryWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), updateCategory);
router.patch('/:id/status', authenticate, categoryWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), toggleCategoryStatus);
router.delete('/:id', authenticate, categoryWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), deleteCategory);

// Subcategory management (Admin only)
router.post('/:id/subcategories', authenticate, categoryWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), addSubcategory);
router.put('/:id/subcategories/:subcategoryId', authenticate, categoryWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), updateSubcategory);
router.patch('/:id/subcategories/:subcategoryId/status', authenticate, categoryWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), toggleSubcategoryStatus);
router.delete('/:id/subcategories/:subcategoryId', authenticate, categoryWriteLimiter, attachFirmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), authorizeFirmPermission('CATEGORY_MANAGE'), deleteSubcategory);

module.exports = router;
