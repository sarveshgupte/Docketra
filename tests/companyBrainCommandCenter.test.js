#!/usr/bin/env node
'use strict';

/**
 * Tests for Company Brain command center UX simplification.
 *
 * Validates:
 * - CompanyBrainPage contains "Command Summary"
 * - CompanyBrainPage contains "Needs Attention"
 * - CompanyBrainPage contains "Connected Map"
 * - CompanyBrainPage contains "How to use Company Brain"
 * - CompanyBrainPage still calls crmApi.listClients
 * - CompanyBrainPage still calls crmApi.listLeads
 * - CompanyBrainPage still calls dashboardApi.getSummary
 * - CompanyBrainPage still calls knowledgeItemsApi.listKnowledgeItems
 * - CompanyBrainPage links to Knowledge Library
 * - CompanyBrainPage uses read-only/metadata-link language
 * - CompanyBrainPage does not contain AI/vector/embedding/document extraction infrastructure
 * - Existing Company Brain, Knowledge Library, Client Memory, CRM, CMS, Task Manager routes remain unchanged
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function testContainsCommandSummary() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Command Summary'),
    'CompanyBrainPage must contain "Command Summary" section',
  );
  console.log('  ✓ CompanyBrainPage contains "Command Summary"');
}

function testContainsNeedsAttention() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Needs Attention'),
    'CompanyBrainPage must contain "Needs Attention" section',
  );
  console.log('  ✓ CompanyBrainPage contains "Needs Attention"');
}

function testContainsConnectedMap() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('Connected Map'),
    'CompanyBrainPage must contain "Connected Map" section',
  );
  console.log('  ✓ CompanyBrainPage contains "Connected Map"');
}

function testContainsHowToUse() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('How to use Company Brain'),
    'CompanyBrainPage must contain "How to use Company Brain" section',
  );
  console.log('  ✓ CompanyBrainPage contains "How to use Company Brain"');
}

function testCallsListClients() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('crmApi.listClients'),
    'CompanyBrainPage must call crmApi.listClients',
  );
  console.log('  ✓ CompanyBrainPage still calls crmApi.listClients');
}

function testCallsListLeads() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('crmApi.listLeads'),
    'CompanyBrainPage must call crmApi.listLeads',
  );
  console.log('  ✓ CompanyBrainPage still calls crmApi.listLeads');
}

function testCallsGetSummary() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('dashboardApi.getSummary'),
    'CompanyBrainPage must call dashboardApi.getSummary',
  );
  console.log('  ✓ CompanyBrainPage still calls dashboardApi.getSummary');
}

function testCallsListKnowledgeItems() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('knowledgeItemsApi.listKnowledgeItems'),
    'CompanyBrainPage must call knowledgeItemsApi.listKnowledgeItems',
  );
  console.log('  ✓ CompanyBrainPage still calls knowledgeItemsApi.listKnowledgeItems');
}

function testLinksToKnowledgeLibrary() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('ROUTES.KNOWLEDGE_LIBRARY(firmSlug)'),
    'CompanyBrainPage must link to Knowledge Library',
  );
  console.log('  ✓ CompanyBrainPage links to Knowledge Library');
}

function testReadOnlyMetadataLanguage() {
  const source = read('ui/src/pages/CompanyBrainPage.jsx');
  assert.ok(
    source.includes('read-only') || source.includes('Read-only'),
    'CompanyBrainPage must use "read-only" language',
  );
  assert.ok(
    source.includes('metadata links') || source.includes('connected from existing records') || source.includes('Connected from existing records'),
    'CompanyBrainPage must use "metadata links" or "connected from existing records" language',
  );
  assert.ok(
    source.includes('rule-based') || source.includes('Rule-based'),
    'CompanyBrainPage must use "rule-based" language',
  );
  console.log('  ✓ CompanyBrainPage uses read-only/metadata-link/rule-based language');
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
  console.log('  ✓ CompanyBrainPage does not contain AI/vector/embedding/document extraction infrastructure');
}

function testExistingRoutesUnchanged() {
  const routesSource = read('ui/src/constants/routes.js');
  assert.ok(routesSource.includes("CMS: (firmSlug) => `/app/firm/${firmSlug}/cms`"), 'CMS route must remain unchanged');
  assert.ok(routesSource.includes("CRM: (firmSlug) => `/app/firm/${firmSlug}/crm`"), 'CRM route must remain unchanged');
  assert.ok(routesSource.includes("COMPANY_BRAIN: (firmSlug) => `/app/firm/${firmSlug}/company-brain`"), 'COMPANY_BRAIN route must remain unchanged');
  assert.ok(routesSource.includes("TASK_MANAGER: (firmSlug) => `/app/firm/${firmSlug}/task-manager`"), 'TASK_MANAGER route must remain unchanged');
  assert.ok(routesSource.includes("KNOWLEDGE_LIBRARY: (firmSlug) => `/app/firm/${firmSlug}/knowledge`"), 'KNOWLEDGE_LIBRARY route must remain unchanged');
  // Verify CRM route (Client Memory)
  assert.ok(routesSource.includes("CLIENTS: (firmSlug) => `/app/firm/${firmSlug}/clients`"), 'CLIENTS route must remain unchanged');
  console.log('  ✓ Existing Company Brain, Knowledge Library, Client Memory, CRM, CMS, Task Manager routes remain unchanged');
}

function run() {
  console.log('Running companyBrainCommandCenter.test.js...');
  testContainsCommandSummary();
  testContainsNeedsAttention();
  testContainsConnectedMap();
  testContainsHowToUse();
  testCallsListClients();
  testCallsListLeads();
  testCallsGetSummary();
  testCallsListKnowledgeItems();
  testLinksToKnowledgeLibrary();
  testReadOnlyMetadataLanguage();
  testNoAiOrVectorInfrastructure();
  testExistingRoutesUnchanged();
  console.log('✅ companyBrainCommandCenter.test.js passed');
}

run();
