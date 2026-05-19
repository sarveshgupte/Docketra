const assert = require('assert');
require.cache[require.resolve('../src/services/auditLog.service')] = { exports: { logCaseHistory: async () => {} } };
const buildService = require('../src/services/caseCreate.service');
function mkRes(){ return { statusCode:200, status(c){this.statusCode=c;return this;}, json(b){this.body=b;return this;} }; }
(async () => {
  let captured = null;
  const Case = function(doc){ captured = doc; this.saveWithRetry = async ()=>{}; this.toObject=()=>({...doc,_id:'1'}); };
  const svc = buildService({
    mongoose:{ Types:{ ObjectId:{ isValid:()=>true } } }, randomUUID:()=> 'rid', createHash:()=>({update(){return this;},digest(){return 'h';}}),
    Case, Comment:{}, Attachment:{}, CaseHistory:{create:async()=>{}}, CaseAudit:{}, Client:{findOne:async()=>null}, User:{}, Team:{findOne:()=>({sort:()=>({select:()=>({lean:async()=>({_id:'wb'})})})})}, WorkType:{}, SubWorkType:{}, CrmClient:{}, Deal:{}, Invoice:{},
    CaseRepository:{findOne:async()=>null}, ClientRepository:{findByClientId:async()=>({status:'ACTIVE',firmId:'firm-1'})}, AttachmentRepository:{},
    categoryRepository:{findActiveCategory:async()=>({name:'Tax',subcategories:[{id:'s1',name:'GST',isActive:true,workbasketId:'wb',checklistTemplate:[{id:'t1',title:'Collect docs',required:true,dueOffsetDays:1}]}]})},
    detectDuplicates:async()=>({}), generateDuplicateOverrideComment:()=>'', CASE_CATEGORIES:{}, CASE_LOCK_CONFIG:{}, COMMENT_PREVIEW_LENGTH:80, CLIENT_STATUS:{ACTIVE:'ACTIVE'},
    CaseStatus:{ASSIGNED:'ASSIGNED',UNASSIGNED:'UNASSIGNED'}, DocketLifecycle:{ACTIVE:'ACTIVE',CREATED:'CREATED'}, toLifecycleFromStatus:()=>null, normalizeLifecycle:()=>null, isValidState:()=>true, isValidTransition:()=>true, isProduction:false,
    logCaseListViewed:async()=>{}, logAdminAction:async()=>{}, caseActionService:{}, CaseService:{}, caseSlaService:{initializeCaseSla:async()=>({})}, slaService:{calculateSlaDueDate:async()=>null, calculateFallbackDueDateFromDays:()=>null},
    getMimeType:()=>'', sanitizeFilename:(x)=>x, cleanupTempFile:async()=>{}, resolveCaseIdentifier:()=>null, StorageProviderFactory:{}, areFileUploadsDisabled:()=>true, enqueueStorageJob:async()=>{}, JOB_TYPES:{}, assertFirmContext:()=>{}, enforceTenantScope:()=>{}, CaseFile:{}, incrementTenantMetric:async()=>{}, getSession:async()=>({withTransaction:async(fn)=>fn(), endSession:async()=>{}}), getOrCreateDefaultClient:async()=>({clientId:'C1',firmId:'firm-1'}), normalizeCreateInput:(b)=>b, validateStructuredInput:()=>{}, resolveAssigneeFromWorkbasketRules:async()=>null,
    createNotification:async()=>{}, NotificationTypes:{}, fs:{}, fsSync:{}, logActivitySafe:async()=>{}, path:require('path'), PDFDocument:{}, loadCaseRecordCoalesced:async()=>null, buildCaseQuery:()=>({}), sanitizeForLog:(x)=>x, sanitizeOutput:(x)=>x, enforceDocketLifecycleDefault:()=>{}, buildAddCommentErrorResponse:()=>{}, computeDeadlineFromTatDays:()=>null, findScopedCaseAttachment:async()=>null, checkCaseAccess:async()=>true, writeDocketAudit:async()=>{}, docketAuditService:{logDocketEvent:async()=>{}, logCreation:async()=>{}},
  });
  await svc.createCase({body:{title:'A',categoryId:'c1',subcategoryId:'s1',isInternal:true},user:{xID:'U1',firmId:'firm-1',email:'u@test.com',name:'U1',role:'ADMIN'},headers:{}},mkRes());
  assert.strictEqual(captured.checklist.length, 1);
  assert.strictEqual(captured.checklist[0].templateItemId, 't1');
  assert.strictEqual(captured.checklist[0].completed, false);
  console.log('checklist snapshot ok');
})();
