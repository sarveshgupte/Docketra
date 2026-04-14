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

function getConfidenceLevel(score) {
  if (score > 0.8) return 'HIGH';
  if (score > 0.5) return 'MEDIUM';
  return 'LOW';
}

function parsePreviewFlag(value) {
  return String(value || '').toLowerCase() === 'true';
}

function buildWarnings({ confidenceLevel, missingFields }) {
  const warnings = [];

  if (confidenceLevel === 'LOW') {
    warnings.push('Low confidence in client selection');
  }

  if (Array.isArray(missingFields) && missingFields.includes('subCategoryId')) {
    warnings.push('Missing subcategory');
  }

  return warnings;
}

async function findAnalyzedAttachment({ attachmentId, req }) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) {
    return { error: { status: 404, body: { success: false, message: 'Attachment not found' } } };
  }

  const firmId = String(attachment.firmId);
  if (req.firmId && String(req.firmId) !== firmId) {
    return { error: { status: 403, body: { success: false, message: 'Attachment not found in this firm context' } } };
  }

  if (attachment?.analysis?.status !== 'COMPLETED') {
    return { error: { status: 409, body: { success: false, message: 'Attachment analysis is not completed yet' } } };
  }

  return { attachment, firmId };
}

async function generateSuggestions({ attachment, firmId }) {
  const clients = await Client.find({ firmId, status: 'ACTIVE' })
    .select('clientId businessName')
    .lean();

  const categories = await Category.find({ firmId, isActive: true })
    .select('_id name subcategories')
    .lean();

  if (!clients.length) {
    return { error: { status: 400, body: { success: false, message: 'No active clients found for this firm' } } };
  }

  if (!categories.length) {
    return { error: { status: 400, body: { success: false, message: 'No categories found for this firm' } } };
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
    return { error: { status: 400, body: { success: false, message: 'No active subcategories found for this firm' } } };
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
    return {
      error: {
        status,
        body: {
          success: false,
          message: 'AI failed to generate docket suggestions',
          code: error?.code || 'AI_DOCKET_GENERATION_FAILED',
        },
      },
    };
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
    return {
      error: {
        status: 400,
        body: { success: false, message: 'No valid subcategory available to create draft docket' },
      },
    };
  }

  const missingFields = [];
  if (!suggestedClientId) missingFields.push('clientId');
  if (!suggestedCategoryId) missingFields.push('categoryId');
  if (!suggestedSubCategoryId) missingFields.push('subCategoryId');

  const confidence = normalizeConfidence(aiOutput?.confidence);
  const confidenceLevel = getConfidenceLevel(confidence);
  const warnings = buildWarnings({ confidenceLevel, missingFields });

  const payload = {
    clientId: suggestedClientId,
    categoryId: suggestedCategoryId,
    subCategoryId: suggestedSubCategoryId,
    title: String(aiOutput?.title || '').trim() || `Draft from ${attachment.fileName || 'attachment'}`,
    description: String(aiOutput?.description || '').trim() || 'AI-generated draft docket from analyzed attachment.',
    confidence,
    confidenceLevel,
    missingFields,
    warnings,
  };

  console.info('[AI] suggestions_generated', {
    attachmentId: String(attachment._id),
    firmId,
    confidence,
    confidenceLevel,
    missingFieldsCount: missingFields.length,
  });

  return {
    suggestions: payload,
    fallback: {
      clientId: clients[0].clientId,
      categoryId: fallbackCategory.id,
      category: fallbackCategory.name,
      subcategoryId: fallbackSubCategory.id,
      subcategory: fallbackSubCategory.name,
    },
  };
}

