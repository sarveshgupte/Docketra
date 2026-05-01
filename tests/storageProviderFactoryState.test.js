const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

(async function run() {
  Module._load = function(request, parent, isMain) {
    if (request === '../../models/Firm.model') {
      return {
        findById: () => ({ select: () => ({ lean: async () => ({ storage: { mode: 'firm_connected' }, storageConfig: null }) }) }),
      };
    }
    if (request === '../../utils/log') return { error: () => {}, info: () => {} };
    if (request === './providers/DocketraManagedStorageProvider') return class { constructor(){ this.providerName='docketra_managed'; } };
    return originalLoad(request, parent, isMain);
  };

  const { StorageProviderFactory } = require('../src/services/storage/StorageProviderFactory');
  let err = null;
  try { await StorageProviderFactory.getProvider('F1'); } catch (e) { err = e; }
  assert.ok(err);
  assert.strictEqual(err.code, 'STORAGE_ACCESS_ERROR');

  Module._load = originalLoad;
  console.log('✓ storage provider factory state errors');
})();
