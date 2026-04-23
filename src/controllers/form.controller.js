const mongoose = require('mongoose');
const Form = require('../models/Form.model');
const { processCmsSubmission } = require('../services/cmsIntake.service');

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'phone' },
];

const SPAM_NAME_PATTERN = /https?:\/\//i;
const EMBEDDED_SUBMISSION_MODE = 'embedded_form';
const EMBEDDED_SOURCE = 'website_embed';
const REQUIRED_PUBLIC_FIELD_KEY = 'name';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+()\-\s0-9]{7,20}$/;

function normalizeFieldKey(value) {
  return String(value || '').trim().toLowerCase();
}

function hasRequiredPublicField(fields = []) {
  return fields.some((field) => normalizeFieldKey(field?.key) === REQUIRED_PUBLIC_FIELD_KEY);
}

function ensurePublicFormFieldRequirements(fields = []) {
  if (!hasRequiredPublicField(fields)) {
    throw new Error('Form must include a name field for public/embed submissions');
  }
}

function normalizeFieldType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'email' || type === 'phone' || type === 'text') return type;
  return 'text';
}

function normalizeFormFields(rawFields) {
  const source = Array.isArray(rawFields) && rawFields.length > 0 ? rawFields : DEFAULT_FIELDS;
  return source.map((field, index) => {
    const key = String(field?.key || '').trim() || `field_${index + 1}`;
    return {
      key,
      label: String(field?.label || key).trim() || key,
      type: normalizeFieldType(field?.type),
      required: Boolean(field?.required) || normalizeFieldKey(key) === REQUIRED_PUBLIC_FIELD_KEY,
    };
  });
}



function validateUniqueFieldKeys(fields = []) {
  const seen = new Set();
  for (const field of fields) {
    const key = normalizeFieldKey(field?.key);
    if (!key) {
      throw new Error('Field key is required');
    }
    if (seen.has(key)) {
      throw new Error(`Form field key "${key}" is duplicated`);
    }
    seen.add(key);
  }
}

