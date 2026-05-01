#!/usr/bin/env node
'use strict';

/**
 * Tests for Company Brain connected map v1.
 *
 * Validates:
 * - CompanyBrainPage imports knowledgeItemsApi
 * - CompanyBrainPage calls knowledgeItemsApi.listKnowledgeItems
 * - CompanyBrainPage contains "Connected map" section
 * - CompanyBrainPage contains "Knowledge health" section
 * - CompanyBrainPage links to ROUTES.KNOWLEDGE_LIBRARY
 * - CompanyBrainPage distinguishes Knowledge Intake and Knowledge Library
 * - CompanyBrainPage still uses existing crmApi/listClients/listLeads and dashboardApi.getSummary
 * - No AI/vector/embedding/document extraction infrastructure added
 * - Existing Company Brain, Knowledge Library, CRM, CMS, Task Manager routes remain unchanged
 * - Refresh reloads all four data sources
 * - Partial failure (knowledgeItems) does not break clients/leads/work sections
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function testImportsKnowledgeItemsApi() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes("import { knowledgeItemsApi } from '../api/knowledgeItems.api'") ||
    source.includes("import { knowledgeItemsApi } from \"../api/knowledgeItems.api\""),
    'CompanyBrainPage must import knowledgeItemsApi from knowledgeItems.api',
  );
  console.log('  ✓ CompanyBrainPage imports knowledgeItemsApi');
}

function testCallsListKnowledgeItems() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('knowledgeItemsApi.listKnowledgeItems'),
    'CompanyBrainPage must call knowledgeItemsApi.listKnowledgeItems',
  );
  assert.ok(
    source.includes('limit: 100'),
    'CompanyBrainPage must pass { limit: 100 } to listKnowledgeItems',
  );
  console.log('  ✓ CompanyBrainPage calls knowledgeItemsApi.listKnowledgeItems({ limit: 100 })');
}

function testContainsConnectedMapSection() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Connected map'),
    'CompanyBrainPage must contain "Connected map" section',
  );
  console.log('  ✓ CompanyBrainPage contains "Connected map" section');
}

function testContainsKnowledgeHealthSection() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Knowledge health'),
    'CompanyBrainPage must contain "Knowledge health" section',
  );
  console.log('  ✓ CompanyBrainPage contains "Knowledge health" section');
}

function testLinksToKnowledgeLibrary() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('ROUTES.KNOWLEDGE_LIBRARY(firmSlug)'),
    'CompanyBrainPage must link to ROUTES.KNOWLEDGE_LIBRARY',
  );
  console.log('  ✓ CompanyBrainPage links to ROUTES.KNOWLEDGE_LIBRARY');
}

function testDistinguishesKnowledgeIntakeAndLibrary() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Knowledge Intake'),
    'CompanyBrainPage must reference Knowledge Intake',
  );
  assert.ok(
    source.includes('Knowledge Library'),
    'CompanyBrainPage must reference Knowledge Library',
  );
  // Ensure they are presented as distinct concepts on the same page
  const intakeIndex = source.indexOf('Knowledge Intake');
  const libraryIndex = source.indexOf('Knowledge Library');
  assert.ok(
    intakeIndex !== -1 && libraryIndex !== -1 && intakeIndex !== libraryIndex,
    'CompanyBrainPage must distinguish Knowledge Intake from Knowledge Library as separate concepts',
  );
  console.log('  ✓ CompanyBrainPage distinguishes Knowledge Intake and Knowledge Library');
}

function testUsesExistingCrmAndDashboardApis() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes("import { crmApi } from '../api/crm.api'") ||
    source.includes("import { crmApi } from \"../api/crm.api\""),
    'CompanyBrainPage must still import crmApi',
  );
  assert.ok(
    source.includes("import { dashboardApi } from '../api/dashboard.api'") ||
    source.includes("import { dashboardApi } from \"../api/dashboard.api\""),
    'CompanyBrainPage must still import dashboardApi',
  );
  assert.ok(source.includes('crmApi.listClients'), 'CompanyBrainPage must call crmApi.listClients');
  assert.ok(source.includes('crmApi.listLeads'), 'CompanyBrainPage must call crmApi.listLeads');
  assert.ok(source.includes('dashboardApi.getSummary'), 'CompanyBrainPage must call dashboardApi.getSummary');
  console.log('  ✓ CompanyBrainPage still uses crmApi.listClients, crmApi.listLeads, dashboardApi.getSummary');
}

function testRefreshLoadsAllFourSources() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  // All four calls must be inside Promise.allSettled
  const allSettledIndex = source.indexOf('Promise.allSettled');
  assert.ok(allSettledIndex !== -1, 'CompanyBrainPage must use Promise.allSettled for loading');
  const allSettledBlock = source.slice(allSettledIndex, allSettledIndex + 500);
  assert.ok(allSettledBlock.includes('crmApi.listClients'), 'Promise.allSettled must include listClients');
  assert.ok(allSettledBlock.includes('crmApi.listLeads'), 'Promise.allSettled must include listLeads');
  assert.ok(allSettledBlock.includes('dashboardApi.getSummary'), 'Promise.allSettled must include getSummary');
  assert.ok(allSettledBlock.includes('knowledgeItemsApi.listKnowledgeItems'), 'Promise.allSettled must include listKnowledgeItems');
  console.log('  ✓ Refresh loads all four sources via Promise.allSettled');
}

function testPartialFailureWarningCopy() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Some Company Brain data could not be loaded. Showing available data.'),
    'CompanyBrainPage must show partial failure warning when some sources fail',
  );
  console.log('  ✓ CompanyBrainPage has partial failure warning copy');
}

function testKnowledgeStatsInAttentionSummary() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(source.includes('Knowledge records'), 'CompanyBrainPage must show Knowledge records stat');
  assert.ok(source.includes('Active knowledge records'), 'CompanyBrainPage must show Active knowledge records stat');
  assert.ok(source.includes('Knowledge review due'), 'CompanyBrainPage must show Knowledge review due stat');
  console.log('  ✓ CompanyBrainPage includes knowledge stats in Attention summary');
}

function testKnowledgeHealthCues() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(source.includes('draftKnowledge'), 'CompanyBrainPage must track draft knowledge records');
  assert.ok(source.includes('archivedKnowledge'), 'CompanyBrainPage must track archived knowledge records');
  assert.ok(source.includes('knowledgeReviewDue'), 'CompanyBrainPage must track knowledge review due');
  assert.ok(source.includes('knowledgeWithoutOwner'), 'CompanyBrainPage must track knowledge without owner');
  assert.ok(source.includes('knowledgeWithoutLinks'), 'CompanyBrainPage must track knowledge without links');
  console.log('  ✓ CompanyBrainPage tracks all knowledge health cues');
}

function testKnowledgeWithoutLinksCopy() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Knowledge without links means records that do not have a linked work type, client, or docket'),
    'CompanyBrainPage must include safe "Knowledge without links" explanation copy',
  );
  console.log('  ✓ CompanyBrainPage has safe "Knowledge without links" explanation copy');
}

function testConnectedMapIncludesAllNodes() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  // ConnectedMapNode with title Clients, Prospective Clients, Work, Knowledge Library, Company Brain
  assert.ok(source.includes("title=\"Clients\"") || source.includes("title='Clients'"), 'Connected map must include Clients node');
  assert.ok(source.includes("title=\"Prospective Clients\"") || source.includes("title='Prospective Clients'"), 'Connected map must include Prospective Clients node');
  assert.ok(source.includes("title=\"Work\"") || source.includes("title='Work'"), 'Connected map must include Work node');
  assert.ok(source.includes("title=\"Knowledge Library\"") || source.includes("title='Knowledge Library'"), 'Connected map must include Knowledge Library node');
  assert.ok(source.includes("title=\"Company Brain\"") || source.includes("title='Company Brain'"), 'Connected map must include Company Brain node');
  console.log('  ✓ Connected map contains all five nodes');
}

function testMemoryMapIncludesKnowledgeLibrary() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(source.includes('Memory map'), 'CompanyBrainPage must still have Memory map section');
  // Knowledge Library tile in memory map
  const memoryMapIndex = source.indexOf('Memory map');
  const memoryMapBlock = source.slice(memoryMapIndex, memoryMapIndex + 1500);
  assert.ok(
    memoryMapBlock.includes('Knowledge Library'),
    'Memory map section must include Knowledge Library tile',
  );
  console.log('  ✓ Memory map section includes Knowledge Library');
}

function testMemoryMapFlowCopy() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Knowledge Intake → Relationships → Clients → Work → Knowledge Library → Company Brain'),
    'CompanyBrainPage must include the full memory map flow line',
  );
  console.log('  ✓ Memory map flow line includes Knowledge Library and Company Brain');
}

function testNoAiOrVectorInfrastructure() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx').toLowerCase();
  const forbidden = [
    'embedding',
    'vector',
    'openai',
    'langchain',
    'pinecone',
    'weaviate',
    'chroma',
    'extractdocument',
    'pdfparse',
    'ai-powered',
    'semantic search',
    'graph intelligence',
    'ask docketra',
    'automatic extraction',
  ];
  for (const term of forbidden) {
    assert.ok(
      !source.includes(term.toLowerCase()),
      `CompanyBrainPage must not contain AI/vector infrastructure term: ${term}`,
    );
  }
  console.log('  ✓ No AI/vector/embedding/document extraction infrastructure in CompanyBrainPage');
}

function testHonestCopyLanguage() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  // Should use honest language
  assert.ok(source.includes('read-only') || source.includes('Read-only'), 'CompanyBrainPage must use "read-only" language');
  assert.ok(source.includes('rule-based') || source.includes('Rule-based'), 'CompanyBrainPage must use "rule-based" language');
  assert.ok(
    source.includes('metadata links') || source.includes('connected from existing records') || source.includes('Connected from existing records'),
    'CompanyBrainPage must use honest "metadata links" or "connected from existing records" language',
  );
  console.log('  ✓ CompanyBrainPage uses honest copy language (read-only, rule-based, metadata links)');
}

function testExistingRoutesUnchanged() {
  const routesSource = read('ui/src/constants/routes.js');
  assert.ok(routesSource.includes("CMS: (firmSlug) => `/app/firm/${firmSlug}/cms`"), 'CMS route must remain unchanged');
  assert.ok(routesSource.includes("CRM: (firmSlug) => `/app/firm/${firmSlug}/crm`"), 'CRM route must remain unchanged');
  assert.ok(routesSource.includes("COMPANY_BRAIN: (firmSlug) => `/app/firm/${firmSlug}/company-brain`"), 'COMPANY_BRAIN route must remain unchanged');
  assert.ok(routesSource.includes("TASK_MANAGER: (firmSlug) => `/app/firm/${firmSlug}/task-manager`"), 'TASK_MANAGER route must remain unchanged');
  assert.ok(routesSource.includes("KNOWLEDGE_LIBRARY: (firmSlug) => `/app/firm/${firmSlug}/knowledge`"), 'KNOWLEDGE_LIBRARY route must remain unchanged');
  console.log('  ✓ Existing routes remain unchanged');
}

function testUsefulConnectionsSection() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Useful connections'),
    'CompanyBrainPage must contain "Useful connections" section',
  );
  console.log('  ✓ CompanyBrainPage contains "Useful connections" section');
}

function run() {
  console.log('Running companyBrainConnectedMap.test.js...');
  testImportsKnowledgeItemsApi();
  testCallsListKnowledgeItems();
  testContainsConnectedMapSection();
  testContainsKnowledgeHealthSection();
  testLinksToKnowledgeLibrary();
  testDistinguishesKnowledgeIntakeAndLibrary();
  testUsesExistingCrmAndDashboardApis();
  testRefreshLoadsAllFourSources();
  testPartialFailureWarningCopy();
  testKnowledgeStatsInAttentionSummary();
  testKnowledgeHealthCues();
  testKnowledgeWithoutLinksCopy();
  testConnectedMapIncludesAllNodes();
  testMemoryMapIncludesKnowledgeLibrary();
  testMemoryMapFlowCopy();
  testNoAiOrVectorInfrastructure();
  testHonestCopyLanguage();
  testExistingRoutesUnchanged();
  testUsefulConnectionsSection();
  console.log('✅ companyBrainConnectedMap.test.js passed');
}

run();
