#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

function testCategoryRouteRequiresAuthenticatedFirmContext() {
  const authenticate = () => {};
  const userReadLimiter = () => {};
  const userWriteLimiter = () => {};
  const attachFirmContext = () => {};
  const requireTenant = () => {};
  const categoryViewGuard = () => {};
  const categoryManageGuard = () => {};
  const getCategories = () => {};
  const invariantMiddleware = () => {};
  let capturedInvariantOptions = null;

  Module._load = function(request, parent, isMain) {
    if (request === '../middleware/requestValidation.middleware') {
      return { applyRouteValidation: (router) => router };
    }
    if (request === '../schemas/category.routes.schema.js') {
      return {};
    }
    if (request === '../middleware/auth.middleware') {
      return { authenticate };
    }
    if (request === '../middleware/firmContext.middleware') {
      return { attachFirmContext };
    }
    if (request === '../middleware/requireTenant') {
      return requireTenant;
    }
    if (request === '../middleware/invariantGuard') {
      return (options) => {
        capturedInvariantOptions = options;
        return invariantMiddleware;
      };
    }
    if (request === '../middleware/permission.middleware') {
      return {
        authorizeFirmPermission: (permission) => {
          if (permission === 'CATEGORY_VIEW') {
            return categoryViewGuard;
          }
          if (permission === 'CATEGORY_MANAGE') {
            return categoryManageGuard;
          }
          return () => {};
        },
      };
    }
    if (request === '../middleware/rateLimiters') {
      return { userReadLimiter, userWriteLimiter };
    }
    if (request === '../controllers/category.controller') {
      return {
        getCategories,
        getCategoryById: () => {},
        createCategory: () => {},
        updateCategory: () => {},
        toggleCategoryStatus: () => {},
        deleteCategory: () => {},
        addSubcategory: () => {},
        updateSubcategory: () => {},
        toggleSubcategoryStatus: () => {},
        deleteSubcategory: () => {},
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/routes/category.routes');
  const router = require('../src/routes/category.routes');
  const categoriesLayer = router.stack.find((layer) => layer.route?.path === '/');

  assert.ok(categoriesLayer, 'categories route should exist');
  assert.deepStrictEqual(
    categoriesLayer.route.stack.map((item) => item.handle),
    [authenticate, userReadLimiter, attachFirmContext, requireTenant, invariantMiddleware, categoryViewGuard, getCategories],
    'categories listing should require authenticated firm-scoped access'
  );
  assert.deepStrictEqual(
    capturedInvariantOptions,
    { requireFirm: true, forbidSuperAdmin: true },
    'categories listing should enforce firm context and block superadmin'
  );
  console.log('  ✓ protects GET /api/categories with the existing tenant auth chain');
}

function testCategoryServiceUsesAuthenticatedApiClient() {
  const serviceSource = fs.readFileSync(require.resolve('../ui/src/services/categoryService.js'), 'utf8');

  assert.ok(
    serviceSource.includes("import api from './api';"),
    'category service should import the authenticated api client'
  );
  assert.ok(
    serviceSource.includes("api.get('/categories'"),
    'category service should fetch categories through the authenticated api client'
  );
  assert.ok(
    !serviceSource.includes("axios.get('/categories'"),
    'category service should not bypass the shared api client for categories'
  );
  console.log('  ✓ keeps category fetches on the authenticated api client');
}

function run() {
  try {
    testCategoryRouteRequiresAuthenticatedFirmContext();
    testCategoryServiceUsesAuthenticatedApiClient();
    console.log('Category API auth regression tests passed.');
  } finally {
    Module._load = originalLoad;
  }
}

run();
