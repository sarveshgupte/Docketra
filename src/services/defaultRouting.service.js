const mongoose = require('mongoose');
const Category = require('../models/Category.model');
const { ensureDefaultWorkbasketForFirm } = require('./defaultWorkbasket.service');

const DEFAULT_CATEGORY_NAME = 'General';
const DEFAULT_SUBCATEGORY_NAME = 'General Work';

async function ensureDefaultRoutingForFirm(firmId, { session } = {}) {
  if (!firmId || !mongoose.Types.ObjectId.isValid(String(firmId))) return { created: false };

  const defaultWorkbasket = await ensureDefaultWorkbasketForFirm(firmId, { session });
  if (!defaultWorkbasket?._id) return { created: false };

  let category = await Category.findOne({ firmId, name: DEFAULT_CATEGORY_NAME }).session(session || null);
  let createdCategory = false;
  let createdSubcategory = false;

  if (!category) {
    category = new Category({
      firmId,
      name: DEFAULT_CATEGORY_NAME,
      isActive: true,
      subcategories: [],
    });
    createdCategory = true;
  }

  category.isActive = true;
  const existingSubcategory = (category.subcategories || []).find(
    (entry) => String(entry.name || '').trim().toLowerCase() === DEFAULT_SUBCATEGORY_NAME.toLowerCase(),
  );

  if (existingSubcategory) {
    existingSubcategory.isActive = true;
    existingSubcategory.workbasketId = existingSubcategory.workbasketId || defaultWorkbasket._id;
  } else {
    category.subcategories.push({
      id: new mongoose.Types.ObjectId().toString(),
      name: DEFAULT_SUBCATEGORY_NAME,
      workbasketId: defaultWorkbasket._id,
      isActive: true,
    });
    createdSubcategory = true;
  }

  if (createdCategory || createdSubcategory || !existingSubcategory?.isActive || !existingSubcategory?.workbasketId || !category.isActive) {
    await category.save({ session: session || undefined });
  }

  return {
    created: createdCategory || createdSubcategory,
    defaultWorkbasketId: String(defaultWorkbasket._id),
    defaultCategoryName: DEFAULT_CATEGORY_NAME,
    defaultSubcategoryName: DEFAULT_SUBCATEGORY_NAME,
  };
}

module.exports = {
  DEFAULT_CATEGORY_NAME,
  DEFAULT_SUBCATEGORY_NAME,
  ensureDefaultRoutingForFirm,
};
