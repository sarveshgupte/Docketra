const { randomBytes } = require('crypto');
const Feedback = require('../models/Feedback.model');
const emailService = require('./email.service');
const log = require('../utils/log');

const ALLOWED_TYPES = new Set(['BUG', 'FEEDBACK', 'ERROR', 'OTHER']);
const ALLOWED_STATUSES = new Set(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']);

const generateFeedbackId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = randomBytes(3).toString('hex').toUpperCase();
  return `FB-${dateStr}-${randomSuffix}`;
};

const createFeedback = async ({
  user,
  firm = null,
  type = 'FEEDBACK',
  message,
  pageUrl = null,
  screenshot = null,
}) => {
  if (!user || !user.xID) {
    throw new Error('Authenticated user with xID is required');
  }

  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage) {
    throw new Error('Feedback message is required');
  }
  if (trimmedMessage.length < 5) {
    throw new Error('Feedback message must be at least 5 characters');
  }

  const normalizedType = String(type || 'FEEDBACK').trim().toUpperCase();
  const feedbackType = ALLOWED_TYPES.has(normalizedType) ? normalizedType : 'FEEDBACK';

  const userEmail = String(user.email || '').trim().toLowerCase();
  if (!userEmail) {
    throw new Error('User email is required to submit feedback');
  }

  // Validate screenshot string length (cap at 7MB for base64 data URLs)
  let cleanScreenshot = null;
  if (screenshot && typeof screenshot === 'string') {
    const trimmedScreenshot = screenshot.trim();
    if (trimmedScreenshot.length <= 7 * 1024 * 1024) {
      cleanScreenshot = trimmedScreenshot;
    }
  }

  const feedbackId = generateFeedbackId();
  const feedbackDoc = new Feedback({
    feedbackId,
    firmId: firm?._id || user.firmId || null,
    firmName: firm?.name || user.firm?.name || null,
    firmSlug: firm?.slug || user.firm?.slug || null,
    userId: user._id || null,
    userXID: String(user.xID).trim().toUpperCase(),
    userName: user.name || user.xID,
    userEmail,
    type: feedbackType,
    message: trimmedMessage,
    pageUrl: pageUrl ? String(pageUrl).trim() : null,
    screenshot: cleanScreenshot,
    status: 'OPEN',
  });

  await feedbackDoc.save();

  log.info('USER_FEEDBACK_SUBMITTED', {
    feedbackId,
    userXID: user.xID,
    type: feedbackType,
    hasScreenshot: Boolean(cleanScreenshot),
  });

  return {
    feedbackId: feedbackDoc.feedbackId,
    type: feedbackDoc.type,
    status: feedbackDoc.status,
    createdAt: feedbackDoc.createdAt,
  };
};

const listFeedback = async ({
  status = null,
  type = null,
  search = null,
  page = 1,
  limit = 25,
} = {}) => {
  const query = {};

  if (status && ALLOWED_STATUSES.has(String(status).trim().toUpperCase())) {
    query.status = String(status).trim().toUpperCase();
  }

  if (type && ALLOWED_TYPES.has(String(type).trim().toUpperCase())) {
    query.type = String(type).trim().toUpperCase();
  }

  if (search && String(search).trim()) {
    const term = String(search).trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { feedbackId: regex },
      { userName: regex },
      { userXID: regex },
      { userEmail: regex },
      { firmName: regex },
      { message: regex },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Feedback.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Feedback.countDocuments(query),
  ]);

  return {
    feedback: items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

const getFeedbackStats = async () => {
  const [total, open, resolved, bugs] = await Promise.all([
    Feedback.countDocuments({}),
    Feedback.countDocuments({ status: { $in: ['OPEN', 'IN_REVIEW'] } }),
    Feedback.countDocuments({ status: 'RESOLVED' }),
    Feedback.countDocuments({ type: 'BUG' }),
  ]);

  return {
    total,
    open,
    resolved,
    bugs,
  };
};

const replyToFeedback = async ({
  feedbackId,
  response,
  responder,
}) => {
  const trimmedResponse = String(response || '').trim();
  if (!trimmedResponse) {
    throw new Error('Response message is required');
  }

  const query = feedbackId && typeof feedbackId === 'string' && feedbackId.startsWith('FB-')
    ? { feedbackId }
    : { _id: feedbackId };

  const feedback = await Feedback.findOne(query);
  if (!feedback) {
    throw new Error('Feedback not found');
  }

  const responderXID = String(responder?.xID || 'SUPERADMIN').trim().toUpperCase();
  const responderEmail = responder?.email || 'support@docketra.in';

  feedback.response = trimmedResponse;
  feedback.status = 'RESOLVED';
  feedback.respondedAt = new Date();
  feedback.respondedBy = responderXID;
  feedback.respondedByEmail = responderEmail;
  await feedback.save();

  // Send reply email to submitting user
  const emailSubject = `[Docketra Support] Update on your ${feedback.type.toLowerCase()} report (#${feedback.feedbackId})`;
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px;">Response to your ${feedback.type.toLowerCase()} submission</h2>
        <span style="font-size: 13px; color: #64748b;">Reference ID: <strong>${feedback.feedbackId}</strong></span>
      </div>
      
      <p style="margin-bottom: 16px;">Hello ${feedback.userName || 'there'},</p>
      
      <p style="margin-bottom: 20px;">Our engineering and support team has reviewed your report and shared the following update:</p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; white-space: pre-wrap; font-size: 15px; color: #0f172a;">${trimmedResponse}</p>
      </div>
      
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Your Original Submission</h4>
        <p style="margin: 0; color: #475569; font-size: 14px; background: #ffffff; border: 1px solid #f1f5f9; padding: 12px; border-radius: 4px; white-space: pre-wrap;">${feedback.message}</p>
      </div>

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
        <p style="margin: 0 0 4px 0;">Docketra Compliance & Operations Platform</p>
        <p style="margin: 0;">Have additional questions? Simply reply to this email.</p>
      </div>
    </div>
  `;

  const emailText = `Hello ${feedback.userName || 'there'},\n\nOur engineering and support team has reviewed your ${feedback.type.toLowerCase()} report (#${feedback.feedbackId}) and shared the following update:\n\n${trimmedResponse}\n\n---\nYour Original Submission:\n${feedback.message}\n\nDocketra Support`;

  try {
    await emailService.sendEmail({
      to: feedback.userEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });
    log.info('FEEDBACK_REPLY_EMAIL_DISPATCHED', {
      feedbackId: feedback.feedbackId,
      recipient: feedback.userEmail,
    });
  } catch (emailErr) {
    log.error('FEEDBACK_REPLY_EMAIL_FAILED', {
      feedbackId: feedback.feedbackId,
      recipient: feedback.userEmail,
      error: emailErr.message,
    });
  }

  return {
    success: true,
    feedback,
  };
};

module.exports = {
  createFeedback,
  listFeedback,
  getFeedbackStats,
  replyToFeedback,
};
