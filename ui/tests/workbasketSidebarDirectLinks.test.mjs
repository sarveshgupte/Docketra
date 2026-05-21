import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

const routesSource = readSrc('src/constants/routes.js');
const navSource = readSrc('src/constants/platformNavigation.js');
const shellSource = readSrc('src/components/platform/PlatformShell.jsx');

assert.match(routesSource, /WORKBASKET_DETAIL:/);
assert.match(routesSource, /QC_WORKBASKET_DETAIL:/);
assert.match(navSource, /label:\s*'Workbaskets'/, 'Daily Operations should include Workbaskets group label');
assert.match(navSource, /label:\s*'Worklists'/, 'Daily Operations should include Worklists group label');
assert.match(navSource, /label:\s*'QC Worklists'/, 'Daily Operations should include QC Worklists group label when eligible');
assert.match(navSource, /ROUTES\.WORKBASKET_DETAIL\(/, 'Workbaskets children should use direct workbasket routes');
assert.match(navSource, /workbasketId=/, 'Worklists children should use workbasket scoped query parameter');
assert.match(navSource, /ROUTES\.QC_WORKBASKET_DETAIL\(/, 'QC children should use direct QC workbasket routes');
assert.doesNotMatch(navSource, /\.slice\(0,\s*4\)/, 'Navigation should not cap assigned queues.');
console.log('workbasketSidebarDirectLinks.test.mjs passed');
