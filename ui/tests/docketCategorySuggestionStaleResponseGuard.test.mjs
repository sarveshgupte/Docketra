import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/docket/GuidedDocketForm.jsx'), 'utf8');

assert.ok(source.includes('const latestSuggestionRequestRef = useRef(0);'), 'should track latest suggestion request id');
assert.ok(source.includes('const requestId = latestSuggestionRequestRef.current + 1;'), 'should increment request id per debounced run');
assert.ok(source.includes('if (requestId !== latestSuggestionRequestRef.current) return;'), 'should ignore stale successful responses');
assert.ok(source.includes('if (requestId === latestSuggestionRequestRef.current) setSuggestion(null);'), 'should guard stale error/clear states');

console.log('docketCategorySuggestionStaleResponseGuard.test.mjs passed');
