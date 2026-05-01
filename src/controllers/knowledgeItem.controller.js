const mongoose = require('mongoose');
const KnowledgeItem = require('../models/KnowledgeItem.model');

const { KNOWLEDGE_ITEM_TYPES, KNOWLEDGE_ITEM_STATUSES } = KnowledgeItem;

const parsePagination = (query = {}) => {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawPage = Number.parseInt(query.page, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;
  const skip = (page - 1) * limit;
  return { limit, skip, page };
};

const normalizeXid = (user = {}) =>
  String(user?.xid || user?.xID || '').trim().toUpperCase() || null;

const normalizeTags = (rawTags) => {
  if (!Array.isArray(rawTags)) return [];
  return rawTags
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
};

const parseDateOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeChecklistSteps = (input) => {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new Error('checklistSteps must be an array');
  if (input.length > 100) throw new Error('checklistSteps must not exceed 100 steps');

  const normalized = input.map((step, index) => {
    const label = String(step?.label || '').trim();
    if (!label) throw new Error(`checklistSteps[${index}].label is required`);
    const description = step?.description ? String(step.description).trim() : '';
    const rawOrder = step?.order;
    const parsedOrder = Number(rawOrder);
    return {
      label,
      description: description || null,
      order: Number.isFinite(parsedOrder) ? parsedOrder : (index + 1),
      required: step?.required === undefined ? true : Boolean(step.required),
    };
  });

  return normalized
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({ ...step, order: index + 1 }));
};

const createKnowledgeItem = async (req, res) => {
  try {
    const actorXid = normalizeXid(req.user);
    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const type = String(req.body?.type || '').trim().toLowerCase();
    if (!KNOWLEDGE_ITEM_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${KNOWLEDGE_ITEM_TYPES.join(', ')}`,
      });
    }

    const status = req.body?.status
      ? String(req.body.status).trim().toLowerCase()
      : 'draft';
    if (!KNOWLEDGE_ITEM_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${KNOWLEDGE_ITEM_STATUSES.join(', ')}`,
      });
    }

    const tags = normalizeTags(req.body?.tags);

    const linkedClientId = req.body?.linkedClientId
      ? req.body.linkedClientId
      : null;
    const checklistSteps = normalizeChecklistSteps(req.body?.checklistSteps);

    const item = await KnowledgeItem.create({
      firmId: req.user.firmId,
      title,
      type,
      status,
      summary: req.body?.summary ? String(req.body.summary).trim() || null : null,
      content: req.body?.content ? String(req.body.content).trim() || null : null,
      tags,
      ownerXid: req.body?.ownerXid
        ? String(req.body.ownerXid).trim().toUpperCase() || null
        : null,
      linkedClientId,
      linkedDocketId: req.body?.linkedDocketId
        ? String(req.body.linkedDocketId).trim() || null
        : null,
      linkedWorkType: req.body?.linkedWorkType
        ? String(req.body.linkedWorkType).trim() || null
        : null,
      checklistSteps,
      reviewDueAt: parseDateOrNull(req.body?.reviewDueAt),
      lastReviewedAt: parseDateOrNull(req.body?.lastReviewedAt),
      createdByXid: actorXid || 'SYSTEM',
      updatedByXid: actorXid || null,
    });

    return res.status(201).json({ success: true, data: item.toObject() });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create knowledge item' });
  }
};

