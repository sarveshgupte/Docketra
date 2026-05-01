const mongoose = require('mongoose');
const { tenantScopeGuardPlugin } = require('./plugins/tenantScopeGuard.plugin');

/**
 * KnowledgeItem stores structured firm knowledge and operational context.
 *
 * KnowledgeItems are the first-class records for SOPs, checklists, templates,
 * notes, client instructions, and process records in the Company Brain.
 *
 * Privacy / BYOS policy:
 * - KnowledgeItem stores structured operational knowledge (text and metadata only).
 * - Heavy or sensitive client documents remain in BYOS/storage and should be
 *   linked by pointer in future PRs.
 * - Do not store raw uploaded files in KnowledgeItem.
 * - Do not add AI processing, vector embeddings, or document extraction to this model.
 */

const KNOWLEDGE_ITEM_TYPES = ['sop', 'checklist', 'template', 'note', 'client_instruction', 'process'];
const KNOWLEDGE_ITEM_STATUSES = ['draft', 'active', 'archived'];

const knowledgeItemSchema = new mongoose.Schema(
  {
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: [true, 'Firm is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [500, 'Title must not exceed 500 characters'],
    },
    type: {
      type: String,
      enum: KNOWLEDGE_ITEM_TYPES,
      required: [true, 'Type is required'],
    },
    summary: {
      type: String,
      trim: true,
      maxlength: [2000, 'Summary must not exceed 2000 characters'],
      default: null,
    },
    content: {
      type: String,
      trim: true,
      maxlength: [50000, 'Content must not exceed 50000 characters'],
      default: null,
    },
    status: {
      type: String,
      enum: KNOWLEDGE_ITEM_STATUSES,
      default: 'draft',
    },
    tags: {
      type: [String],
      default: [],
    },
    ownerXid: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
    linkedClientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
    linkedDocketId: {
      type: String,
      trim: true,
      default: null,
    },
    linkedWorkType: {
      type: String,
      trim: true,
      default: null,
    },
    reviewDueAt: {
      type: Date,
      default: null,
    },
    lastReviewedAt: {
      type: Date,
      default: null,
    },
    createdByXid: {
      type: String,
      required: [true, 'createdByXid is required'],
      uppercase: true,
      trim: true,
    },
    updatedByXid: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

knowledgeItemSchema.index({ firmId: 1, status: 1, updatedAt: -1 });
knowledgeItemSchema.index({ firmId: 1, type: 1, status: 1 });
knowledgeItemSchema.index({ firmId: 1, tags: 1 });
knowledgeItemSchema.index({ firmId: 1, title: 1 });

knowledgeItemSchema.plugin(tenantScopeGuardPlugin);

const KnowledgeItem = mongoose.model('KnowledgeItem', knowledgeItemSchema);
KnowledgeItem.KNOWLEDGE_ITEM_TYPES = KNOWLEDGE_ITEM_TYPES;
KnowledgeItem.KNOWLEDGE_ITEM_STATUSES = KNOWLEDGE_ITEM_STATUSES;

module.exports = KnowledgeItem;
