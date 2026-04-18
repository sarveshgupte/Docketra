const mongoose = require('mongoose');
const Form = require('../models/Form.model');
const { processCmsSubmission } = require('../services/cmsIntake.service');

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'phone' },
];

const SPAM_NAME_PATTERN = /https?:\/\//i;

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

    const result = await processCmsSubmission({
      firmId: form.firmId,
      payload: {
        ...req.body,
        source: 'form',
        formSlug: form.slug || String(form._id),
      },
      requestMeta: {
        query: req.query,
        headers: req.headers,
        ipAddress: req.socket?.remoteAddress || req.ip || null,
      },
      submissionMode: 'public_form',
      intakeConfig: {
        autoCreateClient: false,
        autoCreateDocket: false,
      },
    });

    return res.status(201).json({ success: true, data: { id: result.lead._id } });
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
