const assert = require('assert');
const path = require('path');

const servicePath = path.join(__dirname, '..', 'src', 'services', 'task.service.js');
const repoPath = path.join(__dirname, '..', 'src', 'repositories', 'TaskRepository.js');
const narrativePath = path.join(__dirname, '..', 'src', 'services', 'taskNarrativeStorage.service.js');

delete require.cache[require.resolve(servicePath)];
delete require.cache[require.resolve(repoPath)];
delete require.cache[require.resolve(narrativePath)];

require.cache[require.resolve(repoPath)] = { exports: { findById: async () => ({ taskRef: { provider: 'google-drive', fileId: 'x' }, description: 'legacy' }) } };
require.cache[require.resolve(narrativePath)] = { exports: { readNarrative: async () => ({ narrative: { description: 'cloud value' } }) } };

const svc = require(servicePath);

(async () => {
  const task = await svc.getTaskById('f1', 't1');
  assert.strictEqual(task.description, 'cloud value');

  delete require.cache[require.resolve(servicePath)];
  require.cache[require.resolve(narrativePath)] = { exports: { readNarrative: async () => { throw new Error('nope'); } } };
  const svc2 = require(servicePath);
  const task2 = await svc2.getTaskById('f1', 't1');
  assert.strictEqual(task2.taskWarning, 'task_content_unavailable');
  console.log('task service cloud hydration tests passed');
})();
