const mongoose = require('mongoose');
const Form = require('../models/Form.model');
const Lead = require('../models/Lead.model');
const User = require('../models/User.model');
const { createNotification, NotificationTypes } = require('../domain/notifications');

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'phone' },
];

const SPAM_NAME_PATTERN = /https?:\/\//i;

const notifyCmsLead = async (firmId, leadName) => {
  try {
    const recipients = await User.find({
      firmId,
      role: { $in: ['ADMIN', 'PRIMARY_ADMIN'] },
    }).select('xID').lean();

    await Promise.allSettled(recipients.map((recipient) => createNotification({
      firmId,
      userId: recipient.xID,
      type: NotificationTypes.CMS_LEAD_CREATED,
      actor: { xID: 'CMS', role: 'SYSTEM' },
      title: 'New CMS lead',
      message: `${leadName} submitted a CMS intake form.`,
      group: false,
    })));
  } catch (_error) {
    // Non-blocking UX signal.
  }
};

const createForm = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const rawFields = req.body?.fields;
    const fields = Array.isArray(rawFields) && rawFields.length > 0 ? rawFields : DEFAULT_FIELDS;

    const form = await Form.create({
      firmId: req.user.firmId,
      name,
      fields,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: form });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create form' });
  }
};

const listForms = async (req, res) => {
  try {
    const forms = await Form.find({ firmId: req.user.firmId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: forms });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list forms' });
  }
};

const getForm = async (req, res) => {
  try {
    const form = await Form.findOne({ _id: req.params.id, firmId: req.user.firmId }).lean();
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    return res.json({ success: true, data: form });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Form not found' });
    }
    return res.status(500).json({ success: false, message: 'Failed to get form' });
  }
};

const submitForm = async (req, res) => {
  try {
    const formId = req.params.id;
    const form = await Form.findById(formId).lean();

    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    if (!form.isActive) return res.status(403).json({ success: false, message: 'Form is not active' });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    if (SPAM_NAME_PATTERN.test(name)) {
      return res.status(400).json({ success: false, message: 'Invalid submission' });
    }

    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    const phone = req.body?.phone ? String(req.body.phone).trim() : null;

    const utm_source = req.query?.utm_source ? String(req.query.utm_source).trim().slice(0, 200) : null;
    const utm_campaign = req.query?.utm_campaign ? String(req.query.utm_campaign).trim().slice(0, 200) : null;
    const referrer = req.query?.referrer ? String(req.query.referrer).trim().slice(0, 500) : null;

    const lead = await Lead.create({
      firmId: form.firmId,
      name,
      email,
      phone,
      source: 'form',
      status: 'new',
      metadata: { utm_source, utm_campaign, referrer },
    });

    await notifyCmsLead(form.firmId, name);

    return res.status(201).json({ success: true, data: { id: lead._id } });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Form not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to submit form' });
  }
};

module.exports = {
  createForm,
  listForms,
  getForm,
  submitForm,
};