const listKnowledgeItems = async (req, res) => {
  try {
    const { limit, skip, page } = parsePagination(req.query);
    const filter = { firmId: req.user.firmId };

    if (req.query.type) {
      const type = String(req.query.type).trim().toLowerCase();
      if (KNOWLEDGE_ITEM_TYPES.includes(type)) filter.type = type;
    }

    if (req.query.status) {
      const status = String(req.query.status).trim().toLowerCase();
      if (KNOWLEDGE_ITEM_STATUSES.includes(status)) filter.status = status;
    }

    if (req.query.tag) {
      const tag = String(req.query.tag).trim().toLowerCase();
      if (tag) filter.tags = tag;
    }

    if (req.query.clientId) {
      const clientId = String(req.query.clientId).trim();
      if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
        filter.linkedClientId = new mongoose.Types.ObjectId(clientId);
      }
    }

    if (req.query.linkedDocketId) {
      const linkedDocketId = String(req.query.linkedDocketId).trim();
      if (linkedDocketId) filter.linkedDocketId = linkedDocketId;
    }

    if (req.query.linkedWorkType) {
      const linkedWorkType = String(req.query.linkedWorkType).trim();
      if (linkedWorkType) filter.linkedWorkType = linkedWorkType;
    }

    if (req.query.q) {
      const q = String(req.query.q).trim();
      if (q) {
        filter.$or = [
          { title: { $regex: q, $options: 'i' } },
          { summary: { $regex: q, $options: 'i' } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      KnowledgeItem.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      KnowledgeItem.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list knowledge items' });
  }
};

const getKnowledgeItem = async (req, res) => {
  try {
    const item = await KnowledgeItem.findOne({
      _id: req.params.id,
      firmId: req.user.firmId,
    }).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: 'Knowledge item not found' });
    }
    return res.json({ success: true, data: item });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Knowledge item not found' });
    }
    return res.status(500).json({ success: false, message: 'Failed to get knowledge item' });
  }
};

const UPDATABLE_FIELDS = ['title', 'summary', 'content', 'status', 'tags', 'ownerXid',
  'linkedClientId', 'linkedDocketId', 'linkedWorkType', 'reviewDueAt', 'lastReviewedAt'];

const updateKnowledgeItem = async (req, res) => {
  try {
    const item = await KnowledgeItem.findOne({
      _id: req.params.id,
      firmId: req.user.firmId,
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Knowledge item not found' });
    }

    if (item.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Archived knowledge items cannot be updated. Restore to draft or active first.',
      });
    }

    const body = req.body || {};

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = String(body.title || '').trim();
      if (!title) return res.status(400).json({ success: false, message: 'title cannot be empty' });
      item.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'type')) {
      const type = String(body.type || '').trim().toLowerCase();
      if (!KNOWLEDGE_ITEM_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `type must be one of: ${KNOWLEDGE_ITEM_TYPES.join(', ')}`,
        });
      }
      item.type = type;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status || '').trim().toLowerCase();
      if (!KNOWLEDGE_ITEM_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${KNOWLEDGE_ITEM_STATUSES.join(', ')}`,
        });
      }
      item.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'summary')) {
      item.summary = body.summary ? String(body.summary).trim() || null : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'content')) {
      item.content = body.content ? String(body.content).trim() || null : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
      item.tags = normalizeTags(body.tags);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'ownerXid')) {
      item.ownerXid = body.ownerXid ? String(body.ownerXid).trim().toUpperCase() || null : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'linkedClientId')) {
      item.linkedClientId = body.linkedClientId || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'linkedDocketId')) {
      item.linkedDocketId = body.linkedDocketId ? String(body.linkedDocketId).trim() || null : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'linkedWorkType')) {
      item.linkedWorkType = body.linkedWorkType ? String(body.linkedWorkType).trim() || null : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'reviewDueAt')) {
      item.reviewDueAt = parseDateOrNull(body.reviewDueAt);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'lastReviewedAt')) {
      item.lastReviewedAt = parseDateOrNull(body.lastReviewedAt);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'checklistSteps')) {
      item.checklistSteps = normalizeChecklistSteps(body.checklistSteps);
    }

    item.updatedByXid = normalizeXid(req.user) || null;
    await item.save();

    return res.json({ success: true, data: item.toObject() });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Knowledge item not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to update knowledge item' });
  }
};

const archiveKnowledgeItem = async (req, res) => {
  try {
    const item = await KnowledgeItem.findOne({
      _id: req.params.id,
      firmId: req.user.firmId,
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Knowledge item not found' });
    }

    if (item.status === 'archived') {
      return res.json({ success: true, data: item.toObject() });
    }

    item.status = 'archived';
    item.updatedByXid = normalizeXid(req.user) || null;
    await item.save();

    return res.json({ success: true, data: item.toObject() });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Knowledge item not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to archive knowledge item' });
  }
};

module.exports = {
  createKnowledgeItem,
  listKnowledgeItems,
  getKnowledgeItem,
  updateKnowledgeItem,
  archiveKnowledgeItem,
};
