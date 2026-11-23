const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const { normalizeFirmSettings } = require('./adminController.service');

const BUSINESS_DAY_MINUTES = 8 * 60;

function toFirmSlaCalendarConfig(settings = {}) {
  const firmSettings = normalizeFirmSettings(settings);
  return {
    tatDurationMinutes: Math.max(1, Number(firmSettings.slaDefaultDays || 1)) * BUSINESS_DAY_MINUTES,
    businessStartTime: '10:00',
    businessEndTime: '18:00',
    workingDays: firmSettings.slaWorkingDays,
    holidayDates: firmSettings.slaHolidayDates,
    workingDateOverrides: firmSettings.slaWorkingDateOverrides,
    timezone: 'Asia/Kolkata',
  };
}

async function getFirmSlaCalendarConfig(firmId, options = {}) {
  if (!firmId) return toFirmSlaCalendarConfig();
  if (mongoose.connection && mongoose.connection.readyState !== 1) {
    return toFirmSlaCalendarConfig();
  }
  let firm = null;
  try {
    const query = Firm.findById(firmId).select('settings.firm').lean();
    if (options.session) query.session(options.session);
    firm = await query;
  } catch (_err) {
    firm = null;
  }
  if (!firm) {
    try {
      const query = Firm.findOne({ firmId: String(firmId) }).select('settings.firm').lean();
      if (options.session) query.session(options.session);
      firm = await query;
    } catch (_err) {
      firm = null;
    }
  }
  return toFirmSlaCalendarConfig(firm?.settings?.firm || {});
}

module.exports = {
  BUSINESS_DAY_MINUTES,
  getFirmSlaCalendarConfig,
  toFirmSlaCalendarConfig,
};
