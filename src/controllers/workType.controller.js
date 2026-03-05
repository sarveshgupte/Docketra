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

  const { name, description, tatDays = 0 } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'name is required' });
  }

  const workType = await WorkType.create({
    firmId,
    name: String(name).trim(),
    description: description ? String(description).trim() : '',
    tatDays: Number(tatDays) || 0,
    createdByXID: req.user.xID,
  });

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
    { new: true }
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