function normalizeAllowedDomains(domains = []) {
  return domains
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

function normalizeFormSettings(payload = {}) {
  const rawDomains = Array.isArray(payload.allowedEmbedDomains) ? payload.allowedEmbedDomains : [];
  return {
    allowEmbed: payload.allowEmbed === undefined ? true : Boolean(payload.allowEmbed),
    embedTitle: String(payload.embedTitle || '').trim(),
    successMessage: String(payload.successMessage || '').trim() || 'Thanks — your intake was submitted successfully.',
    redirectUrl: String(payload.redirectUrl || '').trim(),
    themeMode: payload.themeMode === 'dark' ? 'dark' : 'light',
    allowedEmbedDomains: normalizeAllowedDomains(rawDomains),
  };
}

function getSubmissionOriginCandidates(req) {
  return [
    req.headers?.origin,
    req.headers?.referer,
    req.headers?.referrer,
    req.body?.pageUrl,
    req.body?.referrer,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function parseHostname(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch (_error) {
    return null;
  }
}

function isAllowedOrigin(form, req) {
  const allowlist = normalizeAllowedDomains(form.allowedEmbedDomains || []);
  if (allowlist.length === 0) return true;

  const candidates = getSubmissionOriginCandidates(req);
  if (candidates.length === 0) return true;

  return candidates.some((candidate) => {
    const hostname = parseHostname(candidate);
    if (!hostname) return false;
    return allowlist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  });
}

function buildPublicFieldValidation(form, body = {}) {
  const fieldErrors = {};
  const normalizedBody = body && typeof body === 'object' ? body : {};
  const fields = Array.isArray(form?.fields) ? form.fields : [];

  fields.forEach((field) => {
    const key = String(field?.key || '').trim();
    if (!key) return;
    const label = String(field?.label || key).trim() || key;
    const value = String(normalizedBody[key] || '').trim();
    const required = Boolean(field?.required) || normalizeFieldKey(key) === REQUIRED_PUBLIC_FIELD_KEY;

    if (required && !value) {
      fieldErrors[key] = `${label} is required.`;
      return;
    }
    if (!value) return;

    const fieldType = normalizeFieldType(field?.type);
    if (fieldType === 'email' && !EMAIL_REGEX.test(value)) {
      fieldErrors[key] = 'Please enter a valid email address.';
    }
    if (fieldType === 'phone' && !PHONE_REGEX.test(value)) {
      fieldErrors[key] = 'Please enter a valid phone number.';
    }
  });

  return fieldErrors;
}

const createForm = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const fields = normalizeFormFields(req.body?.fields);
    validateUniqueFieldKeys(fields);
    ensurePublicFormFieldRequirements(fields);

    const form = await Form.create({
      firmId: req.user.firmId,
      name,
      fields,
      ...normalizeFormSettings(req.body),
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

const updateForm = async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      const nextName = String(req.body.name || '').trim();
      if (!nextName) return res.status(400).json({ success: false, message: 'name is required' });
      updates.name = nextName;
    }
    if (Array.isArray(req.body.fields)) {
      updates.fields = normalizeFormFields(req.body.fields);
      validateUniqueFieldKeys(updates.fields);
      ensurePublicFormFieldRequirements(updates.fields);
    }

    const settings = normalizeFormSettings(req.body);
    ['allowEmbed', 'embedTitle', 'successMessage', 'redirectUrl', 'themeMode', 'allowedEmbedDomains']
      .forEach((key) => {
        if (req.body[key] !== undefined) {
          updates[key] = settings[key];
        }
      });
    if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

    const form = await Form.findOneAndUpdate(
      { _id: req.params.id, firmId: req.user.firmId },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    return res.json({ success: true, data: form });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Form not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to update form' });
  }
};

const getPublicForm = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id).lean();
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    if (!form.isActive) return res.status(403).json({ success: false, message: 'Form is not active' });

    const embedMode = req.query.embed === 'true';
    if (embedMode && !form.allowEmbed) {
      return res.status(403).json({ success: false, message: 'Embed is not enabled for this form' });
    }
    if (!hasRequiredPublicField(form.fields || [])) {
      return res.status(409).json({ success: false, message: 'Form is misconfigured: name field is required for public/embed use' });
    }

    return res.json({
      success: true,
      data: {
        _id: form._id,
        name: form.name,
        fields: form.fields,
        embedMode,
        embedTitle: form.embedTitle || form.name,
        successMessage: form.successMessage || 'Thanks — your intake was submitted successfully.',
        redirectUrl: form.redirectUrl || null,
        themeMode: form.themeMode || 'light',
        allowEmbed: Boolean(form.allowEmbed),
      },
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Form not found' });
    }
    return res.status(500).json({ success: false, message: 'Failed to load form' });
  }
};

const submitForm = async (req, res) => {
  try {
    const formId = req.params.id;
    const form = await Form.findById(formId).lean();

    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    if (!form.isActive) return res.status(403).json({ success: false, message: 'Form is not active' });
    const embedMode = req.query.embed === 'true' || req.body?.submissionMode === EMBEDDED_SUBMISSION_MODE;
    if (embedMode && !form.allowEmbed) {
      return res.status(403).json({ success: false, message: 'Embed is not enabled for this form' });
    }
    if (embedMode && !isAllowedOrigin(form, req)) {
      return res.status(403).json({ success: false, message: 'Submission origin is not allowed' });
    }
    if (!hasRequiredPublicField(form.fields || [])) {
      return res.status(409).json({ success: false, message: 'Form is misconfigured: name field is required for public/embed use' });
    }
    if (String(req.body?.website || '').trim()) {
      return res.status(400).json({ success: false, message: 'Invalid submission' });
    }

    const fieldErrors = buildPublicFieldValidation(form, req.body);
    const name = String(req.body?.name || '').trim();
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please review the highlighted fields and try again.',
        fieldErrors,
      });
    }

    if (SPAM_NAME_PATTERN.test(name)) {
      return res.status(400).json({ success: false, message: 'Invalid submission' });
    }

    const result = await processCmsSubmission({
      firmId: form.firmId,
      payload: {
        ...req.body,
        source: embedMode ? EMBEDDED_SOURCE : 'form',
        formSlug: form.slug || String(form._id),
        formId: String(form._id),
        idempotencyKey: String(req.body?.idempotencyKey || req.headers?.['idempotency-key'] || '').trim() || undefined,
      },
      requestMeta: {
        query: req.query,
        headers: req.headers,
        ipAddress: req.socket?.remoteAddress || req.ip || null,
      },
      submissionMode: embedMode ? EMBEDDED_SUBMISSION_MODE : 'public_form',
    });

    return res.status(201).json({
      success: true,
      data: {
        id: result.lead._id,
        successMessage: form.successMessage || 'Thanks — your intake was submitted successfully.',
        redirectUrl: form.redirectUrl || null,
        submissionMode: embedMode ? EMBEDDED_SUBMISSION_MODE : 'public_form',
        outcome: result?.metadata?.intakeOutcome || null,
      },
    });
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
  updateForm,
  getPublicForm,
  submitForm,
};
