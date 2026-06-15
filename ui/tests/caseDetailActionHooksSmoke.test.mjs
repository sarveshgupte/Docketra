import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const detailSource = read('src/pages/CaseDetailPage.jsx');
const lifecycleHook = read('src/pages/caseDetail/useDocketLifecycleActions.js');
const attachmentsHook = read('src/pages/caseDetail/useDocketAttachments.js');
const cloneHook = read('src/pages/caseDetail/useDocketClone.js');
const retryHook = read('src/pages/caseDetail/useDocketRetryQueue.js');

assert.ok(detailSource.includes('useDocketLifecycleActions'), 'Case detail should wire lifecycle actions through dedicated hook.');
assert.ok(detailSource.includes('useDocketAttachments'), 'Case detail should wire attachment actions through dedicated hook.');
assert.ok(detailSource.includes('useDocketClone'), 'Case detail should wire clone actions through dedicated hook.');
assert.ok(detailSource.includes('useDocketRetryQueue'), 'Case detail should wire offline retry queue through dedicated hook.');
assert.ok(detailSource.includes('handleResolveCase={routedTeamCannotResolve ? handleSubmitRouted : handleResolveCase}'), 'Resolve/submit behavior contract should remain wired.');

assert.ok(lifecycleHook.includes('handlePendCase'), 'Lifecycle hook should own pend action logic.');
assert.ok(lifecycleHook.includes('caseApi.pendCase(caseId, pendComment.trim(), pendingUntil)'), 'Pend action should use the dedicated pend API contract.');
assert.equal(lifecycleHook.includes("caseApi.transitionDocket(caseId, { toState:'PENDING'"), false, 'Pend action should not use the generic transition endpoint.');
assert.ok(lifecycleHook.includes('will reopen on ${formatDateTime(reopenAt)} in your WL.'), 'Pend action should include reopen timing in the success message.');
assert.ok(lifecycleHook.includes('}, 10000);'), 'Pend action should wait 10 seconds before navigating back to the worklist.');
assert.ok(lifecycleHook.includes("params.set('refresh', String(Date.now()))"), 'Pend redirect should stamp a refresh token on the return target.');
assert.ok(lifecycleHook.includes('handleUnpendCase'), 'Lifecycle hook should own unpend action logic.');
assert.equal(lifecycleHook.includes("setConfirmModal({ title:'Unpend Docket'"), false, 'Unpend action should not open a second confirmation modal.');
assert.ok(lifecycleHook.includes('handleResolveCase'), 'Lifecycle hook should own resolve action logic.');
assert.ok(lifecycleHook.includes('handleFileCase'), 'Lifecycle hook should own file action logic.');
assert.ok(lifecycleHook.includes('handleRouteToTeam'), 'Lifecycle hook should own route action logic.');
assert.ok(lifecycleHook.includes('handleSubmitRouted'), 'Lifecycle hook should own submit routed action logic.');
assert.ok(attachmentsHook.includes('handleUploadFile'), 'Attachments hook should own upload action logic.');
assert.ok(attachmentsHook.includes('handleGenerateUploadLink'), 'Attachments hook should own upload link generation logic.');
assert.ok(cloneHook.includes('handleCloneDocket'), 'Clone hook should own clone action logic.');
assert.ok(retryHook.includes('queueFailedAction'), 'Retry queue hook should own queued offline action logic.');

console.log('caseDetailActionHooksSmoke.test.mjs passed');
