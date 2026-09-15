'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { NotificationTypes } = require('../src/constants/notificationTypes');
const Notification = require('../src/models/Notification.model');
const NotificationPreference = require('../src/models/NotificationPreference.model');
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
} = require('../src/services/notification.service');
const {
  getOrCreateNotificationPreferences,
  updateNotificationPreferences,
} = require('../src/services/notificationPreference.service');
const { cleanupReadNotifications } = require('../src/services/notificationCleanup.service');
const {
  NotificationTypes: DomainNotificationTypes,
  createNotification: domainCreateNotification,
} = require('../src/domain/notifications');
const {
  getNotifications,
  getAllNotifications,
  markAsRead: controllerMarkAsRead,
  markAllAsRead: controllerMarkAllAsRead,
} = require('../src/controllers/notifications.controller');

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.data = body;
      return this;
    },
  };
  return res;
}

async function testSchemaAndEnums() {
  console.log('\n--- 1. Testing Schema and NotificationTypes Alignment ---');

  // Verify all NotificationTypes are covered in Notification model enum
  const allowedEnums = Notification.schema.path('type').enumValues;
  for (const typeKey of Object.keys(NotificationTypes)) {
    const typeValue = NotificationTypes[typeKey];
    assert.ok(
      allowedEnums.includes(typeValue),
      `Notification model enum must include ${typeKey} (${typeValue})`
    );
  }

  // Verify all NotificationTypes are covered in domain/notifications
  for (const typeKey of Object.keys(NotificationTypes)) {
    assert.ok(
      DomainNotificationTypes[typeKey],
      `domain/notifications must map ${typeKey}`
    );
  }

  console.log('✓ All 12 NotificationTypes are registered across Schema, Constants, and Domain');
}

async function testAllNotificationTypesGeneration(firmId, activeUser) {
  console.log('\n--- 2. Testing Generation of Every Notification Type ---');

  const testCases = [
    {
      type: NotificationTypes.DOCKET_ASSIGNED,
      docketId: 'DOC-101',
      title: 'Docket assigned',
      message: 'Admin assigned docket DOC-101 to you.',
      priority: 'HIGH',
    },
    {
      type: NotificationTypes.DOCKET_REASSIGNED,
      docketId: 'DOC-102',
      title: 'Docket reassigned',
      message: 'Senior Associate reassigned docket DOC-102 to you.',
      priority: 'NORMAL',
    },
    {
      type: NotificationTypes.STATUS_CHANGED,
      docketId: 'DOC-103',
      title: 'Status changed',
      message: 'Docket DOC-103 status changed from in_progress to resolved.',
      priority: 'NORMAL',
    },
    {
      type: NotificationTypes.COMMENT_ADDED,
      docketId: 'DOC-104',
      title: 'Mentioned in comment',
      message: '@Partner (X000001) tagged you in a comment on docket DOC-104.',
      priority: 'NORMAL',
    },
    {
      type: NotificationTypes.DOCKET_ROUTED_TO_WORKBASKET,
      docketId: 'DOC-105',
      title: 'Docket routed',
      message: 'Docket DOC-105 was routed to Statutory Audit.',
      priority: 'NORMAL',
    },
    {
      type: NotificationTypes.QC_RETURNED,
      docketId: 'DOC-106',
      title: 'QC returned docket',
      message: 'QC returned Docket DOC-106 for correction.',
      priority: 'HIGH',
    },
    {
      type: NotificationTypes.PENDED_DOCKET_REOPENED,
      docketId: 'DOC-107',
      title: 'Pended docket reopened',
      message: 'Pended Docket DOC-107 is back in your Worklist.',
      priority: 'NORMAL',
    },
    {
      type: NotificationTypes.CLIENT_UPLOAD,
      docketId: 'DOC-108',
      title: 'Client upload',
      message: 'Tata Consultancy Services uploaded documents.',
      priority: 'HIGH',
    },
    {
      type: NotificationTypes.DOCKET_DUE_SOON,
      docketId: 'DOC-109',
      title: 'Docket due soon',
      message: 'Docket DOC-109 is due in 24 hours.',
      priority: 'HIGH',
    },
    {
      type: NotificationTypes.DOCKET_OVERDUE,
      docketId: 'DOC-110',
      title: 'Docket overdue',
      message: 'Docket DOC-110 has passed its statutory due date.',
      priority: 'CRITICAL',
    },
    {
      type: NotificationTypes.SLA_BREACHED,
      docketId: 'DOC-111',
      title: 'SLA Breached',
      message: 'Docket DOC-111 has breached its SLA.',
      priority: 'CRITICAL',
    },
    {
      type: NotificationTypes.FIRM_CALENDAR_REMINDER,
      docketId: null,
      title: 'Important date reminder',
      message: 'Q2 GST Annual Return deadline is on 2026-09-30.',
      priority: 'NORMAL',
      metadata: { calendarEntryType: 'statutory_compliance' },
    },
  ];

  for (const item of testCases) {
    const doc = await createNotification({
      firmId,
      recipientXID: activeUser.xID,
      type: item.type,
      docketId: item.docketId,
      title: item.title,
      message: item.message,
      priority: item.priority,
      metadata: item.metadata || null,
      group: false,
    });

    assert.ok(doc, `Notification of type ${item.type} must be created`);
    assert.strictEqual(doc.type, item.type);
    assert.strictEqual(doc.title, item.title);
    assert.strictEqual(doc.message, item.message);
    assert.strictEqual(doc.isRead, false);
    assert.strictEqual(doc.read, false, 'Virtual "read" must equal isRead');
    assert.ok(doc.createdAt, 'Timestamp must exist');
    assert.ok(doc.timestamp, 'Virtual "timestamp" must equal createdAt');
  }

  console.log(`✓ All ${testCases.length} notification types successfully created and stored in DB`);
}

