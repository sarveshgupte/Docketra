import fs from 'fs';
import path from 'path';
import assert from 'assert';

const filePath = path.resolve('ui/src/pages/WorkSettingsPage.jsx');
const source = fs.readFileSync(filePath, 'utf8');

assert.ok(source.includes('adminApi.createDefaultRouting()'), 'Work Settings should call explicit default routing endpoint.');
assert.ok(source.includes('Create default routing'), 'Work Settings should expose Create default routing CTA.');
console.log('workSettingsDefaultRoutingAction.test.mjs passed');
