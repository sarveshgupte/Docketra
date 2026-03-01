#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const publicRoutes = require('../src/routes/public.routes');
const EnterpriseInquiry = require('../src/models/EnterpriseInquiry.model');
const emailService = require('../src/services/email.service');

async function run() {
  const originalCreate = EnterpriseInquiry.create;
  const originalSend = emailService.sendEnterpriseInquiryNotification;

  try {
    const payload = {
      name: 'Jane Smith',
      email: 'jane@example.com',
      firmName: 'Smith Legal',
      numberOfUsers: 25,
      phone: '+1-555-0100',
      requirements: 'Need SSO and audit controls',
    };

    let sentPayload = null;
    EnterpriseInquiry.create = async (data) => ({ ...data });
    emailService.sendEnterpriseInquiryNotification = async (data) => {
      sentPayload = data;
      return { success: true };
    };

    const app = express();
    app.use(express.json());
    app.use('/api/public', publicRoutes);

    const response = await request(app)
      .post('/api/public/contact')
      .send(payload)
      .set('x-forwarded-for', '203.0.113.2');

    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.success, true);
    assert(sentPayload, 'Expected enterprise inquiry email payload');
    assert.strictEqual(sentPayload.contactPerson, payload.name);
    assert.strictEqual(sentPayload.message, payload.requirements);
    assert.ok(typeof sentPayload.ipAddress === 'string' && sentPayload.ipAddress.length > 0);
    assert.ok(sentPayload.timestamp, 'Expected timestamp to be set');

    emailService.sendEnterpriseInquiryNotification = async () => {
      throw new Error('email-down');
    };

    const failedResponse = await request(app)
      .post('/api/public/contact')
      .send(payload)
      .set('x-forwarded-for', '203.0.113.3');
    assert.strictEqual(failedResponse.status, 202);
    assert.strictEqual(failedResponse.body.success, true);

    console.log('Contact controller test passed.');
  } catch (error) {
    console.error('Contact controller test failed:', error);
    process.exit(1);
  } finally {
    EnterpriseInquiry.create = originalCreate;
    emailService.sendEnterpriseInquiryNotification = originalSend;
  }
}

run();
