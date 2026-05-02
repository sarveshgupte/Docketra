import assert from 'assert';
import { isWorkspaceActive } from '../src/utils/workspaceStatus.js';

assert.equal(
  isWorkspaceActive({ status: 'ACTIVE', isActive: true }),
  true,
  'Firm login should render login form when backend returns ACTIVE with isActive=true.'
);

assert.equal(
  isWorkspaceActive({ status: 'active' }),
  true,
  'Firm login should render login form for lowercase active status.'
);

assert.equal(
  isWorkspaceActive({ status: 'Active' }),
  true,
  'Firm login should render login form for mixed-case Active status.'
);

assert.equal(
  isWorkspaceActive({ status: 'SUSPENDED' }),
  false,
  'Firm login should render inactive workspace message for suspended status.'
);

assert.equal(
  isWorkspaceActive({ status: 'ACTIVE', isActive: false }),
  false,
  'Firm login should render inactive workspace message when isActive is false.'
);

console.log('firmLoginWorkspaceStatus.test.mjs passed');
