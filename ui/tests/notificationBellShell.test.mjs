import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const shellSource = read('src/components/platform/PlatformShell.jsx');
const bellSource = read('src/components/platform/NotificationBell.jsx');
const routesSource = read('src/constants/routes.js');
const protectedRoutesSource = read('src/routes/ProtectedRoutes.jsx');
const cssSource = read('src/components/platform/platform.css');

assert.ok(shellSource.includes("import { NotificationBell } from './NotificationBell';"), 'PlatformShell should import NotificationBell.');
assert.ok(shellSource.includes('<NotificationBell />'), 'PlatformShell should render NotificationBell in action rail.');

assert.ok(bellSource.includes('notificationsApi.getAllNotifications()'), 'Bell should use notificationsApi.getAllNotifications.');
assert.ok(bellSource.includes('item?.read === false || item?.isRead === false'), 'Bell unread logic should support read/isRead flags.');
assert.ok(bellSource.includes("unreadCount > 99 ? '99+' : String(unreadCount)"), 'Bell badge should cap at 99+.');
assert.ok(bellSource.includes("unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'"), 'Bell aria label should include count when unread exists.');
assert.ok(bellSource.includes('unreadCount > 0 ? <span className="platform__notification-badge"'), 'Bell badge should be hidden at zero unread.');
assert.ok(bellSource.includes('catch {'), 'Bell fetch failures should be handled silently.');
assert.ok(bellSource.includes('navigate(ROUTES.NOTIFICATIONS(firmSlug));'), 'Bell click should navigate to notifications route.');

assert.ok(routesSource.includes('NOTIFICATIONS: (firmSlug) => `/app/firm/${firmSlug}/notifications`'), 'Routes should include canonical notifications path.');
assert.ok(protectedRoutesSource.includes('path="notifications"'), 'Notifications history route should remain under firm workspace protected routes.');
assert.equal(protectedRoutesSource.includes('<Layout'), false, 'No deprecated Layout wrapper should be introduced in protected notifications route.');

for (const className of ['.platform__notification-bell', '.platform__notification-badge']) {
  assert.ok(cssSource.includes(className), `Platform shell CSS should define ${className}.`);
}

console.log('notificationBellShell.test.mjs passed');
