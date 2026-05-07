#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';

const source = fs.readFileSync(new URL('../components/RequestDocumentsModal.jsx', import.meta.url), 'utf8');

assert(source.includes('try {\n      await navigator.clipboard.writeText(generatedLink.link);'), 'Clipboard copy should be handled in a try block.');
assert(source.includes('clearTimeout(copyFeedbackTimeoutRef.current);'), 'Existing clipboard timers should be cleared before creating a new one.');
assert(source.includes('useEffect(() => () => {'), 'Cleanup effect should exist to avoid setState after unmount.');
assert(source.includes('role="status" aria-live="polite"'), 'A dedicated polite live status region should be rendered.');

console.log('requestDocumentsModalClipboardFeedback.test.mjs passed');
