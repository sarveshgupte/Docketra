#!/usr/bin/env node
'use strict';

/**
 * Tests for Client Knowledge in Client Memory.
 *
 * Validates:
 * - ClientWorkspacePage contains "Client Knowledge" section
 * - ClientKnowledgeSection imports and uses knowledgeItemsApi
 * - ClientKnowledgeSection calls listKnowledgeItems with clientId
 * - Client Knowledge rows deep-link to Knowledge Library with ?item=
 * - Empty state copy exists
 * - Knowledge Library helper copy explains client linking
 * - No AI/vector/embedding/document extraction infrastructure added
 * - Existing Company Brain, Knowledge Library, CRM, CMS, Task Manager routes remain unchanged
 * - CrmClientDetailPage has compatibility comment noting ClientWorkspacePage is primary surface
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function testClientWorkspacePageContainsClientKnowledgeSection() {
  const pageSource = read('ui/src/pages/ClientWorkspacePage.jsx');
  assert.ok(
    pageSource.includes('ClientKnowledgeSection'),
    'ClientWorkspacePage must import and render ClientKnowledgeSection',
  );
  assert.ok(
    pageSource.includes("from './clientWorkspace/ClientKnowledgeSection'"),
    'ClientWorkspacePage must import ClientKnowledgeSection from clientWorkspace subdirectory',
  );
  console.log('  ✓ ClientWorkspacePage imports and renders ClientKnowledgeSection');
}

function testClientWorkspacePagePassesClientMongoId() {
  const pageSource = read('ui/src/pages/ClientWorkspacePage.jsx');
  assert.ok(
    pageSource.includes('clientMongoId'),
    'ClientWorkspacePage must derive and pass clientMongoId to ClientKnowledgeSection',
  );
  assert.ok(
    pageSource.includes('client?._id'),
    'ClientWorkspacePage must resolve clientMongoId from client._id',
  );
  console.log('  ✓ ClientWorkspacePage derives clientMongoId and passes it to ClientKnowledgeSection');
}

function testClientKnowledgeSectionUsesApi() {
  const sectionSource = read('ui/src/pages/clientWorkspace/ClientKnowledgeSection.jsx');
  assert.ok(
    sectionSource.includes('knowledgeItemsApi'),
    'ClientKnowledgeSection must import knowledgeItemsApi',
  );
  assert.ok(
    sectionSource.includes('listKnowledgeItems'),
    'ClientKnowledgeSection must call listKnowledgeItems',
  );
  assert.ok(
    sectionSource.includes('clientId'),
    'ClientKnowledgeSection must pass clientId param to listKnowledgeItems',
  );
  assert.ok(
    sectionSource.includes("status: 'active'"),
    "ClientKnowledgeSection must filter by status: 'active'",
  );
  console.log('  ✓ ClientKnowledgeSection fetches via knowledgeItemsApi with clientId and active status');
}

function testClientKnowledgeSectionDeepLinksToKnowledgeLibrary() {
  const sectionSource = read('ui/src/pages/clientWorkspace/ClientKnowledgeSection.jsx');
  assert.ok(
    sectionSource.includes('ROUTES.KNOWLEDGE_LIBRARY(firmSlug)'),
    'ClientKnowledgeSection must navigate to KNOWLEDGE_LIBRARY route',
  );
  assert.ok(
    sectionSource.includes('?item='),
    'ClientKnowledgeSection must include ?item= query param for deep-linking',
  );
  console.log('  ✓ Client Knowledge rows deep-link to Knowledge Library with ?item=<id>');
}

function testClientKnowledgeSectionShowsSourceLabel() {
  const sectionSource = read('ui/src/pages/clientWorkspace/ClientKnowledgeSection.jsx');
  assert.ok(
    sectionSource.includes('Linked to client'),
    "ClientKnowledgeSection must show 'Linked to client' source label",
  );
  console.log("  ✓ ClientKnowledgeSection shows 'Linked to client' source label");
}

function testClientKnowledgeSectionHasEmptyStates() {
  const sectionSource = read('ui/src/pages/clientWorkspace/ClientKnowledgeSection.jsx');
  assert.ok(
    sectionSource.includes('Knowledge records linked to this client will appear here'),
    'ClientKnowledgeSection must have empty state message for no items',
  );
  assert.ok(
    sectionSource.includes('Ask an admin'),
    'ClientKnowledgeSection must have non-admin empty state message',
  );
  assert.ok(
    sectionSource.includes('Client-linked knowledge will appear here once this client has a stable internal client ID'),
    'ClientKnowledgeSection must have safe empty state when clientMongoId is unavailable',
  );
  console.log('  ✓ ClientKnowledgeSection has correct empty states');
}

function testClientKnowledgeSectionHasGoToKnowledgeLibraryFallback() {
  const sectionSource = read('ui/src/pages/clientWorkspace/ClientKnowledgeSection.jsx');
  assert.ok(
    sectionSource.includes('Go to Knowledge Library'),
    'ClientKnowledgeSection must include Go to Knowledge Library fallback action',
  );
  console.log('  ✓ ClientKnowledgeSection includes Go to Knowledge Library fallback');
}

function testClientKnowledgeSectionDoesNotEditInline() {
  const sectionSource = read('ui/src/pages/clientWorkspace/ClientKnowledgeSection.jsx');
  assert.ok(
    !sectionSource.includes('updateKnowledgeItem'),
    'ClientKnowledgeSection must not call updateKnowledgeItem (read-only)',
  );
  assert.ok(
    !sectionSource.includes('createKnowledgeItem'),
    'ClientKnowledgeSection must not call createKnowledgeItem (read-only)',
  );
  assert.ok(
    !sectionSource.includes('archiveKnowledgeItem'),
    'ClientKnowledgeSection must not call archiveKnowledgeItem (read-only)',
  );
  console.log('  ✓ ClientKnowledgeSection is read-only — no inline editing');
}

function testClientKnowledgeSectionHasSectionTitle() {
  const sectionSource = read('ui/src/pages/clientWorkspace/ClientKnowledgeSection.jsx');
  assert.ok(
    sectionSource.includes('Client Knowledge'),
    "ClientKnowledgeSection must render 'Client Knowledge' section title",
  );
  console.log("  ✓ ClientKnowledgeSection renders 'Client Knowledge' title");
}

function testKnowledgeLibraryFormHasLinkedClientIdHelperCopy() {
  const pageSource = read('ui/src/pages/KnowledgeLibraryPage.jsx');
  assert.ok(
    pageSource.includes('Linking a client lets this knowledge appear in Client Memory'),
    'KnowledgeLibraryPage form must include helper copy explaining client linking',
  );
  assert.ok(
    pageSource.includes('linkedClientId'),
    'KnowledgeLibraryPage form must include linkedClientId field',
  );
  console.log('  ✓ KnowledgeLibraryPage includes linkedClientId field with helper copy');
}

function testCrmClientDetailPageHasCompatibilityComment() {
  const pageSource = read('ui/src/pages/crm/CrmClientDetailPage.jsx');
  assert.ok(
    pageSource.includes('ClientWorkspacePage'),
    'CrmClientDetailPage must contain compatibility comment referencing ClientWorkspacePage',
  );
  console.log('  ✓ CrmClientDetailPage has compatibility comment referencing ClientWorkspacePage as primary Client Memory surface');
}

function testNoAiOrVectorInfrastructureAdded() {
  const files = [
    'ui/src/pages/clientWorkspace/ClientKnowledgeSection.jsx',
    'ui/src/pages/ClientWorkspacePage.jsx',
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

function testExistingRoutesUntouched() {
  const routesSource = read('ui/src/constants/routes.js');
  assert.ok(routesSource.includes("CMS: (firmSlug) => `/app/firm/${firmSlug}/cms`"), 'CMS route must remain unchanged');
  assert.ok(routesSource.includes("CRM: (firmSlug) => `/app/firm/${firmSlug}/crm`"), 'CRM route must remain unchanged');
  assert.ok(routesSource.includes("COMPANY_BRAIN: (firmSlug) => `/app/firm/${firmSlug}/company-brain`"), 'COMPANY_BRAIN route must remain unchanged');
  assert.ok(routesSource.includes("TASK_MANAGER: (firmSlug) => `/app/firm/${firmSlug}/task-manager`"), 'TASK_MANAGER route must remain unchanged');
  assert.ok(routesSource.includes("KNOWLEDGE_LIBRARY: (firmSlug) => `/app/firm/${firmSlug}/knowledge`"), 'KNOWLEDGE_LIBRARY route must remain unchanged');
  assert.ok(routesSource.includes("CLIENT_WORKSPACE: (firmSlug, clientId) => `/app/firm/${firmSlug}/clients/${clientId}`"), 'CLIENT_WORKSPACE route must remain unchanged');
  console.log('  ✓ Existing CMS/CRM/Company Brain/Task Manager/Knowledge Library/Client Workspace routes unchanged');
}

function testDocsWhatsNewUpdated() {
  const whatsNewSource = read('docs/whats-new.md');
  assert.ok(
    whatsNewSource.includes('Client Knowledge in Client Memory'),
    'docs/whats-new.md must include Client Knowledge in Client Memory section',
  );
  assert.ok(
    whatsNewSource.includes('Client Knowledge'),
    'docs/whats-new.md must mention Client Knowledge feature',
  );
  console.log('  ✓ docs/whats-new.md updated with Client Knowledge in Client Memory');
}

function testDocsCompanyBrainStrategyUpdated() {
  const strategySource = read('docs/product/COMPANY_BRAIN_STRATEGY.md');
  assert.ok(
    strategySource.includes('Client Knowledge in Client Memory'),
    'COMPANY_BRAIN_STRATEGY.md must include Client Knowledge in Client Memory section',
  );
  console.log('  ✓ docs/product/COMPANY_BRAIN_STRATEGY.md updated');
}

function testDocsModuleOperatingModelUpdated() {
  const modelSource = read('docs/product/MODULE_OPERATING_MODEL.md');
  assert.ok(
    modelSource.includes('Client Memory') && modelSource.includes('KnowledgeItem'),
    'MODULE_OPERATING_MODEL.md must mention Client Memory surfacing KnowledgeItems',
  );
  console.log('  ✓ docs/product/MODULE_OPERATING_MODEL.md updated');
}

function run() {
  console.log('Running clientKnowledge.ui.test.js...');
  testClientWorkspacePageContainsClientKnowledgeSection();
  testClientWorkspacePagePassesClientMongoId();
  testClientKnowledgeSectionUsesApi();
  testClientKnowledgeSectionDeepLinksToKnowledgeLibrary();
  testClientKnowledgeSectionShowsSourceLabel();
  testClientKnowledgeSectionHasEmptyStates();
  testClientKnowledgeSectionHasGoToKnowledgeLibraryFallback();
  testClientKnowledgeSectionDoesNotEditInline();
  testClientKnowledgeSectionHasSectionTitle();
  testKnowledgeLibraryFormHasLinkedClientIdHelperCopy();
  testCrmClientDetailPageHasCompatibilityComment();
  testNoAiOrVectorInfrastructureAdded();
  testExistingRoutesUntouched();
  testDocsWhatsNewUpdated();
  testDocsCompanyBrainStrategyUpdated();
  testDocsModuleOperatingModelUpdated();
  console.log('✅ clientKnowledge.ui.test.js passed');
}

run();
