import assert from 'assert';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'ui/src/pages/caseDetail/caseDetailUtils.js'), 'utf8');
assert.ok(source.includes('docketDetail'), 'normalizeCase should consider docketDetail DTO first.');
assert.ok(source.includes('caseId: detail.docketId || legacy.caseId'), 'normalizeCase should prefer DTO docketId then fallback to legacy caseId.');
assert.ok(source.includes('status: detail.statusLabel || legacy.status'), 'normalizeCase should prefer DTO statusLabel then fallback to legacy status.');
assert.ok(source.includes('businessName: detail.client.name || legacy?.client?.businessName'), 'normalizeCase should map DTO client name with fallback.');
console.log('caseDetailDtoNormalization.test.mjs passed');
