const Category = require('../models/Category.model');
const Case = require('../models/Case.model');
const mongoose = require('mongoose');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { parseBooleanQuery } = require('../utils/query.utils');
const { logAuthEvent } = require('../services/audit.service');
const log = require('../utils/log');
const { validateCategoryMappedWorkbasket } = require('../services/categoryWorkbasketValidation.service');
const { suggestDocketCategory } = require('../services/docketCategorySuggestion.service');
const {
  createUploadIntent,
  finalizeUpload,
  deleteKnowledgeFile,
  hydrateKnowledgeFiles,
} = require('../services/categoryKnowledgeFile.service');

const normalizeDeadlineRule = (input = {}) => {
  if (!input || typeof input !== 'object') return { mode: 'NONE', allowManualOverride: true };
  const mode = ['NONE', 'TAT_DAYS', 'FIXED_DAY_NEXT_MONTH', 'MANUAL_DATE_REQUIRED', 'EVENT_DATE_OFFSET'].includes(input.mode)
    ? input.mode
    : 'NONE';
  return {
    mode,
    ...(input.tatDays !== undefined ? { tatDays: Number(input.tatDays) } : {}),
    ...(input.fixedDayOfMonth !== undefined ? { fixedDayOfMonth: Number(input.fixedDayOfMonth) } : {}),
    ...(input.eventOffsetDays !== undefined ? { eventOffsetDays: Number(input.eventOffsetDays) } : {}),
    label: typeof input.label === 'string' ? input.label.trim() : '',
    note: typeof input.note === 'string' ? input.note.trim() : '',
    allowManualOverride: input.allowManualOverride !== false,
  };
};


const SOP_LINK_TYPES = new Set(['portal', 'reference', 'template', 'internal', 'other']);
const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ''));
const normalizeSopLinks = (links = []) => {
  if (!Array.isArray(links)) return [];
  return links.slice(0, 25)
    .map((link, index) => {
      const title = typeof link?.title === 'string' ? link.title.trim() : '';
      const url = typeof link?.url === 'string' ? link.url.trim() : '';
      if (!title || !url || !isHttpUrl(url)) return null;
      return {
        id: String(link?.id || new mongoose.Types.ObjectId()).trim(),
        title,
        url,
        description: typeof link?.description === 'string' ? link.description.trim() : '',
        type: SOP_LINK_TYPES.has(link?.type) ? link.type : 'reference',
        sortOrder: Number.isFinite(Number(link?.sortOrder)) ? Number(link.sortOrder) : index,
      };
    })
    .filter(Boolean);
};

const normalizeSopFiles = (files = []) => {
  if (!Array.isArray(files)) return [];
  return files.slice(0, 50)
    .map((file, index) => {
      const fileName = typeof file?.fileName === 'string' ? file.fileName.trim() : '';
      const mimeType = typeof file?.mimeType === 'string' ? file.mimeType.trim() : '';
      const storageProvider = typeof file?.storageProvider === 'string' ? file.storageProvider.trim() : '';
      if (!fileName || !mimeType || !storageProvider) return null;
      return {
        id: String(file?.id || new mongoose.Types.ObjectId()).trim(),
        fileName,
        mimeType,
        size: Number.isFinite(Number(file?.size)) ? Number(file.size) : 0,
        storageProvider,
        storageFileId: typeof file?.storageFileId === 'string' ? file.storageFileId.trim() : null,
        objectKey: typeof file?.objectKey === 'string' ? file.objectKey.trim() : null,
        webViewLink: typeof file?.webViewLink === 'string' ? file.webViewLink.trim() : null,
        uploadedAt: file?.uploadedAt ? new Date(file.uploadedAt) : new Date(),
        uploadedByXID: file?.uploadedByXID ? String(file.uploadedByXID).trim() : null,
        uploadedByName: file?.uploadedByName ? String(file.uploadedByName).trim() : null,
        description: typeof file?.description === 'string' ? file.description.trim() : '',
        sortOrder: Number.isFinite(Number(file?.sortOrder)) ? Number(file.sortOrder) : index,
      };
    })
    .filter(Boolean);
};

