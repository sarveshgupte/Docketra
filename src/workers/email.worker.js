'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { sendEmailNow } = require('../services/email.service');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const logger = require('../utils/log');

const LOGIN_OTP_SUBJECT = 'Your Docketra Login OTP';

const redisUrl = process.env.REDIS_URL;
let emailWorker = null;
if (!redisUrl) {
  setWorkerStatus('email', 'disabled');
} else {
  setWorkerStatus('email', 'starting');
  emailWorker = new Worker(
    'emailQueue',
    async (job) => {
      if (job.name !== 'sendEmail') {
        throw new UnrecoverableError(`Unknown email job type: ${job.name}`);
      }
      const mailOptions = job.data?.mailOptions || {};

      try {
        await sendEmailNow(mailOptions);

        if (mailOptions.subject === LOGIN_OTP_SUBJECT) {
          logger.info('OTP_EMAIL_SENT', {
            email: mailOptions.to,
            subject: mailOptions.subject,
            provider: 'brevo',
          });
        }
      } catch (error) {
        logger.error('EMAIL_SEND_FAILED', {
          error: error.message,
          email: mailOptions.to,
        });
        throw error;
      }
    },
    { connection: { url: redisUrl } }
  );

  emailWorker.on('ready', () => setWorkerStatus('email', 'running'));
  emailWorker.on('error', () => setWorkerStatus('email', 'error'));
}

module.exports = emailWorker;
