const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const dueService = read('src/services/docketDueNotification.service.js');
const notificationService = read('src/services/notification.service.js');
const notificationController = read('src/controllers/notifications.controller.js');
const notificationRoutes = read('src/routes/notifications.routes.js');
const workerBootstrap = read('src/services/workerBootstrap.service.js');
const notificationBell = read('ui/src/components/platform/NotificationBell.jsx');
const notificationHistory = read('ui/views/NotificationHistoryView.jsx');
const protectedRoutes = read('ui/src/routes/ProtectedRoutes.jsx');
const whatsNew = read('docs/whats-new.md');

// 1) Recipient scoping & active/deleted behavior
assert.ok(dueService.includes('status: { $ne: \'deleted\' }'), 'Recipients should exclude deleted users.');
assert.ok(dueService.includes('isActive: true'), 'Workbasket broadcast should include active users only.');
assert.ok(dueService.includes('if (docket.assignedToXID) {'), 'Direct assignee flow should remain explicit/intentional.');
assert.ok(notificationService.includes('firmId: normalized.firmId'), 'Notification creation should enforce same-firm recipient lookup.');

// 2) Duplicate prevention
assert.ok(dueService.includes("'metadata.dueDateKey': dueDateKey"), 'Due notifications should dedupe with dueDateKey metadata.');
assert.ok(dueService.includes('docketId,'), 'Due notifications should scope dedupe by docket.');
assert.ok(dueService.includes('userId,'), 'Due notifications should scope dedupe by recipient.');
assert.ok(dueService.includes('type,'), 'Due notifications should scope dedupe by type.');
assert.ok(notificationService.includes('const GROUPING_WINDOW_MS = 30 * 60 * 1000;'), 'Workflow/event notifications should keep grouping-based duplicate suppression window.');

// 3) Background jobs and side effects
assert.ok(workerBootstrap.includes('Math.max(5 * 60 * 1000'), 'Due notification interval must enforce a safe floor (>= 5 min).');
assert.ok(!workerBootstrap.includes('cleanupReadNotifications('), 'Read-notification cleanup should not be aggressively auto-scheduled here.');
assert.ok(!notificationController.includes('createNotification('), 'GET/list notification APIs must not generate notifications.');

// 4) UI behavior
assert.ok(notificationBell.includes('catch {') && notificationBell.includes('non-blocking'), 'Bell fetch failures should remain non-blocking.');
assert.ok(notificationBell.includes('unreadCount > 0 ? <span className="platform__notification-badge"'), 'Unread badge should only render when unread items exist.');
assert.ok(notificationHistory.includes('notificationsApi.markAllAsRead()'), 'History should trigger mark-all-as-read API.');
assert.ok(notificationHistory.includes('Loading notification history…'), 'History should provide loading state.');
assert.ok(notificationHistory.includes('Unable to load history'), 'History should provide error state.');
assert.ok(notificationHistory.includes('No notification history'), 'History should provide empty state.');

// 5) Route/security
assert.ok(protectedRoutes.includes('path="notifications"'), 'Notification history route must remain protected in firm workspace routes.');
assert.ok(notificationController.includes('markNotificationAsRead(id, userId, firmId)'), 'Single mark-as-read must scope to current user+firm.');
assert.ok(notificationController.includes('markAllNotificationsAsRead(userId, firmId)'), 'Mark-all-as-read must scope to current user+firm.');

// 6) Docs
const whatsNewHeadingCount = (whatsNew.match(/^# What's New$/gm) || []).length;
assert.strictEqual(whatsNewHeadingCount, 1, "docs/whats-new.md must contain exactly one '# What's New' heading.");

console.log('notificationSystemAudit.test.js passed');
