const mongoose = require('mongoose');
const LandingPage = require('../models/LandingPage.model');
const Form = require('../models/Form.model');

const createLandingPage = async (req, res) => {
  try {
    const firmId = req.user.firmId;
    const title = String(req.body?.title || '').trim();
    const slug = String(req.body?.slug || '').trim().toLowerCase();
    const description = req.body?.description ? String(req.body.description).trim() : null;
    const formId = new mongoose.Types.ObjectId(String(req.body?.formId || ''));
    const headerText = req.body?.headerText ? String(req.body.headerText).trim() : null;
    const subText = req.body?.subText ? String(req.body.subText).trim() : null;

    const form = await Form.findOne({ _id: formId, firmId }).lean();
    if (!form) return res.status(400).json({ success: false, message: 'Form not found or does not belong to this firm' });

    const page = await LandingPage.create({
      firmId,
      title,
      slug,
      description,
      formId,
      headerText,
      subText,
    });

    return res.status(201).json({ success: true, data: page });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A landing page with this slug already exists for your firm' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to create landing page' });
  }
};

const listLandingPages = async (req, res) => {
  try {
    const pages = await LandingPage.find({ firmId: req.user.firmId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: pages });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list landing pages' });
  }
};

const getLandingPage = async (req, res) => {
  try {
    const page = await LandingPage.findOne({ _id: req.params.id, firmId: req.user.firmId }).lean();
    if (!page) return res.status(404).json({ success: false, message: 'Landing page not found' });
    return res.json({ success: true, data: page });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Landing page not found' });
    }
    return res.status(500).json({ success: false, message: 'Failed to get landing page' });
  }
};

const getPublicLandingPage = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();

    const page = await LandingPage.findOne({ slug, isActive: true }).lean();
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    const form = await Form.findOne({ _id: page.formId, firmId: page.firmId, isActive: true })
      .select('_id name fields')
      .lean();

    return res.json({
      success: true,
      data: {
        title: page.title,
        description: page.description,
        headerText: page.headerText,
        subText: page.subText,
        formId: page.formId,
        form: form ? { id: form._id, name: form.name, fields: form.fields } : null,
      },
    });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to load page' });
  }
};

module.exports = {
  createLandingPage,
  listLandingPages,
  getLandingPage,
  getPublicLandingPage,
};
