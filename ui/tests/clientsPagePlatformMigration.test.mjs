import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'ui', 'src', 'pages', 'ClientsPage.jsx'), 'utf8');
const whatsNew = fs.readFileSync(path.join(process.cwd(), 'docs', 'whats-new.md'), 'utf8');

assert(!source.includes('style={{'), 'ClientsPage should not use inline style props.');
assert(source.includes('className="client-fact-sheet-grid"'), 'CFS modal should use class-based grid wrapper.');
assert(source.includes('className="client-fact-sheet-section"'), 'CFS modal should use class-based sections.');
assert(source.includes('client-fact-sheet-dropzone'), 'CFS modal should use class-based dropzone spacing.');
assert(source.includes('className="client-fact-sheet-upload-status"'), 'CFS modal should use class-based upload status text.');
assert(source.includes('className="client-fact-sheet-actions"'), 'CFS modal should use class-based action column alignment.');
assert(source.includes('className="admin__actions clients-table-actions"'), 'Client table actions should use compact grouped action layout.');
assert(source.includes('className="client-modal-actions"'), 'Create/edit client modal should keep sticky action class.');
assert(source.includes('<PageSection>'), 'Clients page should use PageSection primitive.');
assert(source.includes('<SectionToolbar>'), 'Clients page should use SectionToolbar primitive.');
assert(source.includes('<FilterBar>'), 'Clients page should use FilterBar primitive.');
assert(source.includes('<StatusMessageStack'), 'Clients page should use StatusMessageStack primitive.');
assert(!source.includes('<Loading message="Loading clients..." /> : loadError ? (\n          <div className="p-8">'), 'Load/error surfaces should not be duplicated wrappers.');
assert(!source.includes('className="flex items-center gap-2"'), 'Clients page should avoid utility layout wrapper in shell actions.');
assert(!source.includes('className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600"'), 'Clients page should avoid utility layout wrapper in pagination footer.');
assert(!source.includes('rounded-md border px-3 py-2 text-sm'), 'Clients modal message should use class-based styling instead of utility block.');
assert(whatsNew.includes("## 2026-05-20 — Polished Clients workspace page"), 'What’s New should include dated latest Clients entry.');
assert(
  whatsNew.indexOf("## 2026-05-20 — Polished Clients workspace page") < whatsNew.indexOf("## 2026-05-19 — Added related employee/user context for dockets"),
  'What’s New Clients entry should be in the latest/top section.',
);

console.log('clientsPagePlatformMigration.test.mjs passed');
