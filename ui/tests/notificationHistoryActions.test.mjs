import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const viewSource = read('views/NotificationHistoryView.jsx');
const apiSource = read('src/api/notifications.api.js');
const cssSource = read('src/components/platform/platform.css');

assert.ok(viewSource.includes('Mark all as read'), 'Notification history should render mark all action copy.');
assert.ok(viewSource.includes('notificationsApi.markAllAsRead()'), 'Mark all action should call notificationsApi.markAllAsRead().');
assert.ok(viewSource.includes('!loading && !error && unreadCount > 0 ? ('), 'Mark all action should render only when unreadCount > 0.');
assert.ok(apiSource.includes('markAllAsRead: () => request((http) => http.post(\'/notifications/mark-all-read\')'), 'notificationsApi should expose markAllAsRead().');
assert.ok(cssSource.includes('.notification-history__bulk-actions'), 'platform.css should define .notification-history__bulk-actions.');
assert.ok(viewSource.includes('notificationsApi.markAsRead(id)'), 'Per-item mark-as-read action should remain.');
assert.equal(viewSource.includes('style={{'), false, 'Notification history should not use inline styles.');

console.log('notificationHistoryActions.test.mjs passed');
