const ComplianceObligationTemplate = require('../models/ComplianceObligationTemplate.model');
const complianceTemplateGenerationService = require('../services/complianceTemplateGeneration.service');
const { assertFirmContext } = require('../utils/tenantGuard');

const ROLE_RANK = {
  EMPLOYEE: 1,
  USER: 1,
  MANAGER: 2,
  ADMIN: 3,
  PRIMARY_ADMIN: 4,
};

const isAdminOrAbove = (role) => (ROLE_RANK[String(role || '').toUpperCase()] || 0) >= ROLE_RANK.ADMIN;

const ensureAdminAccess = (req, res) => {
  const role = String(req.user?.role || '').toUpperCase();
  if (!isAdminOrAbove(role)) {
    res.status(403).json({
      success: false,
      message: 'Compliance template workflows are available for admin and above roles only',
    });
    return false;
  }
  return true;
};

const listComplianceTemplates = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!ensureAdminAccess(req, res)) return;
    const templates = await complianceTemplateGenerationService.loadTemplates({
      firmId: req.user.firmId,
      includeInactive: String(req.query?.includeInactive || '').toLowerCase() === 'true',
    });
    return res.json({ success: true, data: templates });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load compliance templates' });
  }
};

const createComplianceTemplate = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!ensureAdminAccess(req, res)) return;
    const payload = { ...req.body };
    delete payload._id;
    delete payload.firmId;
    delete payload.createdByXID;
    delete payload.updatedByXID;

    payload.firmId = String(req.user.firmId);
    payload.createdByXID = req.user?.xID || req.user?.xid || null;
    payload.updatedByXID = req.user?.xID || req.user?.xid || null;

    const created = await ComplianceObligationTemplate.create(payload);
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Failed to create compliance template' });
  }
};

const updateComplianceTemplate = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!ensureAdminAccess(req, res)) return;

    const updatePayload = { ...req.body };
    delete updatePayload._id;
    delete updatePayload.firmId;
    delete updatePayload.createdByXID;
    delete updatePayload.updatedByXID;

    const updated = await ComplianceObligationTemplate.findOneAndUpdate(
      { _id: req.params.templateId, firmId: String(req.user.firmId) },
      {
        $set: {
          ...updatePayload,
          updatedByXID: req.user?.xID || req.user?.xid || null,
        },
      },
      { new: true },
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Compliance template not found' });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Failed to update compliance template' });
  }
};

const seedSampleComplianceTemplates = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!ensureAdminAccess(req, res)) return;
    const result = await complianceTemplateGenerationService.seedSampleTemplates({
      firmId: req.user.firmId,
      actorXID: req.user?.xID || req.user?.xid || null,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to seed sample compliance templates' });
  }
};

const previewComplianceGeneration = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!ensureAdminAccess(req, res)) return;
    const data = await complianceTemplateGenerationService.previewOrGenerate({
      firmId: req.user.firmId,
      actor: req.user,
      rangeStart: req.body?.rangeStart,
      rangeEnd: req.body?.rangeEnd,
      templateIds: req.body?.templateIds || [],
      clientIds: req.body?.clientIds || [],
      execute: false,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Failed to preview compliance generation' });
  }
};

const runComplianceGeneration = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!ensureAdminAccess(req, res)) return;
    const data = await complianceTemplateGenerationService.previewOrGenerate({
      firmId: req.user.firmId,
      actor: req.user,
      rangeStart: req.body?.rangeStart,
      rangeEnd: req.body?.rangeEnd,
      templateIds: req.body?.templateIds || [],
      clientIds: req.body?.clientIds || [],
      execute: true,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Failed to run compliance generation' });
  }
};

module.exports = {
  listComplianceTemplates,
  createComplianceTemplate,
  updateComplianceTemplate,
  seedSampleComplianceTemplates,
  previewComplianceGeneration,
  runComplianceGeneration,
};
