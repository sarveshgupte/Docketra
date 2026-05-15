const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'src', 'models');

const PROHIBITED_FIELDS = [
  'PAN','TAN','GST','CIN','businessAddress','businessEmail','primaryContactNumber','secondaryContactNumber',
  'contactPersonName','contactPersonDesignation','contactPersonPhoneNumber','contactPersonEmailAddress',
  'description','notes','factSheet','clientFactSheet','comments','comment','text','taskDescription','docketDescription','internalNotes','fileContent','parsedText','extractedText'
];

// Temporary allowlist for existing schemas pending phased migration.
// Each entry is explicit so newly introduced prohibited fields still fail this guardrail test.
const ALLOWLIST = {
  'Case.model.js': ['description','comment','businessAddress','businessEmail','primaryContactNumber','PAN','GST','CIN'],
  'Client.model.js': ['businessAddress','businessEmail','primaryContactNumber','secondaryContactNumber','PAN','TAN','GST','CIN','contactPersonName','contactPersonDesignation','contactPersonPhoneNumber','contactPersonEmailAddress','description','notes','comments','clientFactSheet'],
  'Task.js': ['description','comment'],
  'WorkType.model.js': ['description'],
  'KnowledgeItem.model.js': ['description'],
  'LandingPage.model.js': ['description'],
  'Comment.model.js': ['text'],
  'Lead.model.js': ['notes','text'],
  'DocketAuditLog.model.js': ['comment'],
  'CaseFile.model.js': ['description','note'],
  'Attachment.model.js': ['description','note','extractedFields'],
  'AuthAudit.model.js': ['description'],
  'CaseAudit.model.js': ['description'],
  'CaseHistory.model.js': ['description'],
  'ClientAudit.model.js': ['description'],
  'DocketActivity.model.js': ['description'],
  'SuperadminAudit.model.js': ['description'],
};

function schemaFiles() {
  return fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.js')).sort();
}

function fieldExists(source, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\b${escaped}\\b\\s*:`),
    new RegExp(`["']${escaped}["']\\s*:`)
  ];
  return patterns.some((p) => p.test(source));
}

let violations = [];
for (const file of schemaFiles()) {
  const source = fs.readFileSync(path.join(MODELS_DIR, file), 'utf8');
  for (const prohibited of PROHIBITED_FIELDS) {
    if (!fieldExists(source, prohibited)) continue;
    const allowed = (ALLOWLIST[file] || []).includes(prohibited);
    if (!allowed) violations.push(`${file}: ${prohibited}`);
  }
}

if (violations.length) {
  console.error('Mongo schema data-residency guardrail failed. New prohibited fields detected without allowlist entries:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Mongo schema data-residency guardrail passed. No unallowlisted prohibited fields detected.');