async function getAttachmentAiInsights(req, res) {
  const { attachmentId } = req.params;
  const attachment = await Attachment.findById(attachmentId).lean();

  if (!attachment) {
    return res.status(404).json({ success: false, message: 'Attachment not found' });
  }

  const firmId = String(attachment.firmId);
  if (req.firmId && String(req.firmId) !== firmId) {
    return res.status(403).json({ success: false, message: 'Attachment not found in this firm context' });
  }

  const confidence = normalizeConfidence(attachment?.analysis?.confidence);
  const confidenceLevel = getConfidenceLevel(confidence);

  console.info('[AI] insights_viewed', {
    attachmentId: String(attachment._id),
    firmId,
    status: attachment?.analysis?.status || 'PENDING',
  });

  return res.json({
    documentType: attachment?.analysis?.documentType || null,
    extractedFields: attachment?.analysis?.extractedFields || {},
    tags: Array.isArray(attachment?.analysis?.tags) ? attachment.analysis.tags : [],
    suggestedTeam: attachment?.analysis?.suggestedTeam || null,
    confidence,
    confidenceLevel,
    status: attachment?.analysis?.status || 'PENDING',
  });
}

async function getDocketAiSuggestions(req, res) {
  const { attachmentId } = req.params;
  const attachmentResult = await findAnalyzedAttachment({ attachmentId, req });
  if (attachmentResult.error) {
    return res.status(attachmentResult.error.status).json(attachmentResult.error.body);
  }

  const result = await generateSuggestions({
    attachment: attachmentResult.attachment,
    firmId: attachmentResult.firmId,
  });

  if (result.error) {
    return res.status(result.error.status).json(result.error.body);
  }

  return res.json(result.suggestions);
}

async function createDocketFromAttachment(req, res) {
  const featureFlagRaw = process.env.ENABLE_AI_DOCKET_CREATION;
  const isFeatureEnabled = featureFlagRaw == null || String(featureFlagRaw).toLowerCase() === 'true';
  if (!isFeatureEnabled) {
    return res.status(403).json({ success: false, message: 'AI docket creation is disabled' });
  }

  const isPreview = parsePreviewFlag(req.query.preview);
  const { attachmentId } = req.params;

  const attachmentResult = await findAnalyzedAttachment({ attachmentId, req });
  if (attachmentResult.error) {
    return res.status(attachmentResult.error.status).json(attachmentResult.error.body);
  }

  const result = await generateSuggestions({
    attachment: attachmentResult.attachment,
    firmId: attachmentResult.firmId,
  });

  if (result.error) {
    return res.status(result.error.status).json(result.error.body);
  }

  if (isPreview) {
    return res.json({
      preview: true,
      ...result.suggestions,
    });
  }

  const creatorXid = req.user?.xID || null;
  if (!creatorXid) {
    return res.status(400).json({ success: false, message: 'User xID is required to create docket' });
  }

  const docket = await Case.create({
    firmId: attachmentResult.firmId,
    clientId: result.suggestions.clientId || result.fallback.clientId,
    categoryId: result.fallback.categoryId,
    subcategoryId: result.fallback.subcategoryId,
    category: result.fallback.category,
    caseCategory: result.fallback.category,
    subcategory: result.fallback.subcategory,
    caseSubCategory: result.fallback.subcategory,
    title: result.suggestions.title,
    description: result.suggestions.description,
    status: 'DRAFT',
    createdByXID: creatorXid,
    createdBy: req.user?.email || req.user?.xID || 'system@docketra.local',
  });

  attachmentResult.attachment.caseId = docket.caseId || docket.caseNumber;
  await attachmentResult.attachment.save();

  return res.status(201).json({
    docketId: docket.caseId || docket.caseNumber,
    suggested: {
      clientId: result.suggestions.clientId,
      categoryId: result.suggestions.categoryId,
      subCategoryId: result.suggestions.subCategoryId,
    },
    confidence: result.suggestions.confidence,
    confidenceLevel: result.suggestions.confidenceLevel,
    missingFields: result.suggestions.missingFields,
    warnings: result.suggestions.warnings,
  });
}

module.exports = {
  createDocketFromAttachment,
  getAttachmentAiInsights,
  getDocketAiSuggestions,
  getConfidenceLevel,
};
