const mongoose = require('mongoose');
const Lead = require('../models/Lead.model');
const CrmClient = require('../models/CrmClient.model');
const Case = require('../models/Case.model');
const User = require('../models/User.model');
const { upsertCanonicalClientFromCrm } = require('../services/crmClientMapping.service');

const ALLOWED_STATUSES = new Set(['new', 'contacted', 'qualified', 'lost', 'converted']);
const ACTIVE_PIPELINE_STAGES = new Set(['new', 'contacted', 'qualified']);

const parsePagination = (query = {}) => {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawSkip = Number.parseInt(query.skip, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;
  return { limit, skip };
};

const normalizeActorXid = (user = {}) => String(user?.xid || user?.xID || '').trim().toUpperCase() || null;
const normalizeStringOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const parseDateOrNull = (value) => {
  if (value === null) return null;
  if (value === undefined || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatOwner = (userDoc) => {
  if (!userDoc) return null;
  return {
    xid: userDoc.xid || null,
    xID: userDoc.xID || null,
    name: userDoc.name || null,
    email: userDoc.email || null,
    role: userDoc.role || null,
  };
};

const appendActivity = (lead, activity) => {
  const existing = Array.isArray(lead.activitySummary) ? lead.activitySummary : [];
  lead.activitySummary = [...existing, activity];
};

const hydrateLeadOwners = async (firmId, leads) => {
  const ownerXids = [...new Set(
    leads
      .map((lead) => lead.ownerXid)
      .filter((xid) => typeof xid === 'string' && xid.trim())
      .map((xid) => xid.trim().toUpperCase()),
  )];
  if (ownerXids.length === 0) return new Map();

  const owners = await User.find({
    firmId,
    $or: [{ xid: { $in: ownerXids } }, { xID: { $in: ownerXids } }],
  }).select('xid xID name email role').lean();

  const ownerMap = new Map();
  for (const owner of owners) {
    if (owner?.xid) ownerMap.set(String(owner.xid).toUpperCase(), formatOwner(owner));
    if (owner?.xID) ownerMap.set(String(owner.xID).toUpperCase(), formatOwner(owner));
  }
  return ownerMap;
};

const attachLeadPresentation = async (firmId, leads = []) => {
  const ownerMap = await hydrateLeadOwners(firmId, leads);
  const convertedClientIds = [...new Set(
    leads
      .map((lead) => lead.convertedClientId)
      .filter((clientId) => typeof clientId === 'string' && clientId.trim()),
  )];

  let clientIdsWithWork = new Set();
  if (convertedClientIds.length > 0) {
    const rows = await Case.aggregate([
      { $match: { firmId: String(firmId), clientId: { $in: convertedClientIds } } },
      { $group: { _id: '$clientId' } },
      { $project: { _id: 0, clientId: '$_id' } },
    ]);
    clientIdsWithWork = new Set(rows.map((row) => row.clientId));
  }

  return leads.map((lead) => {
    const ownerKey = String(lead.ownerXid || '').trim().toUpperCase();
    return {
      ...lead,
      stage: lead.stage || lead.status || 'new',
      status: lead.status || lead.stage || 'new',
      owner: ownerMap.get(ownerKey) || null,
      isConverted: (lead.stage || lead.status) === 'converted',
      hasDownstreamWork: Boolean(lead.convertedClientId && clientIdsWithWork.has(lead.convertedClientId)),
    };
  });
};

const createLead = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const payload = {
      firmId: req.user.firmId,
      name,
      email: req.body?.email || null,
      phone: req.body?.phone || null,
      source: req.body?.source || 'manual',
      status: 'new',
      stage: 'new',
      ownerXid: normalizeStringOrNull(req.body?.ownerXid) || null,
      nextFollowUpAt: parseDateOrNull(req.body?.nextFollowUpAt) || null,
      lastContactAt: parseDateOrNull(req.body?.lastContactAt) || null,
      notes: [],
      activitySummary: [],
    };

    if (payload.ownerXid) {
      const owner = await User.findOne({
        firmId: req.user.firmId,
        $or: [{ xid: payload.ownerXid }, { xID: payload.ownerXid }],
      }).select('_id').lean();
      if (!owner) return res.status(400).json({ success: false, message: 'ownerXid must reference a user in your firm' });
    }

    payload.activitySummary.push({
      type: 'created',
      message: 'Lead created',
      actorXid: normalizeActorXid(req.user),
      createdAt: new Date(),
    });

    const lead = await Lead.create(payload);
    const [presentedLead] = await attachLeadPresentation(req.user.firmId, [lead.toObject()]);
    return res.status(201).json({ success: true, data: presentedLead });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create lead' });
  }
};

const listLeads = async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const query = { firmId: req.user.firmId };
    const stage = normalizeStringOrNull(req.query?.stage || req.query?.status);
    const ownerXid = normalizeStringOrNull(req.query?.ownerXid);
    const dueOnly = String(req.query?.dueOnly || '').trim().toLowerCase() === 'true';
    if (stage && ALLOWED_STATUSES.has(stage)) query.$or = [{ stage }, { status: stage }];
    if (ownerXid) query.ownerXid = ownerXid.toUpperCase();
    if (dueOnly) {
      query.nextFollowUpAt = { $lt: new Date() };
      query.stage = { $in: [...ACTIVE_PIPELINE_STAGES] };
    }

    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const data = await attachLeadPresentation(req.user.firmId, leads);
    return res.json({ success: true, data });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list leads' });
  }
};

