import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const librarySource = read('src/pages/KnowledgeLibraryPage.jsx');
const linkedKnowledgeSource = read('src/pages/caseDetail/LinkedKnowledgeSection.jsx');
const routesSource = read('src/constants/routes.js');
const knowledgeApiSource = read('src/api/knowledgeItems.api.js');
const protectedRoutesSource = read('src/routes/ProtectedRoutes.jsx');
const packageSource = read('package.json');
const companyBrainStrategySource = read('../docs/product/COMPANY_BRAIN_STRATEGY.md');
const moduleOperatingModelSource = read('../docs/product/MODULE_OPERATING_MODEL.md');
const whatsNewSource = read('../docs/whats-new.md');

// ── KnowledgeLibraryPage reads item query param ──────────────────────────────

assert.ok(
  librarySource.includes('useSearchParams'),
  'KnowledgeLibraryPage must import useSearchParams from react-router-dom',
);

assert.ok(
  librarySource.includes("searchParams.get('item')") || librarySource.includes('searchParams.get("item")'),
  'KnowledgeLibraryPage must read the item query param from URLSearchParams',
);

// ── KnowledgeLibraryPage calls getKnowledgeItem ──────────────────────────────

assert.ok(
  librarySource.includes('knowledgeItemsApi.getKnowledgeItem'),
  'KnowledgeLibraryPage must call knowledgeItemsApi.getKnowledgeItem to fetch an item by id',
);

// ── Detail drawer / panel presence ──────────────────────────────────────────

assert.ok(
  librarySource.includes('Knowledge Item Detail'),
  'KnowledgeLibraryPage must render a "Knowledge Item Detail" drawer/panel',
);

assert.ok(
  librarySource.includes('KnowledgeItemDetailDrawer'),
  'KnowledgeLibraryPage must include the KnowledgeItemDetailDrawer component',
);

// ── Privacy / BYOS reminder in detail drawer ────────────────────────────────

assert.ok(
  librarySource.includes('BYOS') || librarySource.includes('firm-controlled storage'),
  'Detail drawer must include a BYOS/privacy reminder',
);

// ── View/Edit/Archive actions in table ──────────────────────────────────────

assert.ok(
  />\s*View\s*</.test(librarySource) || librarySource.includes("'View'") || librarySource.includes('"View"') || librarySource.includes('openDrawer'),
  'Knowledge Library table must include a View action',
);

assert.ok(
  />\s*Edit\s*</.test(librarySource) || librarySource.includes("'Edit'") || librarySource.includes('"Edit"') || librarySource.includes('openEdit'),
  'Knowledge Library table must include an Edit action',
);

assert.ok(
  />\s*Archive\s*</.test(librarySource) || librarySource.includes("'Archive'") || librarySource.includes('"Archive"') || librarySource.includes('handleArchive'),
  'Knowledge Library table must include an Archive action',
);

// ── Closing drawer removes query param ──────────────────────────────────────

assert.ok(
  librarySource.includes("next.delete('item')") || librarySource.includes('next.delete("item")'),
  'Closing the drawer must remove the item query param from the URL',
);

assert.ok(
  librarySource.includes('setSearchParams'),
  'KnowledgeLibraryPage must use setSearchParams to update the URL when opening/closing the drawer',
);

// ── Error/loading state in drawer ────────────────────────────────────────────

assert.ok(
  librarySource.includes('could not be opened') || librarySource.includes('may have been archived'),
  'Detail drawer must show a user-facing error when item cannot be loaded',
);

assert.ok(
  librarySource.includes('drawerLoading') || librarySource.includes('Loading knowledge item'),
  'Detail drawer must show a loading state while fetching the item',
);

// ── LinkedKnowledgeSection deep-links with ?item= ───────────────────────────

assert.ok(
  linkedKnowledgeSource.includes('?item='),
  'LinkedKnowledgeSection must deep-link with ?item=<knowledgeItemId>',
);

assert.ok(
  linkedKnowledgeSource.includes('goToKnowledgeItem') || linkedKnowledgeSource.includes('?item=${itemId}'),
  'LinkedKnowledgeSection must navigate to Knowledge Library with the specific item id',
);

// ── Fallback when item id is missing ────────────────────────────────────────

assert.ok(
  linkedKnowledgeSource.includes('ROUTES.KNOWLEDGE_LIBRARY(firmSlug)'),
  'LinkedKnowledgeSection must fall back to the normal Knowledge Library route when item id is missing',
);

// ── Knowledge Library route remains stable ───────────────────────────────────

assert.ok(
  routesSource.includes("KNOWLEDGE_LIBRARY: (firmSlug) => `/app/firm/${firmSlug}/knowledge`"),
  'KNOWLEDGE_LIBRARY route must remain as /app/firm/:firmSlug/knowledge',
);

// ── No new route added for item detail ───────────────────────────────────────

assert.equal(
  routesSource.includes('knowledge/:id') || routesSource.includes("knowledge/${id}"),
  false,
  'Must not add a new route for item detail — use query param approach instead',
);

// ── getKnowledgeItem API method present ──────────────────────────────────────

assert.ok(
  knowledgeApiSource.includes('getKnowledgeItem'),
  'knowledgeItems.api must expose getKnowledgeItem',
);

// ── No AI/vector/embedding infrastructure ────────────────────────────────────

for (const source of [librarySource, linkedKnowledgeSource]) {
  assert.equal(
    /import.*vector|import.*embedding|import.*openai|import.*anthropic/i.test(source),
    false,
    'No AI/vector/embedding libraries must be imported',
  );
  assert.equal(
    source.includes('document extraction'),
    false,
    'No document extraction references must be present',
  );
}

// ── No new database models ───────────────────────────────────────────────────

assert.equal(
  librarySource.includes('new Model') || librarySource.includes('mongoose.model'),
  false,
  'KnowledgeLibraryPage must not introduce new database models',
);

// ── Existing routes remain stable ────────────────────────────────────────────

const existingRoutes = [
  'COMPANY_BRAIN',
  'CRM',
  'CMS',
  'TASK_MANAGER',
  'DOCKETS',
  'CLIENTS',
  'WORKLIST',
];

for (const route of existingRoutes) {
  assert.ok(
    routesSource.includes(route),
    `Route ${route} must remain in routes.js`,
  );
}

assert.ok(
  protectedRoutesSource.includes('firmSlug'),
  'ProtectedRoutes must remain intact',
);

// ── Docs updated ─────────────────────────────────────────────────────────────

assert.ok(
  companyBrainStrategySource.includes('KnowledgeItem detail view') || companyBrainStrategySource.includes('detail view'),
  'COMPANY_BRAIN_STRATEGY.md must include a section about KnowledgeItem detail view',
);

assert.ok(
  moduleOperatingModelSource.includes('item-level detail') || moduleOperatingModelSource.includes('deep-open'),
  'MODULE_OPERATING_MODEL.md must mention item-level detail inspection',
);

assert.ok(
  whatsNewSource.includes('KnowledgeItem detail view'),
  'docs/whats-new.md must contain the "KnowledgeItem detail view" entry',
);

// ── Test script registered ────────────────────────────────────────────────────

assert.ok(
  packageSource.includes('knowledgeItemDetailView'),
  'package.json scripts must include test:knowledge-item-detail-view entry',
);

console.log('knowledgeItemDetailView.test.mjs passed');
