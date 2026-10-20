'use strict';

const mongoose = require('mongoose');
const AdminAuditLog = require('../models/AdminAuditLog.model');
const SettingsAuditLog = require('../models/SettingsAuditLog.model');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const emailService = require('./email.service');
const log = require('../utils/log');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // Check every 6 hours

/**
 * Format timestamp in readable Indian Standard Time (IST)
 */
function formatIst(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' IST';
}

/**
 * Sanitize cell to prevent CSV injection
 */
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  // Neutralize spreadsheet formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Collect audit entries from AdminAuditLog and SettingsAuditLog for a firm
 */
async function collectFirmWeeklyAuditLogs(firmId, { startDate, endDate } = {}) {
  const resolvedFirmId = mongoose.Types.ObjectId.isValid(String(firmId))
    ? new mongoose.Types.ObjectId(String(firmId))
    : firmId;

  const now = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getTime() - SEVEN_DAYS_MS);

  const queryTimeFilter = { $gte: start, $lte: now };

  // 1. Query AdminAuditLog
  const adminLogs = await AdminAuditLog.find({
    firmId: resolvedFirmId,
    createdAt: queryTimeFilter,
  })
    .populate('actorId', 'name email xID role')
    .sort({ createdAt: -1 })
    .lean()
    .catch(() => []);

  // 2. Query SettingsAuditLog
  const settingsLogs = await SettingsAuditLog.find({
    firmId: String(firmId),
    timestamp: queryTimeFilter,
  })
    .sort({ timestamp: -1 })
    .lean()
    .catch(() => []);

  const items = [];

  for (const entry of adminLogs) {
    const actorLabel = entry.actorId?.name
      ? `${entry.actorId.name} (${entry.actorId.xID || entry.actorId.email || 'Admin'})`
      : (entry.actorId?.xID || 'Partner/Admin');

    const meta = entry.metadata || {};
    const action = entry.action || 'ACTION';

    let category = 'Firm Administration';
    if (action.includes('USER') || action.includes('HIERARCHY') || action.includes('ROLE')) category = 'User Management';
    if (action.includes('TRAINEE_SHIELD')) category = 'Security Controls';
    if (action.includes('CLIENT')) category = 'Client Management';
    if (action.includes('SETTINGS') || action.includes('CONFIG') || action.includes('STORAGE')) category = 'Firm Settings';

    let target = meta.userName || meta.businessName || meta.xID || meta.clientId || 'Firm';
    let details = meta.description || '';

    if (action === 'TRAINEE_SHIELD_UPDATED') {
      const statusText = meta.next === true ? 'Enabled (Raw downloads blocked)' : (meta.next === false ? 'Disabled (Downloads allowed)' : 'Inherit Firm Default');
      details = `Trainee Laptop Shield updated to ${statusText} for staff ${meta.xID || target}`;
    } else if (action === 'CLIENT_CREATED') {
      details = `Client registered: ${meta.businessName || meta.clientId}`;
    } else if (action === 'CLIENT_ACTIVATED' || action === 'CLIENT_DEACTIVATED') {
      details = `Client ${action === 'CLIENT_ACTIVATED' ? 'activated' : 'deactivated'}: ${meta.businessName || meta.clientId}`;
    } else if (action === 'USER_CREATED' || action === 'USER_INVITED') {
      details = `New team member onboarded (${meta.xID || target})`;
    } else if (action === 'USER_ACTIVATED' || action === 'USER_DEACTIVATED') {
      details = `User account ${action === 'USER_ACTIVATED' ? 'activated' : 'deactivated'} (${meta.xID || target})`;
    } else if (action === 'FIRM_SETTINGS_UPDATED') {
      details = 'Firm practice settings updated';
    }

    items.push({
      timestamp: entry.createdAt,
      formattedTime: formatIst(entry.createdAt),
      category,
      action: action.replace(/_/g, ' '),
      actor: actorLabel,
      target,
      details: details || JSON.stringify(meta),
    });
  }

  for (const entry of settingsLogs) {
    const changesSummary = Array.isArray(entry.changes) && entry.changes.length > 0
      ? entry.changes.map((c) => `${c.field}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`).join('; ')
      : (entry.settingsKey || 'Settings change');

    items.push({
      timestamp: entry.timestamp,
      formattedTime: formatIst(entry.timestamp),
      category: 'Firm Settings',
      action: (entry.action || 'CONFIG_CHANGED').replace(/_/g, ' '),
      actor: String(entry.performedBy || 'Admin'),
      target: entry.settingsKey || entry.entityType || 'Firm Configuration',
      details: changesSummary,
    });
  }

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items;
}

