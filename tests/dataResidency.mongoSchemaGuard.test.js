const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'src', 'models');

const PROHIBITED_FIELDS = [
  'PAN','TAN','GST','CIN','businessAddress','businessEmail','businessName','primaryContactNumber',
  'address','description','notes','comments','remarks','instructions','content','clientFactSheet',
  'factSheet','checklist','sop','documentText','attachmentContent','fileBuffer','rawPayload',
  'fileContent','parsedText','extractedText'
];

// Explicit temporary exceptions only; each requires reason + migration target.
const EXCEPTIONS = {
  'Case.model.js': [
    { field: 'businessName', reason: 'Legacy client snapshot on docket documents', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
    { field: 'description', reason: 'Legacy docket narrative stored in Mongo until BYOS docket.json migration completes', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
    { field: 'checklist', reason: 'Legacy checklist snapshot in Mongo pending BYOS checklist canonicalization', migrationPhase: 'Phase 5', removalTarget: '2026-10-31' },
    { field: 'businessAddress', reason: 'Legacy client snapshot on docket documents', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
    { field: 'businessEmail', reason: 'Legacy client snapshot on docket documents', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
    { field: 'primaryContactNumber', reason: 'Legacy client snapshot on docket documents', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
    { field: 'PAN', reason: 'Legacy client snapshot on docket documents', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
    { field: 'GST', reason: 'Legacy client snapshot on docket documents', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
    { field: 'CIN', reason: 'Legacy client snapshot on docket documents', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
  ],
  'Client.model.js': [
    { field: 'businessName', reason: 'Legacy client profile compatibility fields', migrationPhase: 'Phase 1', removalTarget: '2026-08-31' },
    { field: 'businessEmail', reason: 'Legacy client profile compatibility fields', migrationPhase: 'Phase 1', removalTarget: '2026-08-31' },
    { field: 'primaryContactNumber', reason: 'Legacy client profile compatibility fields', migrationPhase: 'Phase 1', removalTarget: '2026-08-31' },
    { field: 'businessAddress', reason: 'Legacy client profile compatibility fields', migrationPhase: 'Phase 1', removalTarget: '2026-08-31' },
    { field: 'PAN', reason: 'Legacy client profile compatibility fields', migrationPhase: 'Phase 1', removalTarget: '2026-08-31' },
    { field: 'TAN', reason: 'Legacy client profile compatibility fields', migrationPhase: 'Phase 1', removalTarget: '2026-08-31' },
    { field: 'GST', reason: 'Legacy client profile compatibility fields', migrationPhase: 'Phase 1', removalTarget: '2026-08-31' },
    { field: 'CIN', reason: 'Legacy client profile compatibility fields', migrationPhase: 'Phase 1', removalTarget: '2026-08-31' },
    { field: 'address', reason: 'Legacy CFS basic info address compatibility', migrationPhase: 'Phase 2', removalTarget: '2026-09-15' },
    { field: 'clientFactSheet', reason: 'Legacy CFS in Mongo pending BYOS cfs.json canonicalization', migrationPhase: 'Phase 2', removalTarget: '2026-09-15' },
    { field: 'description', reason: 'Legacy CFS compatibility', migrationPhase: 'Phase 2', removalTarget: '2026-09-15' },
    { field: 'notes', reason: 'Legacy CFS compatibility', migrationPhase: 'Phase 2', removalTarget: '2026-09-15' },
    { field: 'comments', reason: 'Legacy CFS compatibility', migrationPhase: 'Phase 2', removalTarget: '2026-09-15' },
  ],
  'Task.js': [
    { field: 'description', reason: 'Legacy task narrative in Mongo pending BYOS task.json migration', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' },
  ],
  'Comment.model.js': [
    { field: 'content', reason: 'Legacy comment body compatibility with existing APIs', migrationPhase: 'Phase 4', removalTarget: '2026-10-31' },
  ],
  'KnowledgeItem.model.js': [
    { field: 'content', reason: 'Legacy knowledge content pending BYOS canonical documents', migrationPhase: 'Phase 5', removalTarget: '2026-11-30' },
    { field: 'description', reason: 'Legacy knowledge summary text', migrationPhase: 'Phase 5', removalTarget: '2026-11-30' },
  ],
  'WorkType.model.js': [{ field: 'description', reason: 'Operational taxonomy description', migrationPhase: 'P2 cleanup', removalTarget: '2026-12-31' }],
  'LandingPage.model.js': [{ field: 'description', reason: 'Public marketing copy (non-firm business data)', migrationPhase: 'N/A', removalTarget: 'N/A' }],
  'Lead.model.js': [{ field: 'notes', reason: 'Legacy CRM notes pending CRM BYOS migration', migrationPhase: 'Phase 4', removalTarget: '2026-10-31' }],
  'CaseFile.model.js': [{ field: 'description', reason: 'Temporary upload-session metadata during finalization', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' }],
  'Attachment.model.js': [{ field: 'description', reason: 'Legacy attachment label/notes field', migrationPhase: 'Phase 3', removalTarget: '2026-09-30' }],

  'AuthAudit.model.js': [{ field: 'description', reason: 'Audit narrative metadata', migrationPhase: 'P2 cleanup', removalTarget: '2026-12-31' }],
  'CaseAudit.model.js': [{ field: 'description', reason: 'Audit narrative metadata', migrationPhase: 'P2 cleanup', removalTarget: '2026-12-31' }],
  'CaseHistory.model.js': [{ field: 'description', reason: 'Legacy operational history text', migrationPhase: 'Phase 4', removalTarget: '2026-10-31' }],
  'Category.model.js': [
    { field: 'description', reason: 'Operational taxonomy description metadata', migrationPhase: 'P2 cleanup', removalTarget: '2026-12-31' },
    { field: 'sop', reason: 'Legacy embedded SOP content', migrationPhase: 'Phase 5', removalTarget: '2026-11-30' },
  ],
  'ClientAudit.model.js': [{ field: 'description', reason: 'Audit narrative metadata', migrationPhase: 'P2 cleanup', removalTarget: '2026-12-31' }],
  'DocketActivity.model.js': [{ field: 'description', reason: 'Legacy activity narrative metadata', migrationPhase: 'Phase 4', removalTarget: '2026-10-31' }],
  'ProductUpdate.model.js': [{ field: 'content', reason: 'Product release notes (non-firm business payload)', migrationPhase: 'N/A', removalTarget: 'N/A' }],
  'SuperadminAudit.model.js': [{ field: 'description', reason: 'Platform audit metadata', migrationPhase: 'P2 cleanup', removalTarget: '2026-12-31' }],
  'UserProfile.model.js': [{ field: 'address', reason: 'Legacy user profile compatibility', migrationPhase: 'Phase 1', removalTarget: '2026-09-30' }],
};

function schemaFiles() {
  return fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.js')).sort();
}

function fieldExists(source, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [new RegExp(`\\b${escaped}\\b\\s*:`), new RegExp(`["']${escaped}["']\\s*:`)].some((p) => p.test(source));
}

function validateExceptions() {
  Object.entries(EXCEPTIONS).forEach(([model, entries]) => {
    entries.forEach((entry) => {
      const required = ['field', 'reason', 'migrationPhase', 'removalTarget'];
      required.forEach((k) => {
        if (!entry[k]) throw new Error(`Invalid exception metadata for ${model}.${entry.field || '<unknown>'}: missing ${k}`);
      });
    });
  });
}

validateExceptions();
const violations = [];
for (const file of schemaFiles()) {
  const source = fs.readFileSync(path.join(MODELS_DIR, file), 'utf8');
  const exceptionFields = new Set((EXCEPTIONS[file] || []).map((e) => e.field));
  for (const prohibited of PROHIBITED_FIELDS) {
    if (!fieldExists(source, prohibited)) continue;
    if (exceptionFields.has(prohibited)) continue;
    violations.push(`${file}: ${prohibited}`);
  }
}

if (violations.length) {
  console.error('Mongo schema data-residency guardrail failed. New prohibited fields detected without documented exception metadata:');
  violations.forEach((v) => console.error(`- ${v}`));
  process.exit(1);
}

console.log('Mongo schema data-residency guardrail passed. No undocumented prohibited fields detected.');
