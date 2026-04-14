'use strict';

const Attachment = require('../models/Attachment.model');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const Case = require('../models/Case.model');
const aiService = require('../services/ai/ai.service');

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

async function createDocketFromAttachment(req, res) {
  const featureFlagRaw = process.env.ENABLE_AI_DOCKET_CREATION;
  const isFeatureEnabled = featureFlagRaw == null || String(featureFlagRaw).toLowerCase() === 'true';
  if (!isFeatureEnabled) {
    return res.status(403).json({ success: false, message: 'AI docket creation is disabled' });
  }

  const { attachmentId } = req.params;
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) {
    return res.status(404).json({ success: false, message: 'Attachment not found' });
  }

  const firmId = String(attachment.firmId);
  if (req.firmId && String(req.firmId) !== firmId) {
    return res.status(403).json({ success: false, message: 'Attachment not found in this firm context' });
  }

  if (attachment?.analysis?.status !== 'COMPLETED') {
    return res.status(409).json({ success: false, message: 'Attachment analysis is not completed yet' });
  }

  const clients = await Client.find({ firmId, status: 'ACTIVE' })
    .select('clientId businessName')
    .lean();

  const categories = await Category.find({ firmId, isActive: true })
    .select('_id name subcategories')
    .lean();

  if (!clients.length) {
    return res.status(400).json({ success: false, message: 'No active clients found for this firm' });
  }

  if (!categories.length) {
    return res.status(400).json({ success: false, message: 'No categories found for this firm' });
  }

  const categoriesWithSubcategories = categories
    .map((category) => ({
      id: String(category._id),
      name: category.name,
      subCategories: (category.subcategories || [])
        .filter((sub) => sub?.isActive !== false)
        .map((sub) => ({ id: String(sub.id), name: sub.name })),
    }))
    .filter((category) => category.subCategories.length > 0);

  if (!categoriesWithSubcategories.length) {
    return res.status(400).json({ success: false, message: 'No active subcategories found for this firm' });
  }

  let aiOutput;
  try {
    aiOutput = await aiService.generateDocketFields({
      documentType: attachment.analysis.documentType,
      extractedFields: attachment.analysis.extractedFields || {},
      tags: Array.isArray(attachment.analysis.tags) ? attachment.analysis.tags : [],
      clients: clients.map((client) => ({ id: client.clientId, name: client.businessName })),
      categories: categoriesWithSubcategories,
    }, firmId);
  } catch (error) {
    const status = error?.code === 'AI_API_KEY_NOT_CONFIGURED' ? 400 : 502;
    return res.status(status).json({
      success: false,
      message: 'AI failed to generate docket suggestions',
      code: error?.code || 'AI_DOCKET_GENERATION_FAILED',
    });
  }

  const validClientIds = new Set(clients.map((client) => String(client.clientId)));
  const validCategoryIds = new Set(categoriesWithSubcategories.map((category) => String(category.id)));

  const suggestedClientId = validClientIds.has(String(aiOutput?.clientId || '')) ? String(aiOutput.clientId) : null;
  const suggestedCategoryId = validCategoryIds.has(String(aiOutput?.categoryId || '')) ? String(aiOutput.categoryId) : null;

  const selectedCategory = categoriesWithSubcategories.find((category) => category.id === suggestedCategoryId) || null;
  const validSubCategoryIds = new Set((selectedCategory?.subCategories || []).map((sub) => sub.id));
  const suggestedSubCategoryId = validSubCategoryIds.has(String(aiOutput?.subCategoryId || ''))
    ? String(aiOutput.subCategoryId)
    : null;

  const fallbackCategory = selectedCategory || categoriesWithSubcategories[0];
  const fallbackSubCategory = suggestedSubCategoryId
    ? fallbackCategory.subCategories.find((sub) => sub.id === suggestedSubCategoryId)
    : fallbackCategory.subCategories[0];

  if (!fallbackSubCategory) {
    return res.status(400).json({ success: false, message: 'No valid subcategory available to create draft docket' });
  }

  const missingFields = [];
  if (!suggestedClientId) missingFields.push('clientId');
  if (!suggestedCategoryId) missingFields.push('categoryId');
  if (!suggestedSubCategoryId) missingFields.push('subCategoryId');

  const creatorXid = req.user?.xID || null;
  if (!creatorXid) {
    return res.status(400).json({ success: false, message: 'User xID is required to create docket' });
  }

  const docket = await Case.create({
    firmId,
    clientId: suggestedClientId || clients[0].clientId,
    categoryId: fallbackCategory.id,
    subcategoryId: fallbackSubCategory.id,
    category: fallbackCategory.name,
    caseCategory: fallbackCategory.name,
    subcategory: fallbackSubCategory.name,
    caseSubCategory: fallbackSubCategory.name,
    title: String(aiOutput?.title || '').trim() || `Draft from ${attachment.fileName || 'attachment'}`,
    description: String(aiOutput?.description || '').trim() || 'AI-generated draft docket from analyzed attachment.',
    status: 'DRAFT',
    createdByXID: creatorXid,
    createdBy: req.user?.email || req.user?.xID || 'system@docketra.local',
  });

  attachment.caseId = docket.caseId || docket.caseNumber;
  await attachment.save();

  return res.status(201).json({
    docketId: docket.caseId || docket.caseNumber,
    suggested: {
      clientId: suggestedClientId,
      categoryId: suggestedCategoryId,
      subCategoryId: suggestedSubCategoryId,
    },
    confidence: normalizeConfidence(aiOutput?.confidence),
    missingFields,
  });
}

module.exports = {
  createDocketFromAttachment,
};
