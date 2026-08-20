const Client = require('../models/Client.model');

const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high']);
const ALLOWED_STATUSES = new Set(['open', 'pending', 'resolved', 'in_progress', 'qc_pending', 'qc_failed', 'filed']);

const normalizeString = (value) => String(value ?? '').trim();

const normalizeBulkRow = (row = {}) => ({
  title: normalizeString(row.title || row.docketTitle || row.summary),
  description: normalizeString(row.description || row.notes),
  workbasket: normalizeString(row.workbasket || row.team || row.workbasketName),
  category: normalizeString(row.category || row.workType || row.categoryName),
  subcategory: normalizeString(row.subcategory || row.subCategory || row.subcategoryName),
  priority: normalizeString(row.priority || 'medium').toLowerCase(),
  clientId: normalizeString(row.clientId || row.client_id || row.client || row.clientName),
  status: normalizeString(row.status || 'RESOLVED').toUpperCase(),
  startDate: normalizeString(row.startDate || row.start_date || row.createdAt),
  completedDate: normalizeString(row.completedDate || row.completed_date || row.finishedAt),
  assignedToEmail: normalizeString(row.assignedToEmail || row.assignedTo || row.assigned_to),
  docketId: normalizeString(row.docketId || row.caseId || row.caseNumber),
});

const getTeamLookupKey = (team) => [
  String(team?._id || '').trim(),
  normalizeString(team?.name).toLowerCase(),
].filter(Boolean);

const buildValidationContext = async (firmId) => {
  const [teams, categories, clients] = await Promise.all([
    Team.find({ firmId, isActive: true }).select('_id name').lean(),
    Category.find({ firmId, isActive: true }).select('_id name subcategories').lean(),
    Client.find({ firmId }).select('_id clientId businessName status').lean(),
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

  const clientLookup = new Map();
  clients.forEach((client) => {
    if (client.clientId) clientLookup.set(client.clientId.toUpperCase(), client);
    if (client.businessName) clientLookup.set(normalizeString(client.businessName).toLowerCase(), client);
    if (client._id) clientLookup.set(String(client._id), client);
  });

  const defaultCategory = categories.find(
    (category) => (category.subcategories || []).some((sub) => sub?.isActive),
  ) || null;

  return { teamLookup, categoryLookup, clientLookup, defaultCategory };
};

const mapValidationErrors = (validationRow = {}) => validationRow.errors || [];

const validateBulkDockets = async (rows = [], firmId) => {
  const { teamLookup, categoryLookup, clientLookup, defaultCategory } = await buildValidationContext(firmId);

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

    let resolvedClient = null;
    if (normalizedData.clientId) {
      resolvedClient = clientLookup.get(normalizedData.clientId.toUpperCase())
        || clientLookup.get(normalizedData.clientId.toLowerCase());
      if (!resolvedClient) {
        errors.push(`Client "${normalizedData.clientId}" not found`);
      }
    }

    return {
      rowIndex: index + 1,
      isValid: errors.length === 0,
      normalizedData: errors.length === 0
        ? {
          title: normalizedData.title,
          description: normalizedData.description || 'Bulk uploaded historical docket',
          workbasketId: String(resolvedTeam._id),
          workbasketName: resolvedTeam.name,
          categoryId: String(resolvedCategory._id),
          category: resolvedCategory.name,
          subcategoryId: String(resolvedSubcategory.id),
          subcategory: resolvedSubcategory.name,
          priority: normalizedData.priority || 'medium',
          clientId: resolvedClient ? resolvedClient.clientId : undefined,
          status: normalizedData.status || 'RESOLVED',
          startDate: normalizedData.startDate || undefined,
          completedDate: normalizedData.completedDate || undefined,
          assignedTo: normalizedData.assignedToEmail || undefined,
          isHistoricalImport: true,
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
