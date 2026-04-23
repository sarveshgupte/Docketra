import assert from 'node:assert/strict';
import { createCorrelationId, shouldEmitWarning } from '../src/utils/workflowDiagnostics.js';

const corr = createCorrelationId('upload_intent');
assert.ok(corr.startsWith('upload_intent-'));

assert.equal(shouldEmitWarning('dup:a'), true);
assert.equal(shouldEmitWarning('dup:a'), false);

console.log('ui workflow diagnostics tests passed');