async function testDomainDispatchAndMessageBuilder(firmId, activeUser) {
  console.log('\n--- 3. Testing Domain Notification Message Building ---');

  // Test automatic message building in domain/notifications
  const domainPayload = domainCreateNotification({
    firmId,
    recipientXID: activeUser.xID,
    type: DomainNotificationTypes.SLA_BREACHED,
    docketId: 'DOC-DOMAIN-1',
  });

  assert.strictEqual(domainPayload.title, 'SLA Breached');
  assert.ok(domainPayload.message.includes('has breached its SLA'));

  const domainCalendar = domainCreateNotification({
    firmId,
    recipientXID: activeUser.xID,
    type: DomainNotificationTypes.FIRM_CALENDAR_REMINDER,
    actor: { calendarEntryType: 'birthday', title: "Alice's Birthday", dueDateKey: '2026-10-15T00:00:00.000Z' },
  });
  assert.strictEqual(domainCalendar.title, 'Birthday reminder');
  assert.ok(domainCalendar.message.includes("Alice's Birthday"));

  console.log('✓ Domain notification message builder formats titles and messages accurately');
}

async function testTenantScopingAndUserResolution(firm1Id, firm2Id, userF1, userF2, deletedUser) {
  console.log('\n--- 4. Testing Multi-Tenant Scoping and Recipient Resolution ---');

  // 4a. Case-insensitive xID resolution
  const docLower = await createNotification({
    firmId: firm1Id,
    recipientXID: userF1.xID.toLowerCase(),
    type: NotificationTypes.DOCKET_ASSIGNED,
    docketId: 'DOC-CI-1',
    title: 'Case insensitive test',
    message: 'Testing xID casing',
    group: false,
  });
  assert.ok(docLower, 'Notification should be created when lowercase xID is passed');
  assert.strictEqual(docLower.userId, userF1.xID.toUpperCase());

  // 4b. MongoDB _id resolution via recipientUserId
  const docByMongoId = await createNotification({
    firmId: firm1Id,
    recipientUserId: String(userF1._id),
    type: NotificationTypes.DOCKET_ASSIGNED,
    docketId: 'DOC-MONGOID-1',
    title: 'MongoID recipient test',
    message: 'Testing user _id to xID resolution',
    group: false,
  });
  assert.ok(docByMongoId, 'Notification should resolve recipientUserId to xID');
  assert.strictEqual(docByMongoId.userId, userF1.xID.toUpperCase());

  // 4c. Cross-firm isolation: F1 cannot notify a user belonging to F2
  const crossFirmDoc = await createNotification({
    firmId: firm1Id,
    recipientXID: userF2.xID,
    type: NotificationTypes.DOCKET_ASSIGNED,
    docketId: 'DOC-CROSS-1',
    title: 'Cross firm',
    message: 'Should not create',
    group: false,
  });
  assert.strictEqual(crossFirmDoc, null, 'Cross-firm notification must be blocked');

  // 4d. Soft-deleted user cannot receive notification
  const deletedUserDoc = await createNotification({
    firmId: firm1Id,
    recipientXID: deletedUser.xID,
    type: NotificationTypes.DOCKET_ASSIGNED,
    docketId: 'DOC-DEL-1',
    title: 'Deleted user',
    message: 'Should not create',
    group: false,
  });
  assert.strictEqual(deletedUserDoc, null, 'Soft-deleted user must not receive notifications');

  console.log('✓ Multi-tenant scoping, deleted-user guardrails, and ID resolution enforced strictly');
}

