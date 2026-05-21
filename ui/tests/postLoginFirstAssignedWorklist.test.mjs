import assert from 'assert';
import { getPostLoginWorkspaceDestination } from '../src/utils/postAuthNavigation.js';
const firmSlug = 'acme';

const firmUser = {
  role: 'USER',
  firmSlug,
  workbaskets: [],
  qcWorkbaskets: [],
};

assert.equal(
  getPostLoginWorkspaceDestination(firmUser, firmSlug, `/app/firm/${firmSlug}/dockets`),
  `/app/firm/${firmSlug}/dockets`,
  'safe firm deep-link should be preserved'
);

assert.equal(
  getPostLoginWorkspaceDestination(firmUser, firmSlug, 'https://evil.com'),
  `/app/firm/${firmSlug}/dashboard`,
  'unsafe external path should be rejected'
);

assert.equal(
  getPostLoginWorkspaceDestination({
    ...firmUser,
    workbaskets: [{ _id: 'wb-1' }, { id: 'wb-2' }],
  }, firmSlug),
  `/app/firm/${firmSlug}/worklist?workbasketId=wb-1`,
  'first assigned workbasket should route to scoped worklist'
);

assert.equal(
  getPostLoginWorkspaceDestination({
    ...firmUser,
    workbaskets: [{ _id: '' }, { id: '   ' }, { workbasketId: 'wb-3' }],
  }, firmSlug),
  `/app/firm/${firmSlug}/worklist?workbasketId=wb-3`,
  'blank workbasket IDs should be skipped'
);

assert.equal(
  getPostLoginWorkspaceDestination({
    role: 'MANAGER',
    firmSlug,
    workbaskets: [],
    qcWorkbaskets: [],
  }, firmSlug),
  `/app/firm/${firmSlug}/global-worklist`,
  'manager/admin with no workbasket should route to overview'
);

assert.equal(
  getPostLoginWorkspaceDestination({
    ...firmUser,
    workbaskets: [],
    qcWorkbaskets: [{ id: 'qc-1' }],
  }, firmSlug),
  `/app/firm/${firmSlug}/qc-workbaskets/qc-1`,
  'user with only qc workbasket should route to qc workbasket detail'
);

assert.equal(
  getPostLoginWorkspaceDestination(firmUser, firmSlug),
  `/app/firm/${firmSlug}/dashboard`,
  'user with no queues should route to dashboard fallback'
);

assert.equal(
  getPostLoginWorkspaceDestination({ role: 'SUPER_ADMIN', isSuperAdmin: true, firmSlug }, firmSlug, `/app/firm/${firmSlug}/dockets`),
  '',
  'superadmin should not get firm worklist routing'
);

assert.equal(
  getPostLoginWorkspaceDestination({ role: 'USER' }, '', '/app/firm/acme/worklist'),
  '',
  'user without firmSlug should not get firm worklist routing'
);

console.log('postLoginFirstAssignedWorklist.test.mjs passed');