const normalizeSubcategorySop = (input = {}, { actorXID, existingSop = null } = {}) => {
  if (!input || typeof input !== 'object') {
    return {
      title: '',
      body: '',
      format: 'plain_text',
      lastUpdatedAt: null,
      lastUpdatedByXID: null,
      links: [],
      files: [],
    };
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body : '';
  const format = input.format === 'markdown' ? 'markdown' : 'plain_text';
  const hasContent = Boolean(title || body);
  const files = input.files !== undefined ? normalizeSopFiles(input.files) : normalizeSopFiles(existingSop?.files || []);

  return {
    title,
    body,
    format,
    links: normalizeSopLinks(input.links),
    files,
    lastUpdatedAt: hasContent || files.length > 0 ? new Date() : null,
    lastUpdatedByXID: (hasContent || files.length > 0) && actorXID ? String(actorXID).trim() : null,
  };
};

const normalizeChecklistTemplate = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: String(item?.id || new mongoose.Types.ObjectId()).trim(),
    title: String(item?.title || '').trim(),
    description: typeof item?.description === 'string' ? item.description.trim() : '',
    required: item?.required === true,
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
    defaultAssigneeXID: item?.defaultAssigneeXID ? String(item.defaultAssigneeXID).trim() : undefined,
    dueOffsetDays: item?.dueOffsetDays === undefined ? undefined : Number(item.dueOffsetDays),
  }));
};

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