const updateLeadStatus = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, firmId: req.user.firmId });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const actorXid = normalizeActorXid(req.user);
    const requestedStage = normalizeStringOrNull(req.body?.stage || req.body?.status);
    if (requestedStage && !ALLOWED_STATUSES.has(requestedStage)) {
      return res.status(400).json({ success: false, message: 'Invalid stage/status' });
    }
    if (requestedStage && requestedStage !== (lead.stage || lead.status)) {
      const previous = lead.stage || lead.status || 'new';
      lead.stage = requestedStage;
      lead.status = requestedStage;
      appendActivity(lead, {
        type: requestedStage === 'lost' ? 'lost' : 'stage_changed',
        message: `Stage changed from ${previous} to ${requestedStage}`,
        actorXid,
        createdAt: new Date(),
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'ownerXid')) {
      const nextOwner = normalizeStringOrNull(req.body?.ownerXid);
      if (nextOwner) {
        const owner = await User.findOne({
          firmId: req.user.firmId,
          $or: [{ xid: nextOwner.toUpperCase() }, { xID: nextOwner.toUpperCase() }],
        }).select('xid xID').lean();
        if (!owner) return res.status(400).json({ success: false, message: 'ownerXid must reference a user in your firm' });
        const resolvedOwnerXid = String(owner.xid || owner.xID).toUpperCase();
        if ((lead.ownerXid || null) !== resolvedOwnerXid) {
          lead.ownerXid = resolvedOwnerXid;
          appendActivity(lead, {
            type: 'owner_changed',
            message: `Owner updated to ${resolvedOwnerXid}`,
            actorXid,
            createdAt: new Date(),
          });
        }
      } else if (lead.ownerXid) {
        lead.ownerXid = null;
        appendActivity(lead, {
          type: 'owner_changed',
          message: 'Owner unassigned',
          actorXid,
          createdAt: new Date(),
        });
      }
    }

    const nextFollowUpAt = parseDateOrNull(req.body?.nextFollowUpAt);
    if (nextFollowUpAt !== undefined) {
      lead.nextFollowUpAt = nextFollowUpAt;
      appendActivity(lead, {
        type: 'follow_up_updated',
        message: nextFollowUpAt ? 'Next follow-up date updated' : 'Next follow-up cleared',
        actorXid,
        createdAt: new Date(),
      });
    }

    const lastContactAt = parseDateOrNull(req.body?.lastContactAt);
    if (lastContactAt !== undefined) {
      lead.lastContactAt = lastContactAt;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'lostReason')) {
      lead.lostReason = normalizeStringOrNull(req.body?.lostReason);
    }

    const noteText = normalizeStringOrNull(req.body?.note);
    if (noteText) {
      const existingNotes = Array.isArray(lead.notes) ? lead.notes : [];
      lead.notes = [...existingNotes, { text: noteText, createdByXid: actorXid, createdAt: new Date() }];
      appendActivity(lead, {
        type: 'note_added',
        message: 'Note added',
        actorXid,
        createdAt: new Date(),
      });
    }

    await lead.save();
    const [presentedLead] = await attachLeadPresentation(req.user.firmId, [lead.toObject()]);
    return res.json({ success: true, data: presentedLead });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to update lead status' });
  }
};

const convertLead = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let response = null;
    await session.withTransaction(async () => {
      const lead = await Lead.findOne({ _id: req.params.id, firmId: req.user.firmId }).session(session);
      if (!lead) {
        response = { status: 404, payload: { success: false, message: 'Lead not found' } };
        return;
      }

      if (lead.linkedClientId) {
        const existingCrmClient = await CrmClient.findOne({
          _id: lead.linkedClientId,
          firmId: req.user.firmId,
        }).session(session);
        const existingClient = existingCrmClient
          ? await upsertCanonicalClientFromCrm({
            crmClient: existingCrmClient,
            firmId: req.user.firmId,
            createdByXid: req.user?.xid || req.user?.xID || 'SYSTEM',
            session,
          })
          : null;
        response = {
          status: 200,
          payload: {
            success: true,
            data: {
              lead,
              client: existingClient || null,
              legacyCrmClientId: existingCrmClient?._id || null,
              conversion: {
                convertedAt: lead.convertedAt || null,
                convertedClientId: lead.convertedClientId || existingClient?.clientId || null,
              },
            },
          },
        };
        return;
      }

      const crmClient = await CrmClient.create([{
        firmId: req.user.firmId,
        name: lead.name,
        type: 'individual',
        email: lead.email,
        phone: lead.phone,
        tags: [],
      }], { session });
      const client = await upsertCanonicalClientFromCrm({
        crmClient: crmClient[0],
        firmId: req.user.firmId,
        createdByXid: req.user?.xid || req.user?.xID || 'SYSTEM',
        session,
      });

      lead.status = 'converted';
      lead.stage = 'converted';
      lead.convertedAt = new Date();
      lead.linkedClientId = crmClient[0]._id;
      lead.convertedClientId = client?.clientId || null;
      appendActivity(lead, {
        type: 'converted',
        message: `Lead converted to client ${client?.clientId || 'unknown'}`,
        actorXid: normalizeActorXid(req.user),
        createdAt: new Date(),
      });
      await lead.save({ session });

      response = {
        status: 200,
        payload: {
          success: true,
          data: {
            lead,
            client,
            legacyCrmClientId: crmClient[0]._id,
            conversion: {
              convertedAt: lead.convertedAt,
              convertedClientId: lead.convertedClientId,
            },
          },
        },
      };
    });

    if (!response) {
      return res.status(500).json({ success: false, message: 'Failed to convert lead' });
    }
    return res.status(response.status).json(response.payload);
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to convert lead' });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createLead,
  listLeads,
  updateLeadStatus,
  convertLead,
};
