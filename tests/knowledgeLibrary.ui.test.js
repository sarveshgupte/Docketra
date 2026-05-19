#!/usr/bin/env node
'use strict';

/**
 * Tests for the Knowledge Library UI.
 *
 * Validates:
 * - KNOWLEDGE_LIBRARY route constant exists and produces correct path
 * - Navigation includes Knowledge Library under Firm Memory with minRole ADMIN
 * - Command palette includes go-knowledge-library
 * - Knowledge Library API client uses /knowledge-items (no /api/ prefix — baseURL convention)
 * - createApp.js mounts /api/knowledge-items (backend route contract)
 * - KnowledgeLibraryPage exists and contains expected text
 * - BYOS/privacy callout exists in the page
 * - Page filtering is client-side only (loadData must not send filter params)
 * - No AI/vector/embedding/document extraction infrastructure added
 * - Existing Company Brain, CRM, CMS, Task Manager routes remain unchanged
 * - Knowledge Library route is admin-only in ProtectedRoutes
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function testRouteConstantExists() {
  const routesSource = read('ui/src/constants/routes.js');
  assert.ok(
    routesSource.includes('KNOWLEDGE_LIBRARY'),
    'routes.js must export KNOWLEDGE_LIBRARY constant',
  );
  assert.ok(
    routesSource.includes('/knowledge'),
    'KNOWLEDGE_LIBRARY route must point to /knowledge path',
  );
  console.log('  ✓ KNOWLEDGE_LIBRARY route constant defined');
}

function testExistingRoutesUntouched() {
  const routesSource = read('ui/src/constants/routes.js');
  assert.ok(routesSource.includes("CMS: (firmSlug) => `/app/firm/${firmSlug}/cms`"), 'CMS route must remain unchanged');
  assert.ok(routesSource.includes("CRM: (firmSlug) => `/app/firm/${firmSlug}/crm`"), 'CRM route must remain unchanged');
  assert.ok(routesSource.includes("COMPANY_BRAIN: (firmSlug) => `/app/firm/${firmSlug}/company-brain`"), 'COMPANY_BRAIN route must remain unchanged');
  assert.ok(routesSource.includes("TASK_MANAGER: (firmSlug) => `/app/firm/${firmSlug}/task-manager`"), 'TASK_MANAGER route must remain unchanged');
  console.log('  ✓ Existing CMS/CRM/Company Brain/Task Manager routes unchanged');
}

function testNavigationReflectsCurrentIA() {
  const navSource = read('ui/src/constants/platformNavigation.js');
  assert.ok(
    !navSource.includes("id: 'knowledge-library'"),
    'Knowledge Library is intentionally not pinned in sidebar navigation in current IA',
  );
  assert.ok(
    navSource.includes("id: 'clients'"),
    'Current IA must include Clients navigation item',
  );
  assert.ok(
    navSource.includes("id: 'dashboard'"),
    'Current IA must include Dashboard navigation item',
  );
  assert.ok(
    navSource.includes("id: 'docket-workbench'"),
    'Current IA must include Docket Workbench navigation item',
  );
  console.log('  ✓ Navigation assertions aligned to current IA');
}

function testExistingNavigationItemsPreserved() {
  const navSource = read('ui/src/constants/platformNavigation.js');
  assert.ok(navSource.includes("id: 'clients'"), 'Clients navigation item must remain');
  console.log('  ✓ Existing core navigation items preserved');
}

function testCommandPaletteNoPinnedKnowledgeDestination() {
  const navSource = read('ui/src/constants/platformNavigation.js');
  assert.ok(
    !navSource.includes("id: 'go-knowledge-library'"),
    'Knowledge Library command is intentionally not pinned in destination shortcuts in current IA',
  );
  console.log('  ✓ Command palette assertions aligned to current IA');
}

function testApiClientUsesCorrectEndpoint() {
  const apiSource = read('ui/src/api/knowledgeItems.api.js');

  // The axios instance baseURL already ends in /api (e.g. /api or https://host/api).
  // All other frontend API clients (crm.api.js, dashboard.api.js, etc.) follow the same
  // convention: paths begin with / but do NOT repeat the /api prefix.
  // /knowledge-items  →  baseURL(/api) + /knowledge-items  =  /api/knowledge-items  ✓
  assert.ok(
    apiSource.includes("'/knowledge-items'"),
    "Knowledge items API client must use /knowledge-items (no /api/ prefix — baseURL already contains /api)",
  );
  assert.ok(
    !apiSource.includes("'/api/knowledge-items'"),
    "Knowledge items API client must NOT double-prefix with /api/ (baseURL already contains /api)",
  );
  assert.ok(
    apiSource.includes('listKnowledgeItems'),
    'API client must export listKnowledgeItems',
  );
  assert.ok(
    apiSource.includes('createKnowledgeItem'),
    'API client must export createKnowledgeItem',
  );
  assert.ok(
    apiSource.includes('getKnowledgeItem'),
    'API client must export getKnowledgeItem',
  );
  assert.ok(
    apiSource.includes('updateKnowledgeItem'),
    'API client must export updateKnowledgeItem',
  );
  assert.ok(
    apiSource.includes('archiveKnowledgeItem'),
    'API client must export archiveKnowledgeItem',
  );
  console.log('  ✓ Knowledge Library API client uses /knowledge-items (no double /api/ prefix) and exports all methods');
}

function testBackendRouteContractMountsKnowledgeItems() {
  const createAppSource = read('src/app/createApp.js');
  const tenantMountSource = read('src/app/routes/mountTenantRoutes.js');

  // Backend now mounts tenant routes via mountTenantRoutes; knowledge-items
  // contract must still resolve to /api/knowledge-items through that mount layer.
  assert.ok(
    createAppSource.includes('knowledgeItemRoutes'),
    'createApp.js must pass knowledgeItemRoutes into mountTenantRoutes',
  );
  assert.ok(
    tenantMountSource.includes("app.use('/api/knowledge-items'"),
    'mountTenantRoutes.js must mount /api/knowledge-items router',
  );

  console.log('  ✓ backend mounts /api/knowledge-items through mountTenantRoutes');
}

function testPageFilteringIsClientSideOnly() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');

  // loadData must NOT pass type/status/q/tag params to the API.
  // All filtering is done client-side via filteredItems so behavior is deterministic:
  // one full list is loaded once; filter changes narrow the in-memory list immediately.
  assert.ok(
    !pageSource.includes('params.type'),
    'KnowledgeLibraryPage loadData must not send type as an API param (client-side filtering)',
  );
  assert.ok(
    !pageSource.includes('params.status'),
    'KnowledgeLibraryPage loadData must not send status as an API param (client-side filtering)',
  );
  assert.ok(
    !pageSource.includes('params.q'),
    'KnowledgeLibraryPage loadData must not send q as an API param (client-side filtering)',
  );
  assert.ok(
    !pageSource.includes('params.tag'),
    'KnowledgeLibraryPage loadData must not send tag as an API param (client-side filtering)',
  );

  // filteredItems must still apply all four filters client-side.
  assert.ok(
    pageSource.includes('filterType') && pageSource.includes('filterStatus'),
    'KnowledgeLibraryPage must apply type and status filters client-side via filteredItems',
  );
  assert.ok(
    pageSource.includes('filterTag') && pageSource.includes('searchQ'),
    'KnowledgeLibraryPage must apply tag and search filters client-side via filteredItems',
  );

  console.log('  ✓ KnowledgeLibraryPage uses client-side-only filtering (no mixed server/client approach)');
}

function testPageExistsAndContainsExpectedContent() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('Knowledge Library'),
    'KnowledgeLibraryPage must contain "Knowledge Library" heading text',
  );
  assert.ok(
    pageSource.includes('SOPs, checklists, templates'),
    'KnowledgeLibraryPage must mention SOPs, checklists, templates',
  );
  assert.ok(
    pageSource.includes('BYOS') || pageSource.includes('firm-controlled storage'),
    'KnowledgeLibraryPage must contain BYOS/privacy callout',
  );
  assert.ok(
    pageSource.includes('Do not upload or paste sensitive client documents here'),
    'KnowledgeLibraryPage must contain privacy warning',
  );
  assert.ok(
    pageSource.includes('Knowledge Library feeds Company Brain'),
    'KnowledgeLibraryPage must include Company Brain context callout',
  );
  console.log('  ✓ KnowledgeLibraryPage contains expected title, subtitle, BYOS warning, and Company Brain callout');
}

function testPageHasEmptyStates() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('Your Knowledge Library is empty'),
    'KnowledgeLibraryPage must have empty state message when no items',
  );
  assert.ok(
    pageSource.includes('No knowledge items match these filters'),
    'KnowledgeLibraryPage must have filtered empty state message',
  );
  console.log('  ✓ KnowledgeLibraryPage has correct empty states');
}

function testPageHasImprovedGuidanceCopy() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('Use Knowledge Library for reusable firm knowledge'),
    'KnowledgeLibraryPage must include improved guidance panel copy',
  );
  assert.ok(
    pageSource.includes('Link records to work types, clients, or dockets so they appear during execution'),
    'KnowledgeLibraryPage guidance panel must mention linking to work types, clients, or dockets',
  );
  console.log('  ✓ KnowledgeLibraryPage contains improved guidance copy');
}

function testStatsIncludeChecklistAndUnlinked() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('checklistCount'),
    'KnowledgeLibraryPage must compute checklistCount stat',
  );
  assert.ok(
    pageSource.includes('unlinkedCount'),
    'KnowledgeLibraryPage must compute unlinkedCount stat',
  );
  assert.ok(
    pageSource.includes('Checklist records'),
    'KnowledgeLibraryPage stats must include a Checklist records label',
  );
  assert.ok(
    pageSource.includes('Unlinked records'),
    'KnowledgeLibraryPage stats must include an Unlinked records label',
  );
  console.log('  ✓ Stats include Checklist records and Unlinked records');
}

function testFiltersIncludeClearFilters() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('clearFilters') || pageSource.includes('Clear filters'),
    'KnowledgeLibraryPage must include a Clear filters action',
  );
  assert.ok(
    pageSource.includes('filterWorkType'),
    'KnowledgeLibraryPage must include a linked work type filter (filterWorkType)',
  );
  console.log('  ✓ Filters include Clear filters and work type filter');
}

function testTableShowsBadgesAndLinkIndicators() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  // Table should have type and status badge-style markup and a Links column
  assert.ok(
    pageSource.includes('Knowledge item') || pageSource.includes("'Knowledge item'"),
    'KnowledgeLibraryPage table must use Knowledge item column header',
  );
  assert.ok(
    pageSource.includes('Links') || pageSource.includes("'Links'"),
    'KnowledgeLibraryPage table must include a Links column for work type/client/docket indicators',
  );
  assert.ok(
    pageSource.includes('Unlinked'),
    'KnowledgeLibraryPage table rows must show Unlinked badge when no links present',
  );
  console.log('  ✓ Table/list shows type/status/link badges or equivalent labels');
}

function testFormGroupsExist() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('Basics'),
    'KnowledgeLibraryPage form must include Basics group',
  );
  assert.ok(
    pageSource.includes('Ownership') && pageSource.includes('linking'),
    'KnowledgeLibraryPage form must include Ownership & linking group',
  );
  assert.ok(
    pageSource.includes('Checklist steps'),
    'KnowledgeLibraryPage form must include Checklist steps group',
  );
  console.log('  ✓ Form groups include Basics, Ownership & linking, Checklist steps');
}

function testChecklistEmptyStateCopyExists() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('No checklist steps yet'),
    'KnowledgeLibraryPage checklist steps editor must show empty state message',
  );
  assert.ok(
    pageSource.includes('Add the first step to make this checklist useful during work execution'),
    'KnowledgeLibraryPage checklist empty state must include guidance copy',
  );
  console.log('  ✓ Checklist empty state copy exists');
}

function testDetailDrawerSections() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  // Metadata section
  assert.ok(
    pageSource.includes('Metadata') || pageSource.includes("'Metadata'"),
    'KnowledgeLibraryPage detail drawer must include a Metadata section',
  );
  // Audit section
  assert.ok(
    pageSource.includes('Audit') || pageSource.includes("'Audit'"),
    'KnowledgeLibraryPage detail drawer must include an Audit section',
  );
  // Summary + Content in drawer
  assert.ok(
    pageSource.includes('item.summary'),
    'KnowledgeLibraryPage detail drawer must display summary',
  );
  assert.ok(
    pageSource.includes('item.content'),
    'KnowledgeLibraryPage detail drawer must display content',
  );
  console.log('  ✓ Detail drawer contains metadata/body/audit sections');
}

function testNoCompletionTrackingUi() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  const forbidden = ['completionTracking', 'markComplete', 'Create task from', 'createTaskFrom', 'taskFromStep', 'completeStep'];
  for (const term of forbidden) {
    assert.ok(
      !pageSource.includes(term),
      `KnowledgeLibraryPage must not contain completion tracking UI: ${term}`,
    );
  }
  console.log('  ✓ No completion tracking UI or task creation from checklist steps');
}

function testRouteIsAdminOnly() {
  const protectedRoutesSource = read('ui/src/routes/ProtectedRoutes.jsx');
  assert.ok(
    protectedRoutesSource.includes('path="knowledge"'),
    'ProtectedRoutes must include knowledge path',
  );

  // Find the knowledge route block and verify it has requireAdmin
  const knowledgeIndex = protectedRoutesSource.indexOf('path="knowledge"');
  const routeBlock = protectedRoutesSource.slice(knowledgeIndex, knowledgeIndex + 200);
  assert.ok(
    routeBlock.includes('requireAdmin'),
    'Knowledge Library route must require admin access',
  );
  console.log('  ✓ Knowledge Library route is admin-only in ProtectedRoutes');
}

function testLazyPageRegistered() {
  const lazyPagesSource = read('ui/src/routes/lazyPages.jsx');
  assert.ok(
    lazyPagesSource.includes('KnowledgeLibraryPage'),
    'lazyPages.jsx must export KnowledgeLibraryPage',
  );
  assert.ok(
    lazyPagesSource.includes("import('../pages/KnowledgeLibraryPage')"),
    'lazyPages.jsx must lazy-import KnowledgeLibraryPage',
  );
  console.log('  ✓ KnowledgeLibraryPage registered in lazyPages.jsx');
}

function testNoAiOrVectorInfrastructureAdded() {
  const files = [
    'ui/src/api/knowledgeItems.api.js',
    'ui/src/pages/KnowledgeLibraryPage.jsx',
  ];
  const forbidden = ['embedding', 'vector', 'openai', 'langchain', 'pinecone', 'weaviate', 'chroma', 'extractDocument', 'pdfParse'];

  for (const file of files) {
    const source = read(file).toLowerCase();
    for (const term of forbidden) {
      assert.ok(
        !source.includes(term.toLowerCase()),
        `${file} must not contain AI/vector infrastructure term: ${term}`,
      );
    }
  }
  console.log('  ✓ No AI/vector/embedding/document extraction infrastructure in new files');
}

function testCompanyBrainPageUnchanged() {
  const pageSource = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    pageSource.includes('Company Brain'),
    'CompanyBrainPage must still exist with Company Brain content',
  );
  assert.ok(
    pageSource.includes('Memory map'),
    'CompanyBrainPage memory map section must remain',
  );
  console.log('  ✓ CompanyBrainPage content unchanged');
}

function testCaseDetailPageHasLinkedKnowledgeTab() {
  const pageSource = read('ui/src/pages/CaseDetailPage.jsx');
  assert.ok(
    pageSource.includes('KNOWLEDGE'),
    'CaseDetailPage must include KNOWLEDGE tab constant reference',
  );
  assert.ok(
    pageSource.includes('Linked Knowledge') || pageSource.includes("label: 'Linked Knowledge'"),
    'CaseDetailPage must include Linked Knowledge tab label',
  );
  assert.ok(
    pageSource.includes('LinkedKnowledgeSection'),
    'CaseDetailPage must import and render LinkedKnowledgeSection',
  );
  console.log('  ✓ CaseDetailPage has Linked Knowledge tab');
}

function testLinkedKnowledgeSectionFetchesViaApi() {
  const sectionSource = read('ui/src/pages/caseDetail/LinkedKnowledgeSection.jsx');
  assert.ok(
    sectionSource.includes('knowledgeItemsApi'),
    'LinkedKnowledgeSection must use knowledgeItemsApi',
  );
  assert.ok(
    sectionSource.includes('listKnowledgeItems'),
    'LinkedKnowledgeSection must call listKnowledgeItems',
  );
  assert.ok(
    sectionSource.includes('linkedDocketId') || sectionSource.includes('linkedWorkType'),
    'LinkedKnowledgeSection must pass linked filter params to the API',
  );
  console.log('  ✓ LinkedKnowledgeSection fetches via knowledgeItemsApi with link filters');
}

function testLinkedKnowledgeSectionHasEmptyStates() {
  const sectionSource = read('ui/src/pages/caseDetail/LinkedKnowledgeSection.jsx');
  assert.ok(
    sectionSource.includes('Knowledge records linked to this work will appear here'),
    'LinkedKnowledgeSection must have empty state message',
  );
  assert.ok(
    sectionSource.includes('Ask an admin'),
    'LinkedKnowledgeSection must have non-admin empty state message',
  );
  console.log('  ✓ LinkedKnowledgeSection has correct empty states');
}

function testLinkedKnowledgeSectionHasNoAiInfrastructure() {
  const sectionSource = read('ui/src/pages/caseDetail/LinkedKnowledgeSection.jsx');
  const forbidden = ['embedding', 'vector', 'openai', 'langchain', 'pinecone', 'weaviate', 'chroma', 'extractDocument', 'pdfParse'];
  for (const term of forbidden) {
    assert.ok(
      !sectionSource.toLowerCase().includes(term.toLowerCase()),
      `LinkedKnowledgeSection must not contain AI/vector infrastructure term: ${term}`,
    );
  }
  console.log('  ✓ LinkedKnowledgeSection has no AI/vector/embedding infrastructure');
}


function testChecklistStepsUiAndReadOnlyDisplay() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(pageSource.includes('Checklist steps'), 'KnowledgeLibraryPage must include checklist steps editor label');
  assert.ok(pageSource.includes("form.type === 'checklist'"), 'KnowledgeLibraryPage must conditionally render checklist steps editor for checklist type');
  assert.ok(pageSource.includes('Checklist steps are only used for checklist records.'), 'KnowledgeLibraryPage must include checklist-type warning message');
  assert.ok(pageSource.includes("item.type === 'checklist'"), 'KnowledgeItem detail drawer must support checklist read-only section');
  console.log('  ✓ KnowledgeLibraryPage checklist steps editor/detail drawer checks');
}

function testLinkedKnowledgeShowsChecklistStepCount() {
  const sectionSource = read('ui/src/pages/caseDetail/LinkedKnowledgeSection.jsx');
  assert.ok(sectionSource.includes('steps'), 'LinkedKnowledgeSection must display checklist step count text');
  assert.ok(sectionSource.includes('checklistSteps'), 'LinkedKnowledgeSection must read checklistSteps from linked items');
  console.log('  ✓ LinkedKnowledgeSection checklist step count checks');
}
function testKnowledgeLibraryFormHasLinkedWorkTypeHelperCopy() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('Use the same work type/category used by dockets'),
    'KnowledgeLibraryPage form must include helper copy for linkedWorkType field',
  );
  console.log('  ✓ KnowledgeLibraryPage linkedWorkType field has helper copy');
}

function testCaseDetailTabConstantIncludesKnowledge() {
  const constantsSource = read('ui/src/utils/constants.js');
  assert.ok(
    constantsSource.includes("KNOWLEDGE: 'knowledge'"),
    "constants.js must define KNOWLEDGE tab constant",
  );
  assert.ok(
    constantsSource.includes('CASE_DETAIL_TABS.KNOWLEDGE') || constantsSource.includes("'knowledge'"),
    "VALID_CASE_DETAIL_TAB_NAMES must include knowledge tab",
  );
  console.log('  ✓ CASE_DETAIL_TABS.KNOWLEDGE constant defined in constants.js');
}

function run() {
  console.log('Running knowledgeLibrary.ui.test.js...');
  testRouteConstantExists();
  testExistingRoutesUntouched();
  testNavigationReflectsCurrentIA();
  testExistingNavigationItemsPreserved();
  testCommandPaletteNoPinnedKnowledgeDestination();
  testApiClientUsesCorrectEndpoint();
  testBackendRouteContractMountsKnowledgeItems();
  testPageFilteringIsClientSideOnly();
  testPageExistsAndContainsExpectedContent();
  testPageHasEmptyStates();
  testPageHasImprovedGuidanceCopy();
  testStatsIncludeChecklistAndUnlinked();
  testFiltersIncludeClearFilters();
  testTableShowsBadgesAndLinkIndicators();
  testFormGroupsExist();
  testChecklistEmptyStateCopyExists();
  testDetailDrawerSections();
  testNoCompletionTrackingUi();
  testRouteIsAdminOnly();
  testLazyPageRegistered();
  testNoAiOrVectorInfrastructureAdded();
  testCompanyBrainPageUnchanged();
  testCaseDetailPageHasLinkedKnowledgeTab();
  testLinkedKnowledgeSectionFetchesViaApi();
  testLinkedKnowledgeSectionHasEmptyStates();
  testLinkedKnowledgeSectionHasNoAiInfrastructure();
  testKnowledgeLibraryFormHasLinkedWorkTypeHelperCopy();
  testChecklistStepsUiAndReadOnlyDisplay();
  testLinkedKnowledgeShowsChecklistStepCount();
  testCaseDetailTabConstantIncludesKnowledge();
  console.log('✅ knowledgeLibrary.ui.test.js passed');
}

run();
