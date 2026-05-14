import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cardSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/Card.jsx'), 'utf8');

assert.ok(
  cardSource.includes("const isInteractive = interactive || !!onClick;"),
  'Card should only treat interactive cards (interactive prop or onClick) as interactive.',
);

assert.ok(
  cardSource.includes("role: 'button'") && cardSource.includes('tabIndex: 0'),
  'Interactive cards should expose button semantics and be keyboard focusable.',
);

assert.ok(
  cardSource.includes("event.key === 'Enter'") && cardSource.includes("event.key === ' '"),
  'Interactive cards should support Enter and Space keyboard activation.',
);

assert.ok(
  cardSource.includes('onClick={onClick}'),
  'Card should preserve mouse click behavior for interactive cards.',
);

assert.ok(
  cardSource.includes('focus-visible:ring-2') && cardSource.includes('focus-visible:ring-[var(--dt-focus)]'),
  'Interactive cards should preserve visible focus styling.',
);

console.log('cardAccessibilityContract.test.mjs passed');
