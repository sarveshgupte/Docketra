#!/usr/bin/env node
const assert = require('assert');
const mongoose = require('mongoose');
const Category = require('../src/models/Category.model');

// Mock wrapWriteHandler before requiring the controller
require.cache[require.resolve('../src/middleware/wrapWriteHandler')] = {
  exports: (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      if (next) next(err);
      else throw err;
    }
  }
};

const categoryController = require('../src/controllers/category.controller');

async function run() {
  const originalFind = Category.find;
  const originalFindOne = Category.findOne;
  const originalSave = Category.prototype.save;

  try {
    console.log('Running category.controller.test.js...');

    // Mock Express Request and Response
    const mockRes = () => {
      const res = {};
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.body = data; return res; };
      return res;
    };

    // Test 1: getCategories (Admin)
    Category.find = () => ({
      sort: () => [
        { name: 'Category 1', isActive: true },
        { name: 'Category 2', isActive: false }
      ]
    });

    let req = { user: { role: 'SUPER_ADMIN' }, query: {} };
    let res = mockRes();
    await categoryController.getCategories(req, res);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 2);

    // Test 2: getCategories (Active only)
    Category.find = (filter) => ({
      sort: () => {
        assert.strictEqual(filter.isActive, true);
        return [{ name: 'Category 1', isActive: true }];
      }
    });
    req.query.activeOnly = 'true';
    res = mockRes();
    await categoryController.getCategories(req, res);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 1);

    // Test 2.5: getCategoryById
    Category.findOne = async (query) => {
      if (query._id === 'cat1') return new Category({ name: 'Cat1' });
      return null;
    };
    req = { user: { role: 'SUPER_ADMIN' }, params: { id: 'cat1' } };
    res = mockRes();
    await categoryController.getCategoryById(req, res);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'Cat1');

    req = { user: { role: 'SUPER_ADMIN' }, params: { id: 'nonexistent' } };
    res = mockRes();
    await categoryController.getCategoryById(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);

    // Test 3: createCategory
    Category.findOne = async () => null; // No duplicate
    Category.prototype.save = async function() { return this; };
    req = { user: { role: 'SUPER_ADMIN' }, body: { name: 'New Category' } };
    res = mockRes();
    await categoryController.createCategory(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'New Category');

    // Test 4: updateCategory
    Category.findOne = async (query) => {
      if (query._id === 'cat1') return new Category({ name: 'Old Category' });
      if (query._id && query._id.$ne === 'cat1') return null; // No duplicate
      return null;
    };
    req = { user: { role: 'SUPER_ADMIN' }, params: { id: 'cat1' }, body: { name: 'Updated Category' } };
    res = mockRes();
    await categoryController.updateCategory(req, res);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'Updated Category');

    // Test 5: toggleCategoryStatus (Soft Delete)
    Category.findOne = async (query) => {
      if (query._id === 'cat1') return new Category({ name: 'Cat', isActive: true });
      return null;
    };
    req = { user: { role: 'SUPER_ADMIN' }, params: { id: 'cat1' }, body: { isActive: false } };
    res = mockRes();
    await categoryController.toggleCategoryStatus(req, res);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.isActive, false);

    // Test 6: deleteCategory
    req = { user: { role: 'SUPER_ADMIN' }, params: { id: 'cat1' } };
    res = mockRes();
    await categoryController.deleteCategory(req, res);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.isActive, false);

    // Test 7: addSubcategory
    Category.findOne = async (query) => {
      if (query._id === 'cat1') return new Category({ name: 'Cat', subcategories: [] });
      return null;
    };
    req = { user: { role: 'SUPER_ADMIN' }, params: { id: 'cat1' }, body: { name: 'New Subcategory' } };
    res = mockRes();
    await categoryController.addSubcategory(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.subcategories.length, 1);
    assert.strictEqual(res.body.data.subcategories[0].name, 'New Subcategory');

    // Test 8: updateSubcategory
    const subcatId = new mongoose.Types.ObjectId().toString();
    Category.findOne = async (query) => {
      if (query._id === 'cat1') return new Category({
        name: 'Cat',
        subcategories: [{ id: subcatId, name: 'Old Sub' }]
      });
      return null;
    };
    req = {
      user: { role: 'SUPER_ADMIN' },
      params: { id: 'cat1', subcategoryId: subcatId },
      body: { name: 'Updated Sub' }
    };
    res = mockRes();
    await categoryController.updateSubcategory(req, res);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.subcategories[0].name, 'Updated Sub');

    // Test 9: deleteSubcategory
    req = {
      user: { role: 'SUPER_ADMIN' },
      params: { id: 'cat1', subcategoryId: subcatId }
    };
    res = mockRes();
    await categoryController.deleteSubcategory(req, res);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.subcategories[0].isActive, false);

    console.log('Category controller tests passed successfully.');
  } catch (error) {
    console.error('Category controller tests failed:', error);
    process.exit(1);
  } finally {
    Category.find = originalFind;
    Category.findOne = originalFindOne;
    Category.prototype.save = originalSave;
  }
}

run();