async function testNotificationGrouping(firmId, user) {
  console.log('\n--- 5. Testing 30-Minute Deduplication & Grouping Window ---');

  const baseTime = new Date('2026-09-15T10:00:00.000Z');

  // First notification
  const doc1 = await createNotification({
    firmId,
    recipientXID: user.xID,
    type: NotificationTypes.STATUS_CHANGED,
    docketId: 'DOC-GROUP-1',
    title: 'Status changed',
    message: 'Status updated to In Progress',
    createdAt: baseTime,
    group: true,
  });
  assert.ok(doc1);
  assert.strictEqual(doc1.groupCount, 1);
  assert.strictEqual(doc1.message, 'Status updated to In Progress');

  // Rapid second notification within 30 minutes for the same docket & type
  const doc2 = await createNotification({
    firmId,
    recipientXID: user.xID,
    type: NotificationTypes.STATUS_CHANGED,
    docketId: 'DOC-GROUP-1',
    title: 'Status changed',
    message: 'Status updated to QC Pending',
    createdAt: new Date(baseTime.getTime() + 5 * 60 * 1000), // +5 mins
    group: true,
  });
  assert.ok(doc2);
  assert.strictEqual(String(doc2._id), String(doc1._id), 'Same notification should be updated');
  assert.strictEqual(doc2.groupCount, 2);
  assert.ok(doc2.message.includes('(2 updates)'));

  // Notification after grouping window (e.g. 45 minutes later) creates a new one
  const doc3 = await createNotification({
    firmId,
    recipientXID: user.xID,
    type: NotificationTypes.STATUS_CHANGED,
    docketId: 'DOC-GROUP-1',
    title: 'Status changed',
    message: 'Status updated to Resolved',
    createdAt: new Date(baseTime.getTime() + 45 * 60 * 1000), // +45 mins
    group: true,
  });
  assert.ok(doc3);
  assert.notStrictEqual(String(doc3._id), String(doc1._id), 'After window expires, new notification is created');
  assert.strictEqual(doc3.groupCount, 1);

  // Group: false bypasses grouping completely
  const docBypass = await createNotification({
    firmId,
    recipientXID: user.xID,
    type: NotificationTypes.STATUS_CHANGED,
    docketId: 'DOC-GROUP-1',
    title: 'Status changed',
    message: 'Urgent status override',
    createdAt: new Date(baseTime.getTime() + 46 * 60 * 1000),
    group: false,
  });
  assert.ok(docBypass);
  assert.notStrictEqual(String(docBypass._id), String(doc3._id));

  console.log('✓ Grouping window throttles repetitive updates into groupCount and appends update count');
}

