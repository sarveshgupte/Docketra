const NotificationPreference = require('../models/NotificationPreference.model');
const { NotificationTypes } = require('../constants/notificationTypes');

const DEFAULT_CHANNELS = Object.freeze({
  inApp: true,
  email: false,
});

const ALLOWED_TYPES = new Set(Object.values(NotificationTypes));

function normalizeChannels(channels, fallback = DEFAULT_CHANNELS) {
  return {
    inApp: channels?.inApp ?? fallback.inApp ?? true,
    email: channels?.email ?? fallback.email ?? false,
  };
}

function normalizeTypeChannels(typeChannels, fallbackDefaults = DEFAULT_CHANNELS) {
  if (!typeChannels || typeof typeChannels !== 'object') {
    return {};
  }
  const normalized = {};
  Object.entries(typeChannels).forEach(([rawType, rawChannels]) => {
    const type = String(rawType || '').trim().toUpperCase();
    if (!ALLOWED_TYPES.has(type)) return;
    normalized[type] = normalizeChannels(rawChannels, fallbackDefaults);
  });
  return normalized;
}

function serializePreference(preferenceDoc) {
  const doc = preferenceDoc?.toObject ? preferenceDoc.toObject() : preferenceDoc;
  const defaultChannels = normalizeChannels(doc?.defaultChannels, DEFAULT_CHANNELS);
  const rawTypeChannels = doc?.typeChannels instanceof Map
    ? Object.fromEntries(doc.typeChannels.entries())
    : (doc?.typeChannels || {});
  return {
    userId: String(doc?.userId || '').toUpperCase(),
    firmId: String(doc?.firmId || ''),
    defaultChannels,
    typeChannels: normalizeTypeChannels(rawTypeChannels, defaultChannels),
    updatedAt: doc?.updatedAt || new Date(),
  };
}

async function getOrCreateNotificationPreferences(userId, firmId) {
  const normalizedUserId = String(userId || '').toUpperCase().trim();
  const normalizedFirmId = String(firmId || '').trim();

  if (!normalizedUserId || !normalizedFirmId) {
    return {
      userId: normalizedUserId,
      firmId: normalizedFirmId,
      defaultChannels: { ...DEFAULT_CHANNELS },
      typeChannels: {},
      updatedAt: new Date(),
    };
  }

  if (NotificationPreference?.db?.readyState !== 1) {
    return {
      userId: normalizedUserId,
      firmId: normalizedFirmId,
      defaultChannels: { ...DEFAULT_CHANNELS },
      typeChannels: {},
      updatedAt: new Date(),
    };
  }

  let doc = await NotificationPreference.findOne({
    userId: normalizedUserId,
    firmId: normalizedFirmId,
  });

  if (!doc) {
    doc = await NotificationPreference.create({
      userId: normalizedUserId,
      firmId: normalizedFirmId,
      defaultChannels: { ...DEFAULT_CHANNELS },
      typeChannels: {},
    });
  }

  return serializePreference(doc);
}

async function updateNotificationPreferences(userId, firmId, patch = {}) {
  const current = await getOrCreateNotificationPreferences(userId, firmId);
  const nextDefaults = normalizeChannels({
    inApp: patch?.inAppEnabled ?? patch?.defaultChannels?.inApp ?? current.defaultChannels.inApp,
    email: patch?.emailEnabled ?? patch?.defaultChannels?.email ?? current.defaultChannels.email,
  }, current.defaultChannels);

  const patchedTypeChannels = normalizeTypeChannels(patch?.typeChannels, nextDefaults);
  const mergedTypeChannels = {
    ...current.typeChannels,
    ...patchedTypeChannels,
  };

  if (NotificationPreference?.db?.readyState !== 1) {
    return {
      ...current,
      defaultChannels: nextDefaults,
      typeChannels: mergedTypeChannels,
      updatedAt: new Date(),
    };
  }

  const updated = await NotificationPreference.findOneAndUpdate(
    {
      userId: current.userId,
      firmId: current.firmId,
    },
    {
      $set: {
        defaultChannels: nextDefaults,
        typeChannels: mergedTypeChannels,
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return serializePreference(updated);
}

async function resolveDeliveryChannels({ userId, firmId, type, fallbackEmailEnabled = false }) {
  const preferences = await getOrCreateNotificationPreferences(userId, firmId);
  const normalizedType = String(type || '').trim().toUpperCase();
  const typeChannels = preferences.typeChannels[normalizedType];
  const effective = normalizeChannels(typeChannels, preferences.defaultChannels);
  if (fallbackEmailEnabled) {
    effective.email = true;
  }
  return effective;
}

module.exports = {
  getOrCreateNotificationPreferences,
  updateNotificationPreferences,
  resolveDeliveryChannels,
  DEFAULT_CHANNELS,
};
