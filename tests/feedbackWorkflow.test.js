#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

// Models & Services
const Feedback = require('../src/models/Feedback.model');
const feedbackService = require('../src/services/feedback.service');
const feedbackController = require('../src/controllers/feedback.controller');
const emailService = require('../src/services/email.service');

async function runTests() {
  console.log('=== Running User Feedback & Bug Reporting Test Suite ===\n');

  // In-memory collection simulation for Feedback
  const feedbackStore = new Map();

  // Mock Feedback model methods
  const originalSave = Feedback.prototype.save;
  const originalFind = Feedback.find;
  const originalFindOne = Feedback.findOne;
  const originalCountDocuments = Feedback.countDocuments;

  Feedback.prototype.save = async function () {
    this._id = this._id || new mongoose.Types.ObjectId();
    this.createdAt = this.createdAt || new Date();
    this.updatedAt = new Date();
    feedbackStore.set(this.feedbackId, this);
    return this;
  };

  Feedback.find = (query = {}) => {
    let items = Array.from(feedbackStore.values());

    if (query.status) {
      if (typeof query.status === 'object' && query.status.$in) {
        items = items.filter((item) => query.status.$in.includes(item.status));
      } else {
        items = items.filter((item) => item.status === query.status);
      }
    }

    if (query.type) {
      items = items.filter((item) => item.type === query.type);
    }

    if (query.$or) {
      items = items.filter((item) => {
        return query.$or.some((condition) => {
          for (const [key, regex] of Object.entries(condition)) {
            const val = item[key];
            if (val && regex.test(String(val))) return true;
          }
          return false;
        });
      });
    }

    const chain = {
      sort: () => chain,
      skip: (n) => {
        items = items.slice(n);
        return chain;
      },
      limit: (n) => {
        items = items.slice(0, n);
        return chain;
      },
      lean: async () => items.map((i) => (i.toObject ? i.toObject() : { ...i })),
    };
    return chain;
  };

  Feedback.countDocuments = async (query = {}) => {
    let items = Array.from(feedbackStore.values());
    if (query.status) {
      if (typeof query.status === 'object' && query.status.$in) {
        items = items.filter((item) => query.status.$in.includes(item.status));
      } else {
        items = items.filter((item) => item.status === query.status);
      }
    }
    if (query.type) {
      items = items.filter((item) => item.type === query.type);
    }
    return items.length;
  };

  Feedback.findOne = async (query = {}) => {
    for (const item of feedbackStore.values()) {
      if (query.feedbackId && item.feedbackId === query.feedbackId) return item;
      if (query._id && String(item._id) === String(query._id)) return item;
    }
    return null;
  };

  // Mock Email Service
  const sentEmails = [];
  const originalSendEmail = emailService.sendEmail;
  emailService.sendEmail = async (payload) => {
    sentEmails.push(payload);
    return { success: true, messageId: 'mock-msg-123' };
  };

  try {
    // -------------------------------------------------------------------------
    // Test 1: Validation Guardrails on Feedback Submission
    // -------------------------------------------------------------------------
    console.log('--- Test 1: User Submission Validation Guardrails ---');

    // Missing user / xID
    await assert.rejects(
      () => feedbackService.createFeedback({ user: null, message: 'Valid message' }),
      /Authenticated user with xID is required/
    );

    await assert.rejects(
      () => feedbackService.createFeedback({ user: { email: 'test@example.com' }, message: 'Valid message' }),
      /Authenticated user with xID is required/
    );

    // Missing message or message < 5 chars
    await assert.rejects(
      () => feedbackService.createFeedback({
        user: { xID: 'X100001', email: 'user@firm.com' },
        message: '',
      }),
      /Feedback message is required/
    );

    await assert.rejects(
      () => feedbackService.createFeedback({
        user: { xID: 'X100001', email: 'user@firm.com' },
        message: 'help',
      }),
      /Feedback message must be at least 5 characters/
    );

    // Missing email
    await assert.rejects(
      () => feedbackService.createFeedback({
        user: { xID: 'X100001', name: 'John Doe' },
        message: 'This is a valid test bug report message',
      }),
      /User email is required to submit feedback/
    );

    console.log('  ✓ Input validation rejects invalid payloads (user, length, email)');

    // -------------------------------------------------------------------------
    // Test 2: Successful Submission with Type, Firm Context, and Screenshot
    // -------------------------------------------------------------------------
    console.log('--- Test 2: Successful Feedback & Bug Submissions ---');

    const mockUser1 = {
      _id: new mongoose.Types.ObjectId(),
      xID: 'X100101',
      name: 'Priya Sharma',
      email: 'priya@apexlegal.in',
    };
    const mockFirm1 = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Apex Legal Partners',
      slug: 'apex-legal',
    };

    const bugResult = await feedbackService.createFeedback({
      user: mockUser1,
      firm: mockFirm1,
      type: 'BUG',
      message: 'Unable to upload attachment on Docket #DOCKET-20261124-00001. Throws timeout error.',
      pageUrl: 'https://app.docketra.in/apex-legal/dockets/DOCKET-20261124-00001',
      screenshot: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
    });

    assert.ok(bugResult.feedbackId.startsWith('FB-'), 'feedbackId must start with FB-');
    assert.strictEqual(bugResult.type, 'BUG');
    assert.strictEqual(bugResult.status, 'OPEN');

    const savedBug = feedbackStore.get(bugResult.feedbackId);
    assert.ok(savedBug, 'Saved bug must exist in store');
    assert.strictEqual(savedBug.userXID, 'X100101');
    assert.strictEqual(savedBug.userName, 'Priya Sharma');
    assert.strictEqual(savedBug.userEmail, 'priya@apexlegal.in');
    assert.strictEqual(savedBug.firmName, 'Apex Legal Partners');
    assert.strictEqual(savedBug.firmSlug, 'apex-legal');
    assert.ok(savedBug.screenshot.startsWith('data:image/jpeg;base64,'), 'Screenshot preserved');

    // Create a second item: General Feedback from another user
    const mockUser2 = {
      _id: new mongoose.Types.ObjectId(),
      xID: 'X100202',
      name: 'Rajesh Mehta',
      email: 'rajesh@mehtaca.com',
    };
    const feedbackResult = await feedbackService.createFeedback({
      user: mockUser2,
      type: 'FEEDBACK',
      message: 'Would love an option to bulk export monthly compliance filings to Excel directly.',
      pageUrl: 'https://app.docketra.in/mehta-ca/reports',
    });

    assert.strictEqual(feedbackResult.type, 'FEEDBACK');
    assert.strictEqual(feedbackResult.status, 'OPEN');

    console.log('  ✓ Feedback and bug submissions stored with reference ID, user metadata, and screenshots');

    // -------------------------------------------------------------------------
    // Test 3: Feedback Listing, Pagination & Search Filters
    // -------------------------------------------------------------------------
    console.log('--- Test 3: Superadmin Feedback Listing & Filtering ---');

    // List all
    const allList = await feedbackService.listFeedback();
    assert.strictEqual(allList.feedback.length, 2);
    assert.strictEqual(allList.pagination.total, 2);

    // Filter by type: BUG
    const bugList = await feedbackService.listFeedback({ type: 'BUG' });
    assert.strictEqual(bugList.feedback.length, 1);
    assert.strictEqual(bugList.feedback[0].type, 'BUG');

    // Filter by status: OPEN
    const openList = await feedbackService.listFeedback({ status: 'OPEN' });
    assert.strictEqual(openList.feedback.length, 2);

    // Search by user xID
    const searchXid = await feedbackService.listFeedback({ search: 'X100101' });
    assert.strictEqual(searchXid.feedback.length, 1);
    assert.strictEqual(searchXid.feedback[0].userName, 'Priya Sharma');

    // Search by firm name
    const searchFirm = await feedbackService.listFeedback({ search: 'Apex Legal' });
    assert.strictEqual(searchFirm.feedback.length, 1);

    // Search by message keyword
    const searchMsg = await feedbackService.listFeedback({ search: 'bulk export' });
    assert.strictEqual(searchMsg.feedback.length, 1);
    assert.strictEqual(searchMsg.feedback[0].userXID, 'X100202');

    console.log('  ✓ List, status filters, type filters, and search queries work accurately');

    // -------------------------------------------------------------------------
    // Test 4: Feedback Statistics Aggregations
    // -------------------------------------------------------------------------
    console.log('--- Test 4: Superadmin KPI Statistics ---');

    const stats = await feedbackService.getFeedbackStats();
    assert.strictEqual(stats.total, 2);
    assert.strictEqual(stats.open, 2);
    assert.strictEqual(stats.resolved, 0);
    assert.strictEqual(stats.bugs, 1);

    console.log('  ✓ Platform stats return accurate totals, open counts, and bug counts');

    // -------------------------------------------------------------------------
    // Test 5: Superadmin Reply & Automated Email Notification
    // -------------------------------------------------------------------------
    console.log('--- Test 5: Superadmin Reply & Email Dispatch ---');

    const responder = {
      xID: 'X000001',
      email: 'superadmin@docketra.in',
    };

    const replyResponse = await feedbackService.replyToFeedback({
      feedbackId: bugResult.feedbackId,
      response: 'We investigated the upload timeout and deployed a fix to the S3 upload gateway. Please try uploading your attachment now!',
      responder,
    });

    assert.strictEqual(replyResponse.success, true);
    assert.strictEqual(replyResponse.feedback.status, 'RESOLVED');
    assert.strictEqual(replyResponse.feedback.respondedBy, 'X000001');
    assert.strictEqual(replyResponse.feedback.respondedByEmail, 'superadmin@docketra.in');
    assert.ok(replyResponse.feedback.respondedAt instanceof Date);

    // Verify email was dispatched to Priya Sharma
    assert.strictEqual(sentEmails.length, 1);
    const sentEmail = sentEmails[0];
    assert.strictEqual(sentEmail.to, 'priya@apexlegal.in');
    assert.ok(sentEmail.subject.includes(bugResult.feedbackId));
    assert.ok(sentEmail.html.includes('deployed a fix to the S3 upload gateway'));
    assert.ok(sentEmail.text.includes(bugResult.feedbackId));

    // Check stats updated
    const updatedStats = await feedbackService.getFeedbackStats();
    assert.strictEqual(updatedStats.open, 1);
    assert.strictEqual(updatedStats.resolved, 1);

    console.log('  ✓ Reply marked ticket as RESOLVED and dispatched branded reply email to user');

    // -------------------------------------------------------------------------
    // Test 6: Controller Request & Response Envelopes
    // -------------------------------------------------------------------------
    console.log('--- Test 6: Controller Endpoint Handlers ---');

    // Submit via controller
    const mockReqSubmit = {
      user: mockUser1,
      firm: mockFirm1,
      body: {
        type: 'ERROR',
        message: 'Encountered 500 error when clicking Refresh on Dashboard.',
      },
    };
    let submitStatus = null;
    let submitJson = null;
    const mockResSubmit = {
      status: (code) => {
        submitStatus = code;
        return mockResSubmit;
      },
      json: (data) => {
        submitJson = data;
        return mockResSubmit;
      },
    };

    await feedbackController.submitFeedback(mockReqSubmit, mockResSubmit);
    assert.strictEqual(submitStatus, 201);
    assert.strictEqual(submitJson.success, true);
    assert.ok(submitJson.message.includes('Thank you'));
    assert.strictEqual(submitJson.data.type, 'ERROR');

    // List via controller
    let listJson = null;
    const mockResList = {
      json: (data) => {
        listJson = data;
        return mockResList;
      },
    };
    await feedbackController.getSuperadminFeedbackList({ query: {} }, mockResList);
    assert.strictEqual(listJson.success, true);
    assert.strictEqual(listJson.data.length, 3);
    assert.ok(listJson.pagination);

    // Reply via controller
    let replyJson = null;
    const mockReqReply = {
      params: { id: submitJson.data.feedbackId },
      body: { response: 'The dashboard caching service was restarted. Everything is running smoothly now.' },
      user: responder,
    };
    const mockResReply = {
      json: (data) => {
        replyJson = data;
        return mockResReply;
      },
    };
    await feedbackController.replySuperadminFeedback(mockReqReply, mockResReply);
    assert.strictEqual(replyJson.success, true);
    assert.strictEqual(replyJson.data.status, 'RESOLVED');

    console.log('  ✓ Controller HTTP contracts return standardized success envelopes');

    console.log('\n✅ All User Feedback & Bug Reporting tests passed successfully!\n');
  } finally {
    // Restore mocks
    Feedback.prototype.save = originalSave;
    Feedback.find = originalFind;
    Feedback.findOne = originalFindOne;
    Feedback.countDocuments = originalCountDocuments;
    emailService.sendEmail = originalSendEmail;
  }
}

runTests().catch((err) => {
  console.error('❌ Feedback workflow test failed:', err);
  process.exit(1);
});
