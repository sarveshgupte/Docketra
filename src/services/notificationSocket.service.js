const { Server } = require('socket.io');
const User = require('../models/User.model');
const jwtService = require('./jwt.service');
const { isActiveStatus } = require('../utils/status.utils');
const { getCookieValue } = require('../utils/requestCookies');

let ioInstance = null;
let revalidationTimer = null;
const socketMetaById = new Map();
const REVALIDATION_WINDOW_MS = 60 * 1000;
const REVALIDATION_TICK_MS = 7_500;

const randomJitterMs = () => Math.floor(Math.random() * 30_000);

function toRoomKey(firmId, userId) {
  return `notifications:${String(firmId || '')}:${String(userId || '').toUpperCase()}`;
}

function getHandshakeToken(socket) {
  const cookieHeader = socket?.handshake?.headers?.cookie;
  if (!cookieHeader) return null;
  return getCookieValue(cookieHeader, 'accessToken');
}

async function resolveSocketIdentity(socket) {
  const token = getHandshakeToken(socket);
  if (!token) return null;

  const decoded = jwtService.verifyAccessToken(token);
  if (!decoded?.userId || !decoded?.firmId) return null;

  const user = await User.findOne({
    _id: decoded.userId,
    firmId: decoded.firmId,
  })
    .select('xID firmId status')
    .lean();

  if (!user || !isActiveStatus(user.status)) {
    return null;
  }

  return {
    userId: String(user.xID || '').toUpperCase(),
    firmId: String(user.firmId || ''),
    userMongoId: String(user._id || ''),
  };
}

function initNotificationSocket(httpServer, { allowedOrigins = [] } = {}) {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
  });

  ioInstance.use(async (socket, next) => {
    try {
      const identity = await resolveSocketIdentity(socket);
      if (!identity?.firmId || !identity?.userId) {
        return next(new Error('Unauthorized'));
      }
      socket.data.notificationIdentity = identity;
      socket.join(toRoomKey(identity.firmId, identity.userId));
      return next();
    } catch (error) {
      return next(new Error(error?.message || 'Unauthorized'));
    }
  });

  ioInstance.on('connection', (socket) => {
    socketMetaById.set(socket.id, {
      nextRevalidateAt: Date.now() + REVALIDATION_WINDOW_MS + randomJitterMs(),
      revalidating: false,
    });
    startSocketRevalidationScheduler();
    socket.on('disconnect', () => {
      socketMetaById.delete(socket.id);
      stopSocketRevalidationSchedulerIfIdle();
    });
  });

  return ioInstance;
}

function disconnectUserSockets({ firmId, userMongoId = null, userXid = null } = {}) {
  if (!ioInstance || !firmId) return;
  for (const socket of ioInstance.sockets.sockets.values()) {
    const identity = socket?.data?.notificationIdentity || {};
    const sameFirm = String(identity.firmId || '') === String(firmId || '');
    const sameMongoId = userMongoId && String(identity.userMongoId || '') === String(userMongoId);
    const sameXid = userXid && String(identity.userId || '').toUpperCase() === String(userXid || '').toUpperCase();
    if (sameFirm && (sameMongoId || sameXid)) {
      socket.disconnect(true);
    }
  }
}

async function revalidateConnectedSockets() {
  if (!ioInstance) return;
  const now = Date.now();
  for (const socket of ioInstance.sockets.sockets.values()) {
    const meta = socketMetaById.get(socket.id);
    if (!meta || meta.revalidating || now < meta.nextRevalidateAt) continue;
    meta.revalidating = true;
    meta.nextRevalidateAt = now + REVALIDATION_WINDOW_MS + randomJitterMs();
    try {
      const identity = await resolveSocketIdentity(socket);
      if (!identity?.firmId || !identity?.userId) {
        socket.disconnect(true);
      }
    } catch (_error) {
      socket.disconnect(true);
    } finally {
      const latestMeta = socketMetaById.get(socket.id);
      if (latestMeta) latestMeta.revalidating = false;
    }
  }
}

function startSocketRevalidationScheduler() {
  if (revalidationTimer || !ioInstance) return;
  revalidationTimer = setInterval(() => {
    revalidateConnectedSockets().catch(() => {});
  }, REVALIDATION_TICK_MS);
  if (typeof revalidationTimer.unref === 'function') {
    revalidationTimer.unref();
  }
}

function stopSocketRevalidationSchedulerIfIdle() {
  const hasTrackedSockets = socketMetaById.size > 0;
  if (hasTrackedSockets || !revalidationTimer) return;
  clearInterval(revalidationTimer);
  revalidationTimer = null;
}

function resetSocketSchedulerForTests() {
  if (revalidationTimer) {
    clearInterval(revalidationTimer);
    revalidationTimer = null;
  }
  socketMetaById.clear();
}

function setIoInstanceForTests(instance) {
  ioInstance = instance;
}

function emitUserNotification({ firmId, userId, notification }) {
  if (!ioInstance) return;
  if (!firmId || !userId || !notification) return;
  ioInstance.to(toRoomKey(firmId, userId)).emit('notification:new', {
    _id: notification._id,
    id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    docketId: notification.docketId,
    docket_id: notification.docketId,
    isRead: Boolean(notification.isRead),
    read: Boolean(notification.isRead),
    groupCount: Number(notification.groupCount || 1),
    createdAt: notification.createdAt,
    created_at: notification.createdAt,
  });
}

module.exports = {
  initNotificationSocket,
  emitUserNotification,
  disconnectUserSockets,
  __private: {
    getHandshakeToken,
    revalidateConnectedSockets,
    startSocketRevalidationScheduler,
    stopSocketRevalidationSchedulerIfIdle,
    socketMetaById,
    resetSocketSchedulerForTests,
    setIoInstanceForTests,
  },
};
