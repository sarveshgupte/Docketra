'use strict';

const Attachment = require('../models/Attachment.model');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const aiService = require('../services/ai/ai.service');
const { resolveCaseIdentifier } = require('../utils/caseIdentifier');
const log = require('../utils/log');
const { buildClientStatusQuery } = require('../utils/clientStatus');

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

function getRoutingConfidenceLevel(score) {
  if (score > 0.8) return 'HIGH';
  if (score < 0.5) return 'LOW';
  return 'MEDIUM';
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

async function generateSuggestions({ attachment, firmId, requestId = null, userRole = null }) {
  const clients = await Client.find({ firmId, status: buildClientStatusQuery('active') })
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
    }, firmId, { requestId, userRole });
  } catch (error) {
    const errorCode = error?.code || 'AI_DOCKET_GENERATION_FAILED';
    const status = (
      errorCode === 'AI_API_KEY_NOT_CONFIGURED' || errorCode === 'AI_PROVIDER_NOT_CONFIGURED' || errorCode === 'AI_INVALID_API_KEY'
    ) ? 400 : (
      errorCode === 'AI_DISABLED_FOR_FIRM' || errorCode === 'AI_FEATURE_DISABLED' || errorCode === 'AI_ROLE_NOT_ALLOWED'
    ) ? 403 : 502;

    return {
      error: {
        status,
        body: {
          success: false,
          message: 'AI failed to generate docket suggestions',
          code: errorCode,
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

  log.info('[AI] suggestions_generated', {
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

  log.info('[AI] insights_viewed', {
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
    requestId: req.requestId || null,
    userRole: req.user?.role || null,
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
    requestId: req.requestId || null,
    userRole: req.user?.role || null,
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

  const suggestedTeam = String(attachmentResult.attachment?.analysis?.suggestedTeam || '').trim() || null;
  const confidence = normalizeConfidence(attachmentResult.attachment?.analysis?.confidence);
  const workbasketMatch = suggestedTeam
    ? await Team.findOne({
      firmId: req.user?.firmId,
      name: new RegExp(`^${suggestedTeam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      isActive: true,
    }).select('_id name').lean()
    : null;

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
    aiRouting: {
      suggestedTeam,
      suggestedWorkbasketId: workbasketMatch?._id || null,
      confidence,
      status: 'PENDING',
    },
  });

  log.info('[AI] routing_suggested', {
    docketId: docket.caseId || docket.caseNumber,
    caseInternalId: String(docket.caseInternalId),
    firmId: attachmentResult.firmId,
    suggestedTeam,
    suggestedWorkbasketId: workbasketMatch?._id ? String(workbasketMatch._id) : null,
    confidence,
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

async function resolveDocketByIdentifier(req, docketId) {
  const internalId = await resolveCaseIdentifier(req.user?.firmId, docketId, req.user?.role);
  const docket = await Case.findOne({ caseInternalId: internalId, firmId: req.user?.firmId });
  if (!docket) {
    return null;
  }
  return docket;
}

async function ensureAiRoutingSuggestion(docket, req) {
  const existingTeam = String(docket?.aiRouting?.suggestedTeam || '').trim();
  if (existingTeam) return docket;

  const analyzedAttachment = await Attachment.findOne({
    firmId: req.user?.firmId,
    caseId: docket.caseId,
    'analysis.status': 'COMPLETED',
    'analysis.suggestedTeam': { $exists: true, $ne: null },
  }).sort({ updatedAt: -1 });

  if (!analyzedAttachment) return docket;

  const suggestedTeam = String(analyzedAttachment.analysis?.suggestedTeam || '').trim();
  const confidence = normalizeConfidence(analyzedAttachment.analysis?.confidence);
  const matchedWorkbasket = suggestedTeam
    ? await Team.findOne({
      firmId: req.user?.firmId,
      name: new RegExp(`^${suggestedTeam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      isActive: true,
    }).select('_id name').lean()
    : null;

  docket.aiRouting = docket.aiRouting || {};
  docket.aiRouting.suggestedTeam = suggestedTeam || null;
  docket.aiRouting.suggestedWorkbasketId = matchedWorkbasket?._id || null;
  docket.aiRouting.confidence = confidence;
  docket.aiRouting.status = docket.aiRouting.status || 'PENDING';
  await docket.save();

  log.info('[AI] routing_suggested', {
    docketId: docket.caseId || docket.caseNumber,
    caseInternalId: String(docket.caseInternalId),
    firmId: String(docket.firmId),
    suggestedTeam: docket.aiRouting.suggestedTeam,
    suggestedWorkbasketId: docket.aiRouting.suggestedWorkbasketId ? String(docket.aiRouting.suggestedWorkbasketId) : null,
    confidence,
  });

  return docket;
}

async function getAiRoutingSuggestion(req, res) {
  try {
    let docket = await resolveDocketByIdentifier(req, req.params.docketId);
    if (!docket) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }
    docket = await ensureAiRoutingSuggestion(docket, req);

    const confidence = normalizeConfidence(docket?.aiRouting?.confidence);
    const confidenceLevel = getRoutingConfidenceLevel(confidence);

    return res.json({
      suggestedTeam: docket?.aiRouting?.suggestedTeam || null,
      workbasketId: docket?.aiRouting?.suggestedWorkbasketId ? String(docket.aiRouting.suggestedWorkbasketId) : null,
      confidence,
      confidenceLevel,
      status: docket?.aiRouting?.status || 'PENDING',
      requiresManualRouting: confidence < 0.5,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Unable to load AI routing suggestion' });
  }
}

async function applyAiRouting(req, res) {
  try {
    let docket = await resolveDocketByIdentifier(req, req.params.docketId);
    if (!docket) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }
    docket = await ensureAiRoutingSuggestion(docket, req);

    docket.aiRouting = docket.aiRouting || {};
    const suggestedWorkbasketId = docket.aiRouting.suggestedWorkbasketId;
    if (!suggestedWorkbasketId) {
      return res.status(409).json({ success: false, message: 'No AI workbasket suggestion available to apply' });
    }

    const workbasket = await Team.findOne({
      _id: suggestedWorkbasketId,
      firmId: req.user?.firmId,
      isActive: true,
    }).select('_id name').lean();

    if (!workbasket) {
      return res.status(409).json({ success: false, message: 'Suggested workbasket is no longer available' });
    }

    docket.workbasketId = workbasket._id;
    docket.routedToTeamId = workbasket._id;
    docket.aiRouting.status = 'APPLIED';
    await docket.save();

    log.info('[AI] routing_applied', {
      docketId: docket.caseId || docket.caseNumber,
      caseInternalId: String(docket.caseInternalId),
      firmId: String(docket.firmId),
      appliedWorkbasketId: String(workbasket._id),
      appliedByXID: req.user?.xID || null,
    });

    return res.json({
      success: true,
      docketId: docket.caseId || docket.caseNumber,
      workbasketId: String(workbasket._id),
      status: docket.aiRouting.status,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Unable to apply AI routing' });
  }
}

async function rejectAiRouting(req, res) {
  try {
    let docket = await resolveDocketByIdentifier(req, req.params.docketId);
    if (!docket) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }
    docket = await ensureAiRoutingSuggestion(docket, req);

    docket.aiRouting = docket.aiRouting || {};
    docket.aiRouting.status = 'REJECTED';
    await docket.save();

    log.info('[AI] routing_rejected', {
      docketId: docket.caseId || docket.caseNumber,
      caseInternalId: String(docket.caseInternalId),
      firmId: String(docket.firmId),
      rejectedByXID: req.user?.xID || null,
    });

    return res.json({
      success: true,
      docketId: docket.caseId || docket.caseNumber,
      status: docket.aiRouting.status,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Unable to reject AI routing' });
  }
}

module.exports = {
  applyAiRouting,
  createDocketFromAttachment,
  getAiRoutingSuggestion,
  getAttachmentAiInsights,
  getDocketAiSuggestions,
  getConfidenceLevel,
  rejectAiRouting,
};
