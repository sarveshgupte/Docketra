#!/usr/bin/env node
const assert = require('assert');
const bcrypt = require('bcrypt');

const controllerModulePath = require.resolve('../src/controllers/auth.controller');
const emailServiceModulePath = require.resolve('../src/services/email.service');
const emailQueueModulePath = require.resolve('../src/queues/email.queue');
const emailWorkerModulePath = require.resolve('../src/workers/email.worker');
const bullmqModulePath = require.resolve('bullmq');

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const AuditLog = require('../src/models/AuditLog.model');
const emailService = require('../src/services/email.service');
const log = require('../src/utils/log');

const createMockRes = () => {
  const body = {};
  const res = {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.headersSent = true;
      Object.assign(body, payload);
      return this;
    },
  };

  return { res, body };
};

const restoreModuleCache = (modulePath, original) => {
  delete require.cache[modulePath];
  if (original) {
    require.cache[modulePath] = original;
  }
};

async function shouldLogOtpEmailQueuedFromAuthController() {
  const { login } = require('../src/controllers/auth.controller');
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.JWT_SECRET = 'otp-queued-test-secret';
  process.env.NODE_ENV = 'development';

  const originalUserFindOne = User.findOne;
  const originalFirmCountDocuments = Firm.countDocuments;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalSendLoginOtpEmail = emailService.sendLoginOtpEmail;
  const originalLogInfo = log.info;
  const originalBcryptCompare = bcrypt.compare;

  const loggedEvents = [];
  const user = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'X000001',
    name: 'Tenant User',
    email: 'tenant@example.com',
    role: 'Admin',
    firmId: { toString: () => '507f1f77bcf86cd799439022' },
    defaultClientId: { toString: () => '507f1f77bcf86cd799439033' },
    status: 'active',
    isActive: true,
    passwordHash: '$2b$04$4wb1ANlC7.6nkwbRL6vG8uvHnYQd04m6H5hL7sRKqzZo4PMBVXsfS',
    mustSetPassword: false,
    failedLoginAttempts: 0,
    lockUntil: null,
    forcePasswordReset: false,
    allowedCategories: [],
    save: async () => {},
  };

  User.findOne = async () => user;
  Firm.countDocuments = async () => 1;
  AuthAudit.create = async () => ({});
  AuditLog.create = async () => ({});
  emailService.sendLoginOtpEmail = async () => ({ success: true });
  bcrypt.compare = async () => true;
  log.info = (event, meta) => {
    loggedEvents.push({ event, meta });
  };

  const { res, body } = createMockRes();

  try {
    await login(
      {
        body: { xid: 'X000001', password: 'Correct#123' },
        params: { firmSlug: 'firm-a' },
        firmId: '507f1f77bcf86cd799439022',
        firmSlug: 'firm-a',
        firmName: 'Firm A',
        loginScope: 'tenant',
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    User.findOne = originalUserFindOne;
    Firm.countDocuments = originalFirmCountDocuments;
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    emailService.sendLoginOtpEmail = originalSendLoginOtpEmail;
    bcrypt.compare = originalBcryptCompare;
    log.info = originalLogInfo;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.strictEqual(body.success, true, 'Login should still require OTP successfully');
  assert(loggedEvents.some(({ event }) => event === 'OTP_EMAIL_QUEUED'), 'Auth controller should log OTP_EMAIL_QUEUED');
  assert(!loggedEvents.some(({ event }) => event === 'OTP_EMAIL_SENT'), 'Auth controller must not log OTP_EMAIL_SENT');
}

async function shouldBypassQueueForLoginOtpEmailsInDevelopment() {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';

  const originalEmailServiceCache = require.cache[emailServiceModulePath];
  const originalEmailQueueCache = require.cache[emailQueueModulePath];

  try {
    delete require.cache[emailServiceModulePath];
    require.cache[emailQueueModulePath] = {
      id: emailQueueModulePath,
      filename: emailQueueModulePath,
      loaded: true,
      exports: {
        enqueueEmailJob: async () => {
          throw new Error('Queue should not be used for development OTP emails');
        },
      },
    };

    const devEmailService = require('../src/services/email.service');
    const result = await devEmailService.sendLoginOtpEmail({
      email: 'tenant@example.com',
      name: 'Tenant User',
      otp: '123456',
      expiryMinutes: 10,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.console, true, 'Development OTP email should send immediately via sendEmailNow');
  } finally {
    restoreModuleCache(emailServiceModulePath, originalEmailServiceCache);
    restoreModuleCache(emailQueueModulePath, originalEmailQueueCache);
    process.env.NODE_ENV = originalNodeEnv;
  }
}

async function shouldLogQueuedEmailJobs() {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const originalEmailServiceCache = require.cache[emailServiceModulePath];
  const originalEmailQueueCache = require.cache[emailQueueModulePath];
  const originalLogInfo = log.info;

  const loggedEvents = [];

  try {
    delete require.cache[emailServiceModulePath];
    require.cache[emailQueueModulePath] = {
      id: emailQueueModulePath,
      filename: emailQueueModulePath,
      loaded: true,
      exports: {
        enqueueEmailJob: async () => ({ queued: true, jobId: 'job-123' }),
      },
    };

    log.info = (event, meta) => {
      loggedEvents.push({ event, meta });
    };

    const queuedEmailService = require('../src/services/email.service');
    const result = await queuedEmailService.sendEmail({
      to: 'tenant@example.com',
      subject: 'Queued subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    assert.deepStrictEqual(result, { success: true, queued: true, messageId: 'job-123' });
    assert.deepStrictEqual(loggedEvents[0], {
      event: 'EMAIL_JOB_ENQUEUED',
      meta: {
        to: 'tenant@example.com',
        subject: 'Queued subject',
      },
    });
  } finally {
    log.info = originalLogInfo;
    restoreModuleCache(emailServiceModulePath, originalEmailServiceCache);
    restoreModuleCache(emailQueueModulePath, originalEmailQueueCache);
    process.env.NODE_ENV = originalNodeEnv;
  }
}

async function shouldLogWorkerOtpDeliveryAndFailures() {
  const originalRedisUrl = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://localhost:6379';

  const originalWorkerCache = require.cache[emailWorkerModulePath];
  const originalBullmqCache = require.cache[bullmqModulePath];
  const originalEmailServiceCache = require.cache[emailServiceModulePath];
  const originalLogInfo = log.info;
  const originalLogError = log.error;

  let processor = null;
  let sendEmailNowImpl = async () => ({ success: true });
  const infoEvents = [];
  const errorEvents = [];

  try {
    delete require.cache[emailWorkerModulePath];
    require.cache[bullmqModulePath] = {
      id: bullmqModulePath,
      filename: bullmqModulePath,
      loaded: true,
      exports: {
        Worker: class FakeWorker {
          constructor(_name, handler) {
            processor = handler;
          }

          on() {}
        },
        UnrecoverableError: class FakeUnrecoverableError extends Error {},
      },
    };
    require.cache[emailServiceModulePath] = {
      id: emailServiceModulePath,
      filename: emailServiceModulePath,
      loaded: true,
      exports: {
        sendEmailNow: async (mailOptions) => sendEmailNowImpl(mailOptions),
      },
    };

    log.info = (event, meta) => {
      infoEvents.push({ event, meta });
    };
    log.error = (event, meta) => {
      errorEvents.push({ event, meta });
    };

    require('../src/workers/email.worker');
    assert(processor, 'Worker processor should be registered');

    await processor({
      name: 'sendEmail',
      data: {
        mailOptions: {
          to: 'tenant@example.com',
          subject: 'Your Docketra Login OTP',
          html: '<p>OTP</p>',
          text: 'OTP',
        },
      },
    });

    assert.deepStrictEqual(infoEvents[0], {
      event: 'OTP_EMAIL_SENT',
      meta: {
        email: 'tenant@example.com',
        subject: 'Your Docketra Login OTP',
        provider: 'brevo',
      },
    });

    const sendError = new Error('Brevo API error');
    sendEmailNowImpl = async () => {
      throw sendError;
    };

    await assert.rejects(
      () => processor({
        name: 'sendEmail',
        data: {
          mailOptions: {
            to: 'tenant@example.com',
            subject: 'Your Docketra Login OTP',
          },
        },
      }),
      sendError
    );

    assert.deepStrictEqual(errorEvents[0], {
      event: 'EMAIL_SEND_FAILED',
      meta: {
        error: 'Brevo API error',
        email: 'tenant@example.com',
      },
    });
  } finally {
    log.info = originalLogInfo;
    log.error = originalLogError;
    restoreModuleCache(emailWorkerModulePath, originalWorkerCache);
    restoreModuleCache(bullmqModulePath, originalBullmqCache);
    restoreModuleCache(emailServiceModulePath, originalEmailServiceCache);
    process.env.REDIS_URL = originalRedisUrl;
  }
}

async function run() {
  try {
    await shouldLogOtpEmailQueuedFromAuthController();
    await shouldBypassQueueForLoginOtpEmailsInDevelopment();
    await shouldLogQueuedEmailJobs();
    await shouldLogWorkerOtpDeliveryAndFailures();
    console.log('OTP email delivery logging tests passed.');
  } catch (error) {
    console.error('OTP email delivery logging tests failed:', error);
    process.exit(1);
  }
}

run();
