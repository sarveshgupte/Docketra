import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'postAuthNavigation.js'), 'utf8');

assert(source.includes('export const getPostLoginWorkspaceDestination = (user, firmSlug, intendedPath = \'\') => {'), 'Helper must be exported from postAuthNavigation.js');
assert(source.includes('if (isSafeReturnToPath(normalizedIntendedPath)) return normalizedIntendedPath;'), 'Safe deep-link must take priority.');
assert(source.includes('const assignedWorkbasketId = readFirstValidId(user?.workbaskets);'), 'Helper must read assigned firm workbaskets.');
assert(source.includes('const candidate = String(record?._id || record?.id || record?.workbasketId || \'\').trim();'), 'Helper must support _id/id/workbasketId and trim blanks.');
assert(source.includes('return `${ROUTES.WORKLIST(firmSlug)}?workbasketId=${encodeURIComponent(assignedWorkbasketId)}`;'), 'First assigned worklist destination must include encoded workbasketId query param.');
assert(source.includes("const canViewOverview = hasFirmRoleAtLeast(user, 'MANAGER');"), 'Manager/admin overview fallback must be role-based.');
assert(source.includes('return ROUTES.GLOBAL_WORKLIST(firmSlug);'), 'Overview fallback should use ROUTES constant.');
assert(source.includes('const assignedQcWorkbasketId = readFirstValidId(user?.qcWorkbaskets);'), 'QC fallback must use qcWorkbaskets assignments.');
assert(source.includes('return ROUTES.QC_WORKBASKET_DETAIL(firmSlug, assignedQcWorkbasketId);'), 'QC fallback should route to first assigned QC workbasket.');
assert(source.includes('return ROUTES.DASHBOARD(firmSlug);'), 'Final fallback should route to dashboard/default route.');

console.log('postLoginFirstAssignedWorklist.test.mjs passed');
