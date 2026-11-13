import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const fileContent = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/docket/McaPreFilingValidationGrid.jsx'),
  'utf8'
);

// 1. Export verification
assert.ok(
  fileContent.includes('export const McaPreFilingValidationGrid'),
  'Component should export McaPreFilingValidationGrid'
);

// 2. Accessibility (a11y) & Semantic Structure
assert.ok(
  fileContent.includes('role="tablist"'),
  'Navigation should declare role="tablist" for form switching'
);
assert.ok(
  fileContent.includes('role="tab"'),
  'Tabs should declare role="tab"'
);
assert.ok(
  fileContent.includes('aria-selected='),
  'Tabs should declare aria-selected attribute'
);
assert.ok(
  fileContent.includes('aria-label="Export MCA V3 Upload Package"'),
  'Export action button must include an explicit aria-label'
);
assert.ok(
  fileContent.includes('aria-label="MCA Pre-Filing Validation and Audit Grid"'),
  'Main container must have an accessible landmark label'
);

// 3. Tabular numbers & Schedule III formatting
assert.ok(
  fileContent.includes('tabular-nums'),
  'Financial numbers must use tabular-nums for aligned visual comparison'
);
assert.ok(
  fileContent.includes('Equity and Liabilities (Schedule III)'),
  'Must include Schedule III Equity & Liabilities heading'
);
assert.ok(
  fileContent.includes('Assets (Schedule III)'),
  'Must include Schedule III Assets heading'
);

// 4. Form Coverage
assert.ok(
  fileContent.includes('Form AOC-4 (Financial Statements)'),
  'Must support AOC-4 tab'
);
assert.ok(
  fileContent.includes('Form MGT-7 / 7A (Annual Return)'),
  'Must support MGT-7 tab'
);

// 5. Diagnostics & Attachments Checklist
assert.ok(
  fileContent.includes('Validation Diagnostics'),
  'Must render diagnostic alerts section'
);
assert.ok(
  fileContent.includes('Mandatory Attachments Checklist'),
  'Must render mandatory attachments checklist'
);
assert.ok(
  fileContent.includes('BALANCE_SHEET') && fileContent.includes('AUDIT_REPORT') && fileContent.includes('BOARD_REPORT'),
  'Checklist must include key statutory attachments'
);

console.log('mcaPreFilingValidationGrid.test.mjs passed successfully!');
