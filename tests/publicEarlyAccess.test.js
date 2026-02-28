#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const publicRoutes = require('../src/routes/public.routes');
const EarlyAccessRequest = require('../src/models/EarlyAccessRequest.model');

const app = express();
app.use(express.json());
app.use('/api/public', publicRoutes);

async function run() {
  const payload = {
    firmName: 'Agarwal & Co. Chartered Accountants',
    practiceType: 'CA',
    teamMembers: 12,
    currentWorkflowSystem: 'Spreadsheets and email',
    compliancePainPoint: 'Partner visibility for overdue filings',
    goLiveTimeline: 'Q2 2026',
  };

  const originalCreate = EarlyAccessRequest.create;
  let createdDoc = null;

  try {
    EarlyAccessRequest.create = async (data) => {
      createdDoc = new EarlyAccessRequest(data);
      return createdDoc;
    };

    const response = await request(app)
      .post('/api/public/signup')
      .send(payload);

    assert.strictEqual(response.status, 202);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(
      response.body.message,
      'Thank you. Our team will review your request and schedule a walkthrough.'
    );
    assert(createdDoc, 'Expected early access request record to be created');
    assert.strictEqual(createdDoc.status, 'NEW');
    assert.strictEqual(createdDoc.firmName, payload.firmName);
    assert.strictEqual(createdDoc.practiceType, payload.practiceType);
    assert.strictEqual(createdDoc.teamMembers, payload.teamMembers);
    assert.strictEqual(createdDoc.currentWorkflowSystem, payload.currentWorkflowSystem);
    assert.strictEqual(createdDoc.compliancePainPoint, payload.compliancePainPoint);
    assert.strictEqual(createdDoc.goLiveTimeline, payload.goLiveTimeline);

    console.log('Public early access request test passed.');
  } catch (error) {
    console.error('Public early access request test failed:', error);
    process.exit(1);
  } finally {
    EarlyAccessRequest.create = originalCreate;
  }
}

run();
