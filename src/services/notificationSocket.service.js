const { Server } = require('socket.io');
const User = require('../models/User.model');
const jwtService = require('./jwt.service');
const { isActiveStatus } = require('../utils/status.utils');

let ioInstance = null;

function toRoomKey(firmId, userId) {
  return `notifications:${String(firmId || '')}:${String(userId || '').toUpperCase()}`;
}

function getHandshakeToken(socket) {
  const authHeader = socket?.handshake?.headers?.authorization;
  const bearerToken = jwtService.extractTokenFromHeader(authHeader);
  if (bearerToken) return bearerToken;
  const authToken = socket?.handshake?.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }
  return null;
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

  ioInstance.on('connection', () => {});

  return ioInstance;
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
};
