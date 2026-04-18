const Client = require('../models/Client.model');
const { generateNextClientId } = require('./clientIdGenerator');

async function findClientByEmailOrPhone({ firmId, email, phone }) {
  const normalizedEmail = typeof email === 'string' && email.trim()
    ? email.trim().toLowerCase()
    : null;
  const normalizedPhone = typeof phone === 'string' && phone.trim()
    ? phone.trim()
    : null;

  const orClauses = [
    normalizedEmail ? { businessEmail: normalizedEmail } : null,
    normalizedPhone ? { primaryContactNumber: normalizedPhone } : null,
  ].filter(Boolean);

  if (!firmId || orClauses.length === 0) return null;

  return Client.findOne({
    firmId,
    $or: orClauses,
  });
}

async function createClient({ firmId, name, email, phone, createdByXid = 'SYSTEM' }) {
  if (!firmId) throw new Error('firmId is required');

  const businessName = String(name || '').trim();
  const businessEmail = String(email || '').trim().toLowerCase();
  const primaryContactNumber = String(phone || '').trim();

  if (!businessName || (!businessEmail && !primaryContactNumber)) {
    throw new Error('Invalid client payload');
  }

  const clientId = await generateNextClientId(firmId);

  return Client.create({
    clientId,
    firmId,
    businessName,
    businessEmail: businessEmail || null,
    primaryContactNumber: primaryContactNumber || null,
    createdByXid: String(createdByXid || 'SYSTEM').toUpperCase(),
    createdBy: 'system@docketra.local',
  });
}

module.exports = {
  findClientByEmailOrPhone,
  createClient,
};
