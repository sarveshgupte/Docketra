const mongoose = require('mongoose');


const ALLOW_EMAIL_BODY_PERSISTENCE = String(process.env.ALLOW_EMAIL_BODY_PERSISTENCE || '').toLowerCase() === 'true';

function stripThreadContent(doc) {
  if (ALLOW_EMAIL_BODY_PERSISTENCE) return;
  if (doc.bodyText) doc.bodyText = undefined;
  if (doc.bodyHtml) doc.bodyHtml = undefined;
  if (doc.headers && typeof doc.headers === 'object') {
    doc.headers = {
      messageId: doc.messageId || null,
    };
  }
}


const emailThreadSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    caseId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    fromEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    fromName: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
    },
    messageId: {
      type: String,
      trim: true,
      index: true,
    },
    bodyText: {
      type: String,
    },
    bodyHtml: {
      type: String,
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    strict: true,
    timestamps: false,
  }
);

emailThreadSchema.pre('validate', function(next) {
  stripThreadContent(this);
  next();
});

emailThreadSchema.index({ tenantId: 1, caseId: 1, createdAt: -1 });

module.exports = mongoose.model('EmailThread', emailThreadSchema);
