const assert = require('assert');
require.cache[require.resolve('../src/services/auditLog.service')] = { exports: { logCaseHistory: async () => {} } };
const buildService = require('../src/services/caseCreate.service');

function mkRes(){ return { statusCode: 200, body:null, status(c){this.statusCode=c; return this;}, json(b){this.body=b; return this;} }; }

async function run(){
  let captured = null;
  const Case = function(doc){ captured = doc; this.saveWithRetry = async ()=>{}; this.toObject = () => ({...doc, _id:'1'}); };
  const svc = buildService({
    mongoose: { Types: { ObjectId: { isValid: () => true } } },
    randomUUID: ()=>'req-1', createHash:()=>({update(){return this;}, digest(){return 'h';}}),
    Case, Comment:{}, Attachment:{}, CaseHistory:{create:async()=>{}}, CaseAudit:{}, Client:{findOne:async()=>null}, User:{}, Team:{findOne:()=>({sort:()=>({select:()=>({lean:async()=>({_id:'wb-fallback'})})})})}, WorkType:{}, SubWorkType:{}, CrmClient:{}, Deal:{}, Invoice:{},
    CaseRepository:{ findOne: async ()=>null }, ClientRepository:{findByClientId: async ()=>({status:'ACTIVE', firmId:'firm-1'})}, AttachmentRepository:{},
    categoryRepository:{ findActiveCategory: async ()=>({ name:'Tax', subcategories:[{id:'sub-1', name:'GST', isActive:true, workbasketId:'wb-mapped'}] }) },
    detectDuplicates: async()=>({}), generateDuplicateOverrideComment:()=>'', CASE_CATEGORIES:{}, CASE_LOCK_CONFIG:{}, COMMENT_PREVIEW_LENGTH:80, CLIENT_STATUS:{ACTIVE:'ACTIVE'},
    CaseStatus:{ASSIGNED:'ASSIGNED',UNASSIGNED:'UNASSIGNED'}, DocketLifecycle:{ACTIVE:'ACTIVE',CREATED:'CREATED'}, toLifecycleFromStatus:()=>null, normalizeLifecycle:()=>null, isValidState:()=>true, isValidTransition:()=>true, isProduction:false,
    logCaseListViewed:async()=>{}, logAdminAction:async()=>{}, caseActionService:{}, CaseService:{}, caseSlaService:{initializeCaseSla:async()=>({})}, slaService:{calculateSlaDueDate:async()=>null, calculateFallbackDueDateFromDays:()=>null},
    getMimeType:()=>'', sanitizeFilename:(x)=>x, cleanupTempFile:async()=>{}, resolveCaseIdentifier:()=>null, StorageProviderFactory:{}, areFileUploadsDisabled:()=>true, enqueueStorageJob:async()=>{}, JOB_TYPES:{}, assertFirmContext:()=>{}, enforceTenantScope:()=>{}, CaseFile:{}, incrementTenantMetric:async()=>{}, getSession:async()=>({withTransaction:async(fn)=>fn(), endSession:async()=>{}}), getOrCreateDefaultClient:async()=>({clientId:'C000001', firmId:'firm-1'}),
    normalizeCreateInput:(b)=>b, validateStructuredInput:()=>{}, resolveAssigneeFromWorkbasketRules:async ({assignedTo})=>assignedTo||null,
    createNotification:async()=>{}, NotificationTypes:{}, fs:{}, fsSync:{}, logActivitySafe:async()=>{}, path:require('path'), PDFDocument:{}, loadCaseRecordCoalesced:async()=>null, buildCaseQuery:()=>({}), sanitizeForLog:(x)=>x, sanitizeOutput:(x)=>x, enforceDocketLifecycleDefault:()=>{}, buildAddCommentErrorResponse:()=>{}, computeDeadlineFromTatDays:()=>null, findScopedCaseAttachment:async()=>null, checkCaseAccess:async()=>true, writeDocketAudit:async()=>{}, docketAuditService:{logDocketEvent:async()=>{}, logCreation: async()=>{}},
  });

  const req = { body:{ title:'T', categoryId:'cat-1', subcategoryId:'sub-1', isInternal:true }, user:{ xID:'X1', firmId:'firm-1', email:'x1@test.com', name:'X1', role:'ADMIN' }, headers:{} };
  const res = mkRes();
  await svc.createCase(req,res);
  assert.strictEqual(captured.ownerTeamId, 'wb-mapped');
  assert.strictEqual(captured.workbasketId, 'wb-mapped');
  assert.strictEqual(captured.assignedToXID, null);
  assert.strictEqual(captured.state, 'IN_WB');
  assert.strictEqual(captured.queueType, 'GLOBAL');

  const req2 = { body:{ title:'T', categoryId:'cat-1', subcategoryId:'sub-1', assignedTo:'X2', isInternal:true }, user:{ xID:'X1', firmId:'firm-1', email:'x1@test.com', name:'X1', role:'ADMIN' }, headers:{} };
  await svc.createCase(req2,mkRes());
  assert.strictEqual(captured.ownerTeamId, 'wb-mapped');
  assert.strictEqual(captured.workbasketId, 'wb-mapped');
  assert.strictEqual(captured.assignedToXID, 'X2');
  console.log('case create category routing tests passed');
}

run().catch((e)=>{ console.error(e); process.exit(1); });
