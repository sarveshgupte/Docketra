const bcrypt = require('bcrypt');
const UploadSession = require('../models/UploadSession.model');
const { generateToken, generatePin } = require('../utils/uploadToken');

async function buildUniqueToken() {
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const token = generateToken();
    const existing = await UploadSession.exists({ token });
    if (!existing) return token;
  }
  throw new Error('Failed to generate a unique upload token');
}

async function createUploadSession({ docketId, firmId, requirePin, expiryHours }) {
  const token = await buildUniqueToken();

  let pin = null;
  let pinHash = null;

  if (requirePin) {
    pin = generatePin();
    pinHash = await bcrypt.hash(pin, 10);
  }

  const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000));

  await UploadSession.updateMany(
    { docketId, firmId, isActive: true },
    { $set: { isActive: false } }
  );

  await UploadSession.create({
    docketId,
    firmId,
    token,
    pinHash,
    expiresAt,
    isActive: true,
  });

  return { token, pin, expiresAt };
}

async function validateUploadSession({ token, pin }) {
  const session = await UploadSession.findOne({
    token,
    isActive: true,
  });

  if (!session) {
    throw new Error('Invalid or inactive link');
  }

  if (new Date() > session.expiresAt) {
    await UploadSession.updateOne({ _id: session._id }, { $set: { isActive: false } });
    throw new Error('Link expired');
  }

  if (session.pinHash) {
    const isValid = await bcrypt.compare(pin || '', session.pinHash);
    if (!isValid) throw new Error('Invalid PIN');
  }

  return session;
}

async function rotateUploadSessionPin(session) {
  if (!session || !session._id || !session.pinHash) {
    throw new Error('PIN is not enabled for this upload link');
  }

  const pin = generatePin();
  const pinHash = await bcrypt.hash(pin, 10);

  await UploadSession.updateOne(
    { _id: session._id },
    { $set: { pinHash } }
  );

  return pin;
}

module.exports = {
  createUploadSession,
  validateUploadSession,
  rotateUploadSessionPin,
};