async function testReadManagementAndApis(firmId, user) {
  console.log('\n--- 6. Testing Read Management, Pagination & Controller APIs ---');

  // Create 3 unread notifications
  const n1 = await createNotification({
    firmId,
    recipientXID: user.xID,
    type: NotificationTypes.DOCKET_ASSIGNED,
    docketId: 'DOC-READ-1',
    title: 'Read test 1',
    message: 'Unread 1',
    group: false,
  });
  const n2 = await createNotification({
    firmId,
    recipientXID: user.xID,
    type: NotificationTypes.DOCKET_ASSIGNED,
    docketId: 'DOC-READ-2',
    title: 'Read test 2',
    message: 'Unread 2',
    group: false,
  });
  const n3 = await createNotification({
    firmId,
    recipientXID: user.xID,
    type: NotificationTypes.DOCKET_ASSIGNED,
    docketId: 'DOC-READ-3',
    title: 'Read test 3',
    message: 'Unread 3',
    group: false,
  });

  // Mark single as read
  const marked1 = await markAsRead(n1._id, user.xID, firmId);
  assert.strictEqual(marked1.isRead, true);

  // Security test: cannot mark another firm's notification as read
  const crossMark = await markAsRead(n2._id, user.xID, 'OTHER_FIRM_999');
  assert.strictEqual(crossMark, null, 'Cross-tenant markAsRead must be null');

  // Mark all remaining as read
  const modifiedCount = await markAllAsRead(user.xID, firmId);
  assert.ok(modifiedCount >= 2, 'Should mark remaining unread notifications');

  // Controller API test: getNotifications
  const req = {
    user: { firmId, xID: user.xID },
    query: { limit: '5' },
  };
  const res = createMockRes();
  await getNotifications(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.success, true);
  assert.ok(Array.isArray(res.data.data));
  assert.ok(res.data.data.length <= 5);

  // Verify response contract normalization
  const first = res.data.data[0];
  assert.ok(first._id);
  assert.ok(first.id);
  assert.ok(first.type);
  assert.ok(first.title);
  assert.ok(first.message);
  assert.strictEqual(typeof first.isRead, 'boolean');
  assert.strictEqual(typeof first.read, 'boolean');

  // Controller API test: markAllAsRead
  const markAllReq = {
    user: { firmId, xID: user.xID },
  };
  const markAllRes = createMockRes();
  await controllerMarkAllAsRead(markAllReq, markAllRes);
  assert.strictEqual(markAllRes.statusCode, 200);
  assert.strictEqual(markAllRes.data.success, true);
  assert.strictEqual(typeof markAllRes.data.data.updatedCount, 'number');

  console.log('✓ Mark as read, mark all read, and REST controller endpoints verified');
}

async function testNotificationPreferences(firmId, user) {
  console.log('\n--- 7. Testing Notification Channel Preferences ---');

  const initialPrefs = await getOrCreateNotificationPreferences(user.xID, firmId);
  assert.strictEqual(initialPrefs.userId, user.xID);
  assert.strictEqual(initialPrefs.defaultChannels.inApp, true);
  assert.strictEqual(initialPrefs.defaultChannels.email, false);

  // Update preferences: enable email for SLA_BREACHED specifically
  const updated = await updateNotificationPreferences(user.xID, firmId, {
    typeChannels: {
      SLA_BREACHED: { inApp: true, email: true },
    },
  });

  assert.strictEqual(updated.typeChannels.SLA_BREACHED.email, true);
  assert.strictEqual(updated.typeChannels.SLA_BREACHED.inApp, true);
  assert.strictEqual(updated.defaultChannels.email, false);

  console.log('✓ Notification delivery channels and per-type override preferences verified');
}

