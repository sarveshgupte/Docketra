const assert = require('assert');
const path = require('path');

function mockModule(relPath, exportsValue) {
  const abs = require.resolve(path.join(__dirname, '..', relPath));
  require.cache[abs] = { id: abs, filename: abs, loaded: true, exports: exportsValue };
}

const servicePath = require.resolve('../src/services/clientProfileStorage.service');
delete require.cache[servicePath];

const calls = [];
let strictBlocked = false;

const provider = {
  providerName: 'google-drive',
  rootFolderId: 'root-byos-1',
  async getOrCreateFolder(parent, name) {
    calls.push({ type: 'folder', parent, name });
    return `${parent || 'root'}>${name}`;
  },
  async uploadFile(parent, filename, stream) {
    let body = '';
    for await (const chunk of stream) body += chunk.toString();
    calls.push({ type: 'upload', parent, filename, body });
    return { fileId: 'file-1' };
  },
  async downloadFile() {
    return require('stream').Readable.from(JSON.stringify({ factSheet: { description: 'from-cloud' } }));
  },
};

mockModule('src/services/storage/StorageProviderFactory.js', {
  StorageProviderFactory: {
    getProvider: async () => provider,
  },
});

mockModule('src/services/strictStoragePolicy.service.js', {
  requireWritableBusinessStorage: async () => {
    if (strictBlocked) {
      const err = new Error('strict blocked');
      err.code = 'STRICT_STORAGE_BYOS_REQUIRED';
      throw err;
    }
  },
});

const { clientProfileStorageService } = require('../src/services/clientProfileStorage.service');

(async () => {
  const client = {
    clientId: 'C000001',
    firmId: 'f1',
    clientFactSheet: { description: 'legacy' },
    saveCalls: 0,
    async save() { this.saveCalls += 1; },
  };

  const out = await clientProfileStorageService.updateClientFactSheet({
    firmId: 'f1',
    client,
    actorXID: 'U1',
    factSheet: { description: 'hello', notes: 'n' },
  });

  assert.strictEqual(out.description, 'hello');
  assert.strictEqual(client.cfsStorageMode, 'cloud_first');
  assert.strictEqual(client.cfsRef.objectKey, 'firms/f1/clients/C000001/cfs/cfs.json');
  assert.strictEqual(client.clientFactSheet.description, 'legacy');
  const upload = calls.find((c) => c.type === 'upload');
  assert.ok(upload);
  assert.strictEqual(upload.filename, 'cfs.json');
  assert.ok(upload.parent.includes('clients>C000001>cfs'));
  assert.ok(upload.body.includes('"description":"hello"'));
  assert.ok(!upload.body.includes('refreshToken'));

  const rootFirstCall = calls.find((c) => c.type === 'folder');
  assert.deepStrictEqual(rootFirstCall, { type: 'folder', parent: 'root-byos-1', name: 'firms' });

  const hydrated = await clientProfileStorageService.getClientFactSheet({ firmId: 'f1', client });
  assert.strictEqual(hydrated.factSheet.description, 'from-cloud');
  assert.strictEqual(hydrated.cfsStorageMode, 'cloud_first');

  const badClient = {
    clientId: 'C2',
    cfsRef: { provider: 'google-drive', mode: 'firm_connected', fileId: 'bad' },
    cfsStorageMode: 'cloud_first',
  };
  provider.downloadFile = async () => { throw new Error('read failed'); };
  const failed = await clientProfileStorageService.getClientFactSheet({ firmId: 'f1', client: badClient });
  assert.strictEqual(failed.cfsWarning, 'client_cfs_unavailable');

  strictBlocked = true;
  let blocked = false;
  try {
    await clientProfileStorageService.updateClientFactSheet({ firmId: 'f1', client, actorXID: 'U1', factSheet: { description: 'x' } });
  } catch (e) {
    blocked = e.code === 'STRICT_STORAGE_BYOS_REQUIRED';
  }
  assert.ok(blocked, 'strict mode should block CFS write');

  console.log('clientFactSheet.cloudFirstStorage.test.js passed');
})();
