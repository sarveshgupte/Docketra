const Category = require('../models/Category.model');

const normalize = (value) => String(value || '').trim().toLowerCase();

async function mapServiceToRouting({ firmId, service }) {
  const normalizedService = normalize(service);
  if (!firmId || !normalizedService) {
    throw new Error('firmId and service are required for routing');
  }

  const categories = await Category.find({ firmId, isActive: true })
    .select('name subcategories')
    .lean();

  for (const category of categories) {
    const matchedSubcategory = (category.subcategories || []).find((subcategory) => (
      subcategory?.isActive !== false && normalize(subcategory.name) === normalizedService
    ));

    if (matchedSubcategory) {
      return {
        category: category.name,
        subcategory: matchedSubcategory.name,
        categoryId: category._id,
        subcategoryId: matchedSubcategory.id,
        workbasketId: matchedSubcategory.workbasketId,
      };
    }
  }

  throw new Error(`No routing defined for service: ${service}`);
}

module.exports = {
  mapServiceToRouting,
};
