const Category = require('../models/Category.model');
const Case = require('../models/Case.model');
const mongoose = require('mongoose');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { parseBooleanQuery } = require('../utils/query.utils');

/**
 * Category Controller for Admin-Managed Categories
 * 
 * Admin-only operations for managing case categories and subcategories.
 * Enforces unique names and soft delete rules.
 */

const resolveCategoryFirmScope = (req, res) => {
  if (req.user?.role === 'SUPER_ADMIN') return {};
  if (!req.user?.firmId) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: firm context required',
    });
    return null;
  }
  return { firmId: req.user.firmId };
};

/**
 * Get all categories (including inactive for admin)
 * GET /api/categories
 * Query param: activeOnly=true for only active categories
 */
const getCategories = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    const shouldFilterActiveOnly = parseBooleanQuery(activeOnly);
    
    // Filter based on activeOnly query parameter
    const filter = shouldFilterActiveOnly ? { ...firmScope, isActive: true } : { ...firmScope };
    
    const categories = await Category.find(filter).sort({ name: 1 });
    
    res.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message,
    });
  }
};

/**
 * Get category by ID
 * GET /api/categories/:id
 */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message,
    });
  }
};

/**
 * Create a new category (Admin only)
 * POST /api/categories
 */
const createCategory = async (req, res) => {
  try {
    const { name, defaultSlaDays = 0 } = req.body;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }
    
    // Check for duplicate name (case-insensitive)
    const existing = await Category.findOne({ 
      ...firmScope,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists',
      });
    }
    
    const category = new Category({
      ...firmScope,
      name: name.trim(),
      subcategories: [],
      isActive: true,
      defaultSlaDays: Math.max(0, Number(defaultSlaDays) || 0),
    });
    
    await category.save();
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating category',
      error: error.message,
    });
  }
};

/**
 * Update category name (Admin only)
 * PUT /api/categories/:id
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, defaultSlaDays } = req.body;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    // Check for duplicate name (case-insensitive), excluding current category
    const existing = await Category.findOne({ 
      _id: { $ne: id },
      ...firmScope,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists',
      });
    }
    
    category.name = name.trim();
    if (typeof defaultSlaDays !== 'undefined') {
      category.defaultSlaDays = Math.max(0, Number(defaultSlaDays) || 0);
    }
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: 'Category updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating category',
      error: error.message,
    });
  }
};

/**
 * Enable/disable category (Admin only)
 * PATCH /api/categories/:id/status
 * 
 * PR #39: Safe deletion - Categories can be disabled even when in use by cases.
 * Disabled categories are hidden from UI dropdowns but historical cases remain valid.
 */
const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive field is required (boolean)',
      });
    }
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    // PR #39: Allow soft delete even when category is in use
    // Historical cases will continue to display the category label
    // Only hide from new case creation dropdowns
    category.isActive = isActive;
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: `Category ${isActive ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating category status',
      error: error.message,
    });
  }
};

/**
 * Add subcategory to category (Admin only)
 * POST /api/categories/:id/subcategories
 */
const addSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, defaultSlaDays = 0 } = req.body;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory name is required',
      });
    }
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    // Check for duplicate subcategory name within this category (case-insensitive)
    const duplicate = category.subcategories.find(
      sub => sub.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Subcategory with this name already exists in this category',
      });
    }
    
    // Generate unique subcategory ID
    const subcategoryId = new mongoose.Types.ObjectId().toString();
    
    category.subcategories.push({
      id: subcategoryId,
      name: name.trim(),
      isActive: true,
      defaultSlaDays: Math.max(0, Number(defaultSlaDays) || 0),
    });
    
    await category.save();
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Subcategory added successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error adding subcategory',
      error: error.message,
    });
  }
};

/**
 * Update subcategory name (Admin only)
 * PUT /api/categories/:id/subcategories/:subcategoryId
 */
const updateSubcategory = async (req, res) => {
  try {
    const { id, subcategoryId } = req.params;
    const { name, defaultSlaDays } = req.body;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory name is required',
      });
    }
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
    }
    
    // Check for duplicate subcategory name within this category (case-insensitive), excluding current
    const duplicate = category.subcategories.find(
      sub => sub.id !== subcategoryId && sub.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Subcategory with this name already exists in this category',
      });
    }
    
    subcategory.name = name.trim();
    if (typeof defaultSlaDays !== 'undefined') {
      subcategory.defaultSlaDays = Math.max(0, Number(defaultSlaDays) || 0);
    }
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: 'Subcategory updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating subcategory',
      error: error.message,
    });
  }
};

/**
 * Enable/disable subcategory (Admin only)
 * PATCH /api/categories/:id/subcategories/:subcategoryId/status
 */
const toggleSubcategoryStatus = async (req, res) => {
  try {
    const { id, subcategoryId } = req.params;
    const { isActive } = req.body;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive field is required (boolean)',
      });
    }
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
    }
    
    subcategory.isActive = isActive;
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: `Subcategory ${isActive ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating subcategory status',
      error: error.message,
    });
  }
};

/**
 * Delete category (Admin only) - Soft delete
 * DELETE /api/categories/:id
 * 
 * PR #39: Safe deletion - Sets isActive to false
 * Category remains in database for historical cases
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    // Soft delete - set isActive to false
    category.isActive = false;
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: 'Category deleted successfully (soft delete)',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error deleting category',
      error: error.message,
    });
  }
};

/**
 * Delete subcategory (Admin only) - Soft delete
 * DELETE /api/categories/:id/subcategories/:subcategoryId
 * 
 * PR #39: Safe deletion - Sets isActive to false
 * Subcategory remains in database for historical cases
 */
const deleteSubcategory = async (req, res) => {
  try {
    const { id, subcategoryId } = req.params;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
    }
    
    // Soft delete - set isActive to false
    subcategory.isActive = false;
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: 'Subcategory deleted successfully (soft delete)',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error deleting subcategory',
      error: error.message,
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory: wrapWriteHandler(createCategory),
  updateCategory: wrapWriteHandler(updateCategory),
  toggleCategoryStatus: wrapWriteHandler(toggleCategoryStatus),
  deleteCategory: wrapWriteHandler(deleteCategory),
  addSubcategory: wrapWriteHandler(addSubcategory),
  updateSubcategory: wrapWriteHandler(updateSubcategory),
  toggleSubcategoryStatus: wrapWriteHandler(toggleSubcategoryStatus),
  deleteSubcategory: wrapWriteHandler(deleteSubcategory),
};
