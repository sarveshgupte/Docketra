const Team = require('../models/Team.model');
const Category = require('../models/Category.model');

const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high']);

const normalizeString = (value) => String(value ?? '').trim();

const normalizeBulkRow = (row = {}) => ({
  title: normalizeString(row.title),
  description: normalizeString(row.description),
  workbasket: normalizeString(row.workbasket),
  category: normalizeString(row.category),
  subcategory: normalizeString(row.subcategory),
  priority: normalizeString(row.priority).toLowerCase(),
});

const getTeamLookupKey = (team) => [
  String(team?._id || '').trim(),
  normalizeString(team?.name).toLowerCase(),
].filter(Boolean);

const buildValidationContext = async (firmId) => {
  const [teams, categories] = await Promise.all([
    Team.find({ firmId, isActive: true }).select('_id name').lean(),
    Category.find({ firmId, isActive: true }).select('_id name subcategories').lean(),
  ]);

  const teamLookup = new Map();
  teams.forEach((team) => {
    getTeamLookupKey(team).forEach((key) => teamLookup.set(key, team));
  });

  const categoryLookup = new Map();
  categories.forEach((category) => {
    categoryLookup.set(String(category._id), category);
    categoryLookup.set(normalizeString(category.name).toLowerCase(), category);
  });

  const defaultCategory = categories.find(
    (category) => (category.subcategories || []).some((sub) => sub?.isActive),
  ) || null;

  return { teamLookup, categoryLookup, defaultCategory };
};

const mapValidationErrors = (validationRow = {}) => validationRow.errors || [];

const validateBulkDockets = async (rows = [], firmId) => {
  const { teamLookup, categoryLookup, defaultCategory } = await buildValidationContext(firmId);

  return rows.map((row, index) => {
    const normalizedData = normalizeBulkRow(row);
    const errors = [];

    if (!normalizedData.title) {
      errors.push('Missing title');
    }

    const teamKey = normalizedData.workbasket.toLowerCase();
    const resolvedTeam = teamLookup.get(normalizedData.workbasket) || teamLookup.get(teamKey);
    if (!resolvedTeam) {
      errors.push('Invalid workbasket');
    }

    let resolvedCategory = null;
    if (normalizedData.category) {
      resolvedCategory = categoryLookup.get(normalizedData.category) || categoryLookup.get(normalizedData.category.toLowerCase());
      if (!resolvedCategory) {
        errors.push('Invalid category');
      }
    } else {
      resolvedCategory = defaultCategory;
      if (!resolvedCategory) {
        errors.push('No active category available for this firm');
      }
    }

    let resolvedSubcategory = null;
    const activeSubcategories = (resolvedCategory?.subcategories || []).filter((sub) => sub?.isActive);

    if (normalizedData.subcategory) {
      resolvedSubcategory = activeSubcategories.find(
        (sub) => String(sub.id) === normalizedData.subcategory
          || normalizeString(sub.name).toLowerCase() === normalizedData.subcategory.toLowerCase(),
      ) || null;

      if (!resolvedSubcategory) {
        errors.push('Invalid subcategory');
      }
    } else if (activeSubcategories.length > 0) {
      resolvedSubcategory = activeSubcategories.find(
        (sub) => resolvedTeam && String(sub.workbasketId) === String(resolvedTeam._id),
      ) || activeSubcategories[0];
    }

    if (resolvedCategory && !resolvedSubcategory) {
      errors.push('Subcategory is required for selected category');
    }

    if (normalizedData.priority && !ALLOWED_PRIORITIES.has(normalizedData.priority)) {
      errors.push('Invalid priority. Allowed values: LOW, MEDIUM, HIGH');
    }

    return {
      rowIndex: index + 1,
      isValid: errors.length === 0,
      normalizedData: errors.length === 0
        ? {
          title: normalizedData.title,
          description: normalizedData.description || 'Bulk uploaded docket',
          workbasketId: String(resolvedTeam._id),
          workbasketName: resolvedTeam.name,
          categoryId: String(resolvedCategory._id),
          category: resolvedCategory.name,
          subcategoryId: String(resolvedSubcategory.id),
          subcategory: resolvedSubcategory.name,
          priority: normalizedData.priority || 'medium',
        }
        : undefined,
      errors,
    };
  });
};

module.exports = {
  validateBulkDockets,
  normalizeBulkRow,
  mapValidationErrors,
};
