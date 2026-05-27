import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const read = (relPath) => fs.readFileSync(path.resolve(repoRoot, relPath), 'utf8');

const workbasketsPage = read('ui/src/pages/platform/WorkbasketsPage.jsx');
const platformQueries = read('ui/src/hooks/usePlatformDataQueries.js');
const searchController = read('src/controllers/search.controller.js');

assert.ok(
  workbasketsPage.includes('usePlatformWorkbenchQuery({ workbasketId: workbasketId || undefined })'),
  'Workbasket detail pages should request the selected workbasket from the API.',
);
assert.ok(
  workbasketsPage.includes('item.ownerTeamId') && workbasketsPage.includes('rowWorkbasketIds.includes'),
  'Workbasket detail filtering should match ownerTeamId as a workbasket queue id.',
);
assert.ok(
  platformQueries.includes("queryKey: ['platform', 'workbench', options.workbasketId || 'all-workbaskets']"),
  'Workbench query cache should be scoped by selected workbasket.',
);
assert.ok(
  platformQueries.includes("worklistApi.getGlobalWorklist({ limit: 50, ...options })"),
  'Workbench query should forward workbasketId to the global worklist API.',
);
assert.ok(
  searchController.includes('req.user?.workbaskets') && searchController.includes('permittedTeamIds.add(id)'),
  'Global worklist API should authorize users through assigned workbasket membership.',
);
assert.ok(
  searchController.includes('workbasketId: c.workbasketId || c.ownerTeamId || null')
    && searchController.includes('queueId: c.workbasketId || c.ownerTeamId || null'),
  'Global worklist API should return queue ids that the workbasket UI can match.',
);
assert.ok(
  searchController.includes('workbasketName: c.ownerTeamId') && searchController.includes('queueName: c.ownerTeamId'),
  'Global worklist API should return queue names for workbasket rows.',
);

console.log('workbasketDetailQueueVisibility.test.mjs passed');
