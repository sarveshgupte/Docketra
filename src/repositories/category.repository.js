const Category = require('../models/Category.model');

const findCategoryById = async (categoryId, firmId) => Category.findOne({ _id: categoryId, firmId });

const findActiveCategory = async (categoryId, firmId) => Category.findOne({ _id: categoryId, firmId, isActive: true });

const countCategories = async (firmId, query = {}) => Category.countDocuments({ firmId, ...query });

module.exports = {
  findCategoryById,
  findActiveCategory,
  countCategories,
};
