#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const publicRoutes = require('../src/routes/public.routes');

const app = express();
app.use(express.json());
app.use('/api/public', publicRoutes);

async function run() {
  try {
    const response = await request(app)
      .post('/api/public/signup')
      .send({
        firmName: 'Agarwal & Co. Chartered Accountants',
        practiceType: 'CA',
        teamMembers: 12,
        currentWorkflowSystem: 'Spreadsheets and email',
        compliancePainPoint: 'Partner visibility for overdue filings',
        goLiveTimeline: 'Q2 2026',
      });

    assert.strictEqual(response.status, 202);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(
      response.body.message,
      'Thank you. Our team will review your request and schedule a walkthrough.'
    );

    console.log('Public early access request test passed.');
  } catch (error) {
    console.error('Public early access request test failed:', error);
    process.exit(1);
  }
}

run();