const safeLogCategoryMutation = async (req, { description, metadata = {} }) => {
  try {
    await logAuthEvent({
      actionType: 'AdminMutation',
      xID: req.user?.xID || req.user?.xid || 'UNKNOWN',
      performedBy: req.user?.xID || req.user?.xid || 'UNKNOWN',
      firmId: req.user?.firmId,
      userId: req.user?._id,
      description,
      req,
      metadata: {
        domain: 'CATEGORY',
        ...metadata,
      },
    });
  } catch (error) {
    // Best-effort logging only
    log.error('[CATEGORY] Failed to write audit entry', error.message);
  }
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
    const hydratedCategories = await Promise.all(categories.map((category) => hydrateKnowledgeFiles({
      firmId: category?.firmId || firmScope.firmId || req.user?.firmId,
      category,
    })));
    
    res.json({
      success: true,
      data: hydratedCategories,
      count: hydratedCategories.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
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
    
    const hydratedCategory = await hydrateKnowledgeFiles({
      firmId: category?.firmId || firmScope.firmId || req.user?.firmId,
      category,
    });

    res.json({
      success: true,
      data: hydratedCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
    });
  }
};

/**
 * Create a new category (Admin only)
 * POST /api/categories
 */
const createCategory = async (req, res) => {
  try {
    const { name, defaultSlaDays = 0, requiresRelatedEmployeeUser = false } = req.body;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }
    
    // Check for duplicate name (case-insensitive)
    const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Category.findOne({ 
      ...firmScope,
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
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
      requiresRelatedEmployeeUser: requiresRelatedEmployeeUser === true,
    });
    
    await category.save();
    await safeLogCategoryMutation(req, {
      description: `Category created: ${category.name}`,
      metadata: {
        action: 'CATEGORY_CREATED',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        defaultSlaDays: category.defaultSlaDays,
      },
    });
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating category',
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
    const { name, defaultSlaDays, requiresRelatedEmployeeUser } = req.body;
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
    const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Category.findOne({ 
      _id: { $ne: id },
      ...firmScope,
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
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
    if (typeof requiresRelatedEmployeeUser !== 'undefined') {
      category.requiresRelatedEmployeeUser = requiresRelatedEmployeeUser === true;
    }
    await category.save();
    await safeLogCategoryMutation(req, {
      description: `Category updated: ${category.name}`,
      metadata: {
        action: 'CATEGORY_UPDATED',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        defaultSlaDays: category.defaultSlaDays,
      },
    });
    
    res.json({
      success: true,
      data: category,
      message: 'Category updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating category',
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
    await safeLogCategoryMutation(req, {
      description: `Category ${isActive ? 'enabled' : 'disabled'}: ${category.name}`,
      metadata: {
        action: 'CATEGORY_STATUS_UPDATED',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        isActive,
      },
    });
    
    res.json({
      success: true,
      data: category,
      message: `Category ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating category status',
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
    const { name, defaultSlaDays = 0, workbasketId, deadlineRule, checklistTemplate, sop, requiresRelatedEmployeeUser = false } = req.body;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory name is required',
      });
    }
    if (!workbasketId) {
      return res.status(400).json({
        success: false,
        message: 'Workbasket required',
      });
    }
    
    const category = await Category.findOne({ _id: id, ...firmScope });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const workbasketValidation = await validateCategoryMappedWorkbasket({
      workbasketId,
      firmId: firmScope.firmId,
    });
    if (!workbasketValidation.valid) {
      return res.status(400).json({
        success: false,
        message: workbasketValidation.message,
      });
    }
    const workbasket = workbasketValidation.workbasket;
    
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
      workbasketId: workbasket._id,
      isActive: true,
      defaultSlaDays: Math.max(0, Number(defaultSlaDays) || 0),
      requiresRelatedEmployeeUser: requiresRelatedEmployeeUser === true,
      ...(typeof deadlineRule !== 'undefined' ? { deadlineRule: normalizeDeadlineRule(deadlineRule) } : {}),
      checklistTemplate: normalizeChecklistTemplate(checklistTemplate || []),
      ...(typeof sop !== 'undefined' ? { sop: normalizeSubcategorySop(sop, { actorXID: req.user?.xID }) } : {}),
    });
    
    await category.save();
    await safeLogCategoryMutation(req, {
      description: `Subcategory added: ${category.name} / ${name.trim()}`,
      metadata: {
        action: 'SUBCATEGORY_CREATED',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        subcategoryId,
        subcategoryName: name.trim(),
        workbasketId: String(workbasket._id),
        defaultSlaDays: Math.max(0, Number(defaultSlaDays) || 0),
      },
    });
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Subcategory added successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error adding subcategory',
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
    const { name, defaultSlaDays, workbasketId, deadlineRule, checklistTemplate, sop, requiresRelatedEmployeeUser } = req.body;
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
    if (typeof workbasketId !== 'undefined') {
      if (!workbasketId) {
        return res.status(400).json({
          success: false,
          message: 'Workbasket required',
        });
      }
      const workbasketValidation = await validateCategoryMappedWorkbasket({
        workbasketId,
        firmId: firmScope.firmId,
      });
      if (!workbasketValidation.valid) {
        return res.status(400).json({
          success: false,
          message: workbasketValidation.message,
        });
      }
      const workbasket = workbasketValidation.workbasket;
      const previousWorkbasketId = subcategory.workbasketId ? String(subcategory.workbasketId) : null;
      subcategory.workbasketId = workbasket._id;

      if (previousWorkbasketId && previousWorkbasketId !== String(workbasket._id)) {
        const moveResult = await Case.updateMany({
          firmId: firmScope.firmId,
          categoryId: category._id,
          subcategoryId: subcategory.id,
          ownerTeamId: previousWorkbasketId,
          assignedToXID: null,
          $and: [{ state: 'IN_WB' }, { state: { $nin: ['RESOLVED', 'FILED'] } }],
          status: { $nin: ['RESOLVED', 'FILED'] },
        }, {
          $set: {
            ownerTeamId: workbasket._id,
            workbasketId: workbasket._id,
            routedToTeamId: null,
          },
        });

        log.info('[CATEGORY] Subcategory mapping changed; moved WB dockets', {
          firmId: firmScope.firmId,
          categoryId: String(category._id),
          subcategoryId: subcategory.id,
          fromWorkbasketId: previousWorkbasketId,
          toWorkbasketId: String(workbasket._id),
          movedCount: moveResult.modifiedCount || 0,
        });
      }
    }
    if (typeof defaultSlaDays !== 'undefined') {
      subcategory.defaultSlaDays = Math.max(0, Number(defaultSlaDays) || 0);
    }
    if (typeof requiresRelatedEmployeeUser !== 'undefined') {
      subcategory.requiresRelatedEmployeeUser = requiresRelatedEmployeeUser === true;
    }
    if (typeof deadlineRule !== 'undefined') {
      subcategory.deadlineRule = normalizeDeadlineRule(deadlineRule);
    }
    if (typeof checklistTemplate !== 'undefined') {
      subcategory.checklistTemplate = normalizeChecklistTemplate(checklistTemplate);
    }
    if (typeof sop !== 'undefined') {
      subcategory.sop = normalizeSubcategorySop(sop, { actorXID: req.user?.xID, existingSop: subcategory.sop });
    }
    await category.save();
    await safeLogCategoryMutation(req, {
      description: `Subcategory updated: ${category.name} / ${subcategory.name}`,
      metadata: {
        action: 'SUBCATEGORY_UPDATED',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
        workbasketId: subcategory.workbasketId ? String(subcategory.workbasketId) : null,
        defaultSlaDays: subcategory.defaultSlaDays,
      },
    });
    
    res.json({
      success: true,
      data: category,
      message: 'Subcategory updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating subcategory',
    });
  }
};

const createSubcategoryKnowledgeFileUploadIntent = async (req, res) => {
  try {
    const { id, subcategoryId } = req.params;
    const { fileName, mimeType, size } = req.body || {};
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;

    const category = await Category.findOne({ _id: id, ...firmScope }).select('_id subcategories');
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const subcategory = category.subcategories.find((sub) => String(sub.id) === String(subcategoryId));
    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    const intent = await createUploadIntent({
      firmId: firmScope.firmId,
      categoryId: id,
      subcategoryId,
      fileName,
      mimeType,
      size,
    });

    return res.status(201).json({
      success: true,
      data: intent,
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code || undefined });
    }
    log.error('[CATEGORY] Failed to create knowledge file upload intent', error.message);
    return res.status(500).json({ success: false, message: 'Unable to create knowledge file upload intent' });
  }
};

const finalizeSubcategoryKnowledgeFileUpload = async (req, res) => {
  try {
    const { id, subcategoryId } = req.params;
    const { uploadId, completion = {}, checksum, fileName, mimeType, size } = req.body || {};
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;

    const category = await Category.findOne({ _id: id, ...firmScope }).select('_id subcategories name');
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const subcategory = category.subcategories.find((sub) => String(sub.id) === String(subcategoryId));
    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    const result = await finalizeUpload({
      firmId: firmScope.firmId,
      categoryId: id,
      subcategoryId,
      fileName,
      mimeType,
      size,
      completion,
      checksum,
      actorXID: req.user?.xID,
      actorName: req.user?.name || req.user?.email || req.user?.xID || 'System',
    });

    await safeLogCategoryMutation(req, {
      description: `Knowledge file uploaded: ${category.name} / ${subcategory.name}`,
      metadata: {
        action: 'SUBCATEGORY_KNOWLEDGE_FILE_UPLOADED',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
        fileId: result.file?.id || null,
        fileName: result.file?.fileName || fileName || null,
        mimeType: result.file?.mimeType || mimeType || null,
        size: result.file?.size || size || null,
      },
    });

    const hydratedCategory = await hydrateKnowledgeFiles({
      firmId: firmScope.firmId,
      category: result.category,
    });
    const hydratedSubcategory = hydratedCategory.subcategories.find((sub) => String(sub.id) === String(subcategoryId));
    const hydratedFile = hydratedSubcategory?.sop?.files?.find((entry) => String(entry.id) === String(result.file?.id));

    return res.status(201).json({
      success: true,
      data: {
        category: hydratedCategory,
        file: hydratedFile || result.file,
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code || undefined });
    }
    log.error('[CATEGORY] Failed to finalize knowledge file upload', error.message);
    return res.status(500).json({ success: false, message: 'Unable to finalize knowledge file upload' });
  }
};

const deleteSubcategoryKnowledgeFile = async (req, res) => {
  try {
    const { id, subcategoryId, fileId } = req.params;
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;

    const category = await Category.findOne({ _id: id, ...firmScope }).select('_id name subcategories');
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const subcategory = category.subcategories.find((sub) => String(sub.id) === String(subcategoryId));
    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    const result = await deleteKnowledgeFile({
      firmId: firmScope.firmId,
      categoryId: id,
      subcategoryId,
      fileId,
    });

    await safeLogCategoryMutation(req, {
      description: `Knowledge file removed: ${category.name} / ${subcategory.name}`,
      metadata: {
        action: 'SUBCATEGORY_KNOWLEDGE_FILE_DELETED',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
        fileId,
        fileName: result.file?.fileName || null,
      },
    });

    return res.json({
      success: true,
      data: {
        fileId,
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code || undefined });
    }
    log.error('[CATEGORY] Failed to delete knowledge file', error.message);
    return res.status(500).json({ success: false, message: 'Unable to delete knowledge file' });
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
    await safeLogCategoryMutation(req, {
      description: `Subcategory ${isActive ? 'enabled' : 'disabled'}: ${category.name} / ${subcategory.name}`,
      metadata: {
        action: 'SUBCATEGORY_STATUS_UPDATED',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
        isActive,
      },
    });
    
    res.json({
      success: true,
      data: category,
      message: `Subcategory ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating subcategory status',
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
    await safeLogCategoryMutation(req, {
      description: `Category deactivated: ${category.name}`,
      metadata: {
        action: 'CATEGORY_DELETED_SOFT',
        categoryId: category._id?.toString(),
        categoryName: category.name,
      },
    });
    
    res.json({
      success: true,
      data: category,
      message: 'Category deactivated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error deleting category',
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
    await safeLogCategoryMutation(req, {
      description: `Subcategory deactivated: ${category.name} / ${subcategory.name}`,
      metadata: {
        action: 'SUBCATEGORY_DELETED_SOFT',
        categoryId: category._id?.toString(),
        categoryName: category.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
      },
    });
    
    res.json({
      success: true,
      data: category,
      message: 'Subcategory deactivated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error deleting subcategory',
    });
  }
};


const suggestCategory = async (req, res) => {
  try {
    const firmScope = resolveCategoryFirmScope(req, res);
    if (!firmScope) return;
    const title = String(req.body?.title || '');
    const description = String(req.body?.description || '');
    if (title.length > 2000 || description.length > 4000) {
      return res.status(413).json({ success: false, message: 'Input payload too large.' });
    }
    const categories = await Category.find({ ...firmScope, isActive: true }).select('_id name isActive subcategories').lean();
    const result = suggestDocketCategory({
      firmId: req.user?.firmId,
      title,
      description,
      categories,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    log.error('[CATEGORY] Suggestion lookup failed', error.message);
    return res.status(500).json({ success: false, message: 'Failed to suggest category' });
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
  createSubcategoryKnowledgeFileUploadIntent: wrapWriteHandler(createSubcategoryKnowledgeFileUploadIntent),
  finalizeSubcategoryKnowledgeFileUpload: wrapWriteHandler(finalizeSubcategoryKnowledgeFileUpload),
  deleteSubcategoryKnowledgeFile: wrapWriteHandler(deleteSubcategoryKnowledgeFile),
  toggleSubcategoryStatus: wrapWriteHandler(toggleSubcategoryStatus),
  deleteSubcategory: wrapWriteHandler(deleteSubcategory),
  suggestCategory,
};
