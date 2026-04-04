const WorkType = require('../models/WorkType.model');
const SubWorkType = require('../models/SubWorkType.model');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');

const assertAdminFirm = (req, res) => {
  if (!req.user?.firmId) {
    res.status(403).json({ success: false, message: 'Firm context is required' });
    return null;
  }
  return req.user.firmId;
};

const listWorkTypes = async (req, res) => {
  const firmId = assertAdminFirm(req, res);
  if (!firmId) return;

  const includeInactive = req.query.includeInactive === 'true';
  const filter = { firmId };
  if (!includeInactive) filter.isActive = true;

  const workTypes = await WorkType.find(filter).sort({ name: 1 }).lean();
  const workTypeIds = workTypes.map((w) => w._id);
  const subFilter = { firmId, parentWorkTypeId: { $in: workTypeIds } };
  if (!includeInactive) subFilter.isActive = true;

  const subTypes = await SubWorkType.find(subFilter).sort({ name: 1 }).lean();
  const grouped = new Map();
  for (const sub of subTypes) {
    const key = String(sub.parentWorkTypeId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(sub);
  }

  return res.json({
    success: true,
    data: workTypes.map((w) => ({
      ...w,
      subWorkTypes: grouped.get(String(w._id)) || [],
    })),
  });
};

const createWorkType = async (req, res) => {
  const firmId = assertAdminFirm(req, res);
  if (!firmId) return;

  const { name, description, tatDays = 0, prefix } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'name is required' });
  }

  // Validate and normalise prefix if provided
  const hasPrefix = prefix !== undefined && prefix !== null && prefix !== '';
  let normalizedPrefix;
  if (hasPrefix) {
    normalizedPrefix = String(prefix).trim().toUpperCase();
    if (!/^[A-Z]{2,4}$/.test(normalizedPrefix)) {
      return res.status(400).json({
        success: false,
        message: 'prefix must be 2-4 uppercase letters (e.g. "CO", "TAX")',
      });
    }
    // Check uniqueness within firm
    const existing = await WorkType.findOne({ firmId, prefix: normalizedPrefix });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Prefix "${normalizedPrefix}" is already used by another work type in this firm`,
      });
    }
  }

  const createData = {
    firmId,
    name: String(name).trim(),
    description: description ? String(description).trim() : '',
    tatDays: Number(tatDays) || 0,
    createdByXID: req.user.xID,
  };

  if (hasPrefix) {
    createData.prefix = normalizedPrefix;
  }

  let workType;
  try {
    workType = await WorkType.create(createData);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Prefix already exists in this firm',
      });
    }
    throw err;
  }

  return res.status(201).json({ success: true, data: workType });
};

const createSubWorkType = async (req, res) => {
  const firmId = assertAdminFirm(req, res);
  if (!firmId) return;

  const { parentWorkTypeId, name, tatDays = 0 } = req.body;
  if (!parentWorkTypeId || !name) {
    return res.status(400).json({ success: false, message: 'parentWorkTypeId and name are required' });
  }

  const parent = await WorkType.findOne({ _id: parentWorkTypeId, firmId });
  if (!parent) {
    return res.status(404).json({ success: false, message: 'Parent work type not found' });
  }

  const subWorkType = await SubWorkType.create({
    firmId,
    parentWorkTypeId,
    name: String(name).trim(),
    tatDays: Number(tatDays) || 0,
    createdByXID: req.user.xID,
  });

  return res.status(201).json({ success: true, data: subWorkType });
};

const updateWorkTypeStatus = async (req, res) => {
  const firmId = assertAdminFirm(req, res);
  if (!firmId) return;
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive boolean is required' });
  }
  const workType = await WorkType.findOneAndUpdate(
    { _id: req.params.workTypeId, firmId },
    { $set: { isActive } },
    { returnDocument: 'after' }
  );
  if (!workType) return res.status(404).json({ success: false, message: 'Work type not found' });

  return res.json({ success: true, data: workType });
};

module.exports = {
  listWorkTypes,
  createWorkType: wrapWriteHandler(createWorkType),
  createSubWorkType: wrapWriteHandler(createSubWorkType),
  updateWorkTypeStatus: wrapWriteHandler(updateWorkTypeStatus),
};

