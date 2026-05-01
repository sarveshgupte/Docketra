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

function testNavigationIncludesKnowledgeLibrary() {
  const navSource = read('ui/src/constants/platformNavigation.js');
  assert.ok(
    navSource.includes("id: 'knowledge-library'"),
    "Navigation must include knowledge-library item",
  );
  assert.ok(
    navSource.includes("label: 'Knowledge Library'"),
    "Navigation must label it Knowledge Library",
  );
  assert.ok(
    navSource.includes("icon: '📚'"),
    "Knowledge Library must use 📚 icon",
  );
  assert.ok(
    navSource.includes("ROUTES.KNOWLEDGE_LIBRARY(firmSlug)"),
    "Knowledge Library navigation item must use KNOWLEDGE_LIBRARY route",
  );
  assert.ok(
    navSource.includes("minRole: 'ADMIN'"),
    "Knowledge Library must be ADMIN-only in navigation",
  );
  console.log('  ✓ Navigation includes Knowledge Library under Firm Memory');
}

function testExistingNavigationItemsPreserved() {
  const navSource = read('ui/src/constants/platformNavigation.js');
  assert.ok(navSource.includes("id: 'intake'"), 'Knowledge Intake navigation item must remain');
  assert.ok(navSource.includes("id: 'crm'"), 'Relationships navigation item must remain');
  assert.ok(navSource.includes("id: 'company-brain'"), 'Company Brain navigation item must remain');
  assert.ok(navSource.includes("id: 'clients'"), 'Clients navigation item must remain');
  console.log('  ✓ Existing Firm Memory navigation items preserved');
}

function testCommandPaletteIncludesKnowledgeLibrary() {
  const navSource = read('ui/src/constants/platformNavigation.js');
  assert.ok(
    navSource.includes("id: 'go-knowledge-library'"),
    "Command palette must include go-knowledge-library command",
  );
  assert.ok(
    navSource.includes("label: 'Go to Knowledge Library'"),
    "go-knowledge-library command must have correct label",
  );
  assert.ok(
    navSource.includes('Manage SOPs, checklists, templates, notes, client instructions, and process records.'),
    "go-knowledge-library command must have correct description",
  );
  console.log('  ✓ Command palette includes go-knowledge-library');
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

  // Backend must mount the knowledge-items router at /api/knowledge-items.
  // This is the path the frontend API client resolves to after baseURL expansion.
  assert.ok(
    createAppSource.includes("app.use('/api/knowledge-items'"),
    "createApp.js must mount /api/knowledge-items router",
  );
  assert.ok(
    createAppSource.includes('knowledgeItemRoutes'),
    "createApp.js must reference knowledgeItemRoutes",
  );

  // Existing tenant-scoped routes must remain intact.
  assert.ok(
    createAppSource.includes("app.use('/api/leads'"),
    "createApp.js CRM leads route must remain mounted",
  );
  assert.ok(
    createAppSource.includes("app.use('/api/crm/clients'"),
    "createApp.js CRM clients route must remain mounted",
  );
  assert.ok(
    createAppSource.includes("app.use('/api/dashboard'"),
    "createApp.js dashboard route must remain mounted",
  );
  console.log('  ✓ createApp.js mounts /api/knowledge-items and existing routes remain intact');
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
    pageSource.includes('Your firm knowledge library is empty'),
    'KnowledgeLibraryPage must have empty state message when no items',
  );
  assert.ok(
    pageSource.includes('No knowledge items match these filters'),
    'KnowledgeLibraryPage must have filtered empty state message',
  );
  console.log('  ✓ KnowledgeLibraryPage has correct empty states');
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

function run() {
  console.log('Running knowledgeLibrary.ui.test.js...');
  testRouteConstantExists();
  testExistingRoutesUntouched();
  testNavigationIncludesKnowledgeLibrary();
  testExistingNavigationItemsPreserved();
  testCommandPaletteIncludesKnowledgeLibrary();
  testApiClientUsesCorrectEndpoint();
  testBackendRouteContractMountsKnowledgeItems();
  testPageFilteringIsClientSideOnly();
  testPageExistsAndContainsExpectedContent();
  testPageHasEmptyStates();
  testRouteIsAdminOnly();
  testLazyPageRegistered();
  testNoAiOrVectorInfrastructureAdded();
  testCompanyBrainPageUnchanged();
  console.log('✅ knowledgeLibrary.ui.test.js passed');
}

run();