/**
 * Generate CSV string from structured audit items
 */
function generateAuditCsv(items = []) {
  const headers = ['Timestamp', 'Category', 'Action', 'Performed By', 'Target', 'Details'];
  const rows = [headers.map(escapeCsv).join(',')];

  for (const item of items) {
    const row = [
      escapeCsv(item.formattedTime || formatIst(item.timestamp)),
      escapeCsv(item.category),
      escapeCsv(item.action),
      escapeCsv(item.actor),
      escapeCsv(item.target),
      escapeCsv(item.details),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Find Primary Admin for a given firm
 */
async function findFirmPrimaryAdmin(firmId) {
  const firm = await Firm.findById(firmId).lean();
  if (!firm) return null;

  let primaryAdmin = null;

  if (firm.primaryAdminId) {
    primaryAdmin = await User.findById(firm.primaryAdminId).lean();
  }

  if (!primaryAdmin) {
    primaryAdmin = await User.findOne({
      firmId: firm._id,
      $or: [{ role: 'PRIMARY_ADMIN' }, { isPrimaryAdmin: true }],
      status: { $ne: 'deleted' },
    }).lean();
  }

  return { firm, primaryAdmin };
}

/**
 * Send weekly audit digest email to Primary Admin with CSV attachment
 */
async function sendWeeklyAuditDigestEmail(firmId, { startDate, endDate, force = false } = {}) {
  const context = await findFirmPrimaryAdmin(firmId);
  if (!context || !context.firm) {
    log.warn('[WEEKLY_AUDIT] Firm not found for audit digest', { firmId });
    return { success: false, reason: 'firm_not_found' };
  }

  const { firm, primaryAdmin } = context;

  if (!force && firm.settings?.firm?.weeklyAuditDigestEnabled === false) {
    log.info('[WEEKLY_AUDIT] Weekly audit digest disabled for firm', { firmId: firm._id });
    return { success: false, reason: 'disabled' };
  }

  const recipientEmail = primaryAdmin?.primary_email || primaryAdmin?.email;
  if (!recipientEmail) {
    log.warn('[WEEKLY_AUDIT] No Primary Admin email found for firm', { firmId: firm._id });
    return { success: false, reason: 'missing_primary_admin_email' };
  }

  const now = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getTime() - SEVEN_DAYS_MS);

  const items = await collectFirmWeeklyAuditLogs(firm._id, { startDate: start, endDate: now });
  const csvContent = generateAuditCsv(items);
  const base64Csv = Buffer.from(csvContent, 'utf-8').toString('base64');

  const startFormatted = start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const endFormatted = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const fileName = `docketra-audit-log-${now.toISOString().slice(0, 10)}.csv`;

  const partnerName = primaryAdmin.name || 'Managing Partner';
  const firmName = firm.name || 'Your Practice';

  const subject = `[Docketra] Weekly Practice Audit Summary: ${firmName} (${startFormatted} - ${endFormatted})`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; line-height: 1.6; color: #1e293b;">
      <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0;">Weekly Practice Audit Summary</h2>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">${firmName} • Period: ${startFormatted} to ${endFormatted}</p>
      </div>

      <p>Dear ${partnerName},</p>

      <p>
        In accordance with sovereign compliance and firm peer-review standards, here is your practice's weekly audit digest.
        All firm settings modifications, client status changes, and staff access adjustments recorded during the past 7 days have been compiled into the attached CSV file.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h3 style="margin-top: 0; font-size: 15px; color: #334155;">Summary of Activity:</h3>
        <ul style="margin-bottom: 0; padding-left: 20px; color: #475569;">
          <li><strong>Total Audit Events:</strong> ${items.length}</li>
          <li><strong>Report File:</strong> ${fileName} (Attached)</li>
          <li><strong>Sovereign Isolation:</strong> Active (Strict BYOS boundary preserved)</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #64748b;">
        Please retain this CSV log for your firm's compliance documentation and quality review records.
        You can also export real-time audit logs anytime directly from your Firm Settings dashboard.
      </p>

      <p style="margin-top: 24px; color: #64748b; font-size: 13px;">
        Warm regards,<br/>
        <strong>Docketra Compliance Operations</strong>
      </p>
    </div>
  `;

  const text = `Weekly Practice Audit Summary: ${firmName}\nPeriod: ${startFormatted} to ${endFormatted}\n\nDear ${partnerName},\n\nAttached is your firm's weekly audit log summary in CSV format (${fileName}), recording all configuration, client, and team access modifications for the past 7 days.\n\nTotal events recorded: ${items.length}\n\nWarm regards,\nDocketra Compliance Operations`;

  const attachments = [
    {
      name: fileName,
      content: base64Csv,
    },
  ];

  await emailService.sendDirectAuthEmail({
    to: recipientEmail,
    subject,
    html,
    text,
    attachments,
  });

  await Firm.findByIdAndUpdate(firm._id, {
    lastWeeklyAuditDigestSentAt: now,
  });

  log.info('[WEEKLY_AUDIT] Sent weekly audit digest email', {
    firmId: firm._id,
    recipient: recipientEmail,
    eventsCount: items.length,
  });

  return {
    success: true,
    recipient: recipientEmail,
    eventsCount: items.length,
    fileName,
  };
}

/**
 * Send weekly audit digest to all eligible firms
 */
async function sendAllFirmsWeeklyAuditDigests() {
  if (mongoose.connection.readyState === 0) return { processed: 0, sent: 0 };

  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  // Find firms where weekly digest is enabled and hasn't been sent in past 7 days
  const eligibleFirms = await Firm.find({
    status: { $ne: 'deleted' },
    'settings.firm.weeklyAuditDigestEnabled': { $ne: false },
    $or: [
      { lastWeeklyAuditDigestSentAt: null },
      { lastWeeklyAuditDigestSentAt: { $lt: sevenDaysAgo } },
    ],
  }).select('_id name settings.firm lastWeeklyAuditDigestSentAt').lean();

  let sent = 0;
  for (const firm of eligibleFirms) {
    try {
      const res = await sendWeeklyAuditDigestEmail(firm._id);
      if (res?.success) sent += 1;
    } catch (err) {
      log.error('[WEEKLY_AUDIT] Failed to send digest for firm', {
        firmId: firm._id,
        error: err.message,
      });
    }
  }

  return { processed: eligibleFirms.length, sent };
}

let schedulerTimer = null;

function scheduleWeeklyAuditDigest() {
  if (schedulerTimer) return;

  schedulerTimer = setInterval(async () => {
    try {
      await sendAllFirmsWeeklyAuditDigests();
    } catch (err) {
      log.error('[WEEKLY_AUDIT] Periodic scheduler run failed', { error: err.message });
    }
  }, CHECK_INTERVAL_MS);

  schedulerTimer.unref?.();
  log.info('[WEEKLY_AUDIT] Weekly audit digest background scheduler registered');
}

module.exports = {
  collectFirmWeeklyAuditLogs,
  generateAuditCsv,
  sendWeeklyAuditDigestEmail,
  sendAllFirmsWeeklyAuditDigests,
  scheduleWeeklyAuditDigest,
  formatIst,
};