async function testRetentionCleanup(firmId, user) {
  console.log('\n--- 8. Testing Retention Cleanup Service ---');

  const now = Date.now();
  const oldDate = new Date(now - 100 * 24 * 60 * 60 * 1000); // 100 days ago
  const recentDate = new Date(now - 10 * 24 * 60 * 60 * 1000); // 10 days ago

  // 1. Old read notification (should be deleted)
  await Notification.create({
    firmId,
    userId: user.xID,
    type: NotificationTypes.DOCKET_ASSIGNED,
    title: 'Old Read',
    message: 'To be cleaned up',
    isRead: true,
    createdAt: oldDate,
  });

  // 2. Old unread notification (must be preserved!)
  const oldUnread = await Notification.create({
    firmId,
    userId: user.xID,
    type: NotificationTypes.DOCKET_ASSIGNED,
    title: 'Old Unread',
    message: 'Must stay intact',
    isRead: false,
    createdAt: oldDate,
  });

  // 3. Recent read notification (must be preserved!)
  const recentRead = await Notification.create({
    firmId,
    userId: user.xID,
    type: NotificationTypes.DOCKET_ASSIGNED,
    title: 'Recent Read',
    message: 'Must stay intact',
    isRead: true,
    createdAt: recentDate,
  });

  const cleanupResult = await cleanupReadNotifications({
    retentionDays: 90,
    firmId,
    userId: user.xID,
  });

  assert.ok(cleanupResult.deletedCount >= 1, 'Should delete read notifications older than 90 days');

  const preservedUnread = await Notification.findById(oldUnread._id);
  assert.ok(preservedUnread, 'Old unread notifications must NEVER be deleted during cleanup');

  const preservedRecent = await Notification.findById(recentRead._id);
  assert.ok(preservedRecent, 'Recent read notifications (< 90 days) must be preserved');

  console.log('✓ Retention cleanup safely purges only aged read notifications (>90 days)');
}

async function run() {
  console.log('====================================================');
  console.log('RUNNING NOTIFICATION SYSTEM COMPREHENSIVE TEST SUITE');
  console.log('====================================================');

  await testSchemaAndEnums();

  let mongoServer = null;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const firm1 = await Firm.create({
      firmId: 'FIRM001',
      name: 'Premier Legal LLP',
      firmSlug: 'premier-legal',
      status: 'active',
    });

    const firm2 = await Firm.create({
      firmId: 'FIRM002',
      name: 'Apex CA Partners',
      firmSlug: 'apex-ca',
      status: 'active',
    });

    const defaultClientF1 = new mongoose.Types.ObjectId();
    const defaultClientF2 = new mongoose.Types.ObjectId();

    const userF1 = await User.create({
      name: 'Advocate Sharma',
      email: 'sharma@premier.local',
      role: 'PRIMARY_ADMIN',
      xID: 'X100001',
      xid: 'X100001',
      firmId: firm1._id,
      defaultClientId: defaultClientF1,
      status: 'active',
      isActive: true,
    });

    const userF2 = await User.create({
      name: 'Chartered Accountant Verma',
      email: 'verma@apex.local',
      role: 'PRIMARY_ADMIN',
      xID: 'X200001',
      xid: 'X200001',
      firmId: firm2._id,
      defaultClientId: defaultClientF2,
      status: 'active',
      isActive: true,
    });

    const deletedUser = await User.create({
      name: 'Former Staff',
      email: 'former@premier.local',
      role: 'Employee',
      xID: 'X100002',
      xid: 'X100002',
      firmId: firm1._id,
      defaultClientId: defaultClientF1,
      primaryAdminId: userF1._id,
      status: 'deleted',
      isActive: false,
    });

    await testAllNotificationTypesGeneration(String(firm1._id), userF1);
    await testDomainDispatchAndMessageBuilder(String(firm1._id), userF1);
    await testTenantScopingAndUserResolution(String(firm1._id), String(firm2._id), userF1, userF2, deletedUser);
    await testNotificationGrouping(String(firm1._id), userF1);
    await testReadManagementAndApis(String(firm1._id), userF1);
    await testNotificationPreferences(String(firm1._id), userF1);
    await testRetentionCleanup(String(firm1._id), userF1);

    console.log('\n====================================================');
    console.log('ALL NOTIFICATION FEATURE TESTS PASSED! ✓');
    console.log('====================================================');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

run().catch((err) => {
  console.error('\n❌ Notification test suite failed:', err);
  process.exit(1);
});
