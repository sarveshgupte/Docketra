import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const viewSource = read('views/NotificationHistoryView.jsx');
const cssSource = read('src/components/platform/platform.css');
const protectedRoutesSource = read('src/routes/ProtectedRoutes.jsx');

assert.ok(viewSource.includes('<PlatformShell'), 'NotificationHistoryView should use PlatformShell.');
assert.equal(viewSource.includes('PageHeader'), false, 'NotificationHistoryView should not import/use PageHeader.');
assert.equal(viewSource.includes('Card'), false, 'NotificationHistoryView should not import/use Card.');
assert.equal(viewSource.includes('Stack'), false, 'NotificationHistoryView should not import/use Stack.');
assert.equal(viewSource.includes('style={{'), false, 'NotificationHistoryView should not use inline styles.');
assert.ok(viewSource.includes('notificationsApi.getAllNotifications()'), 'Should keep notificationsApi.getAllNotifications().');
assert.ok(viewSource.includes('notificationsApi.markAsRead(id)'), 'Should keep notificationsApi.markAsRead().');
assert.ok(viewSource.includes('ROUTES.CASE_DETAIL(firmSlug, docketId)'), 'Should use ROUTES.CASE_DETAIL for docket navigation.');
assert.ok(viewSource.includes('ROUTES.DASHBOARD(firmSlug)'), 'Should use ROUTES.DASHBOARD for dashboard action.');

for (const className of [
  '.notification-history',
  '.notification-history__list',
  '.notification-history__item',
  '.notification-history__item--unread',
  '.notification-history__message',
  '.notification-history__meta',
  '.notification-history__actions',
  '.notification-history__pagination',
]) {
  assert.ok(cssSource.includes(className), `platform.css should define ${className}.`);
}

assert.ok(protectedRoutesSource.includes('path="notifications"'), 'Protected route for notifications should remain under firm workspace.');
assert.equal(protectedRoutesSource.includes('<Layout'), false, 'No deprecated Layout wrapper should be introduced.');

console.log('notificationHistoryPagePolish.test.mjs passed');
