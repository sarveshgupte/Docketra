const assert = require('assert');
const path = require('path');
const { Readable } = require('stream');

function mockModule(relPath, exportsValue) {
  const abs = require.resolve(path.join(__dirname, '..', relPath));
  require.cache[abs] = { id: abs, filename: abs, loaded: true, exports: exportsValue };
}

const servicePath = require.resolve('../src/services/commentHistoryNarrativeStorage.service');
delete require.cache[servicePath];

let strictBlocked = false;
const calls = [];

const provider = {
  providerName: 'google-drive',
  rootFolderId: 'root-byos-1',
  async getOrCreateFolder(parent, name) { calls.push({ type: 'folder', parent, name }); return `${parent || 'root'}>${name}`; },
  async uploadFile(parent, filename, stream) {
    let body = '';
    for await (const chunk of stream) body += chunk.toString();
    calls.push({ type: 'upload', parent, filename, body });
    return { fileId: `${filename}-id` };
  },
  async downloadFile(fileId) {
    if (fileId === 'bad') throw new Error('read failed');
    return Readable.from(JSON.stringify(fileId.includes('comment') ? { text: 'cloud comment' } : { description: 'cloud history' }));
  },
};

mockModule('src/services/storage/StorageProviderFactory.js', { StorageProviderFactory: { getProvider: async () => provider } });
mockModule('src/services/strictStoragePolicy.service.js', { requireWritableBusinessStorage: async () => { if (strictBlocked) { const e = new Error('blocked'); e.code = 'STRICT_STORAGE_BYOS_REQUIRED'; throw e; } } });

const svc = require('../src/services/commentHistoryNarrativeStorage.service');

(async () => {
  const cRef = await svc.uploadComment({ firmId: 'f1', docketId: 'D1', commentId: 'C1', payload: { text: 'hello' } });
  assert.strictEqual(cRef.objectKey, 'firms/f1/dockets/D1/comments/C1.json');

  const hRef = await svc.uploadHistory({ firmId: 'f1', docketId: 'D1', historyId: 'H1', payload: { description: 'moved' } });
  assert.strictEqual(hRef.objectKey, 'firms/f1/dockets/D1/history/H1.json');

  const cHydrated = await svc.readJsonByRef({ firmId: 'f1', ref: { provider: 'google-drive', mode: 'firm_connected', fileId: 'comment-file' } });
  assert.strictEqual(cHydrated.text, 'cloud comment');
  const hHydrated = await svc.readJsonByRef({ firmId: 'f1', ref: { provider: 'google-drive', mode: 'firm_connected', fileId: 'history-file' } });
  assert.strictEqual(hHydrated.description, 'cloud history');

  let readFailed = false;
  try { await svc.readJsonByRef({ firmId: 'f1', ref: { provider: 'google-drive', mode: 'firm_connected', fileId: 'bad' } }); } catch (_e) { readFailed = true; }
  assert.ok(readFailed, 'cloud read failures should surface for caller warning handling');

  strictBlocked = true;
  let blocked = false;
  try { await svc.uploadComment({ firmId: 'f1', docketId: 'D1', commentId: 'C2', payload: { text: 'x' } }); } catch (e) { blocked = e.code === 'STRICT_STORAGE_BYOS_REQUIRED'; }
  assert.ok(blocked, 'strict mode should block writes when storage unavailable');

  console.log('commentHistory.cloudFirstStorage.test.js passed');
})();
