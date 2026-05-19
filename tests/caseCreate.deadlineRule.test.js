const assert = require('assert');
const buildService = require('../src/services/caseCreate.service');
function mkRes(){ return { statusCode: 200, body:null, status(c){this.statusCode=c; return this;}, json(b){this.body=b; return this;} }; }
(async()=>{
 let captured=null;
 const Case=function(doc){captured=doc; this.saveWithRetry=async()=>{};};
 const svc=buildService({
  mongoose:{Types:{ObjectId:{isValid:()=>true}}},randomUUID:()=> 'r',createHash:()=>({update(){return this;},digest(){return 'h';}}),
  Case, Comment:{}, Attachment:{}, CaseHistory:{create:async()=>{}}, CaseAudit:{}, Client:{findOne:async()=>null}, User:{}, Team:{findOne:()=>({sort:()=>({select:()=>({lean:async()=>({_id:'wb'})})})})}, WorkType:{}, SubWorkType:{}, CrmClient:{}, Deal:{}, Invoice:{}, CaseRepository:{findOne:async()=>null}, ClientRepository:{findByClientId:async()=>({status:'ACTIVE'})}, AttachmentRepository:{},
  categoryRepository:{findActiveCategory: async()=>({name:'GST', subcategories:[{id:'s1', name:'GSTR-1', isActive:true, workbasketId:'wb', deadlineRule:{mode:'FIXED_DAY_NEXT_MONTH', fixedDayOfMonth:11, allowManualOverride:false}}]})},
  detectDuplicates:async()=>({}), generateDuplicateOverrideComment:()=>'', CASE_CATEGORIES:{}, CASE_LOCK_CONFIG:{}, COMMENT_PREVIEW_LENGTH:80, CLIENT_STATUS:{ACTIVE:'ACTIVE'},
  CaseStatus:{ASSIGNED:'ASSIGNED',UNASSIGNED:'UNASSIGNED'}, DocketLifecycle:{ACTIVE:'ACTIVE',CREATED:'CREATED'}, toLifecycleFromStatus:()=>null, normalizeLifecycle:()=>null, isValidState:()=>true, isValidTransition:()=>true, isProduction:false,
  logCaseListViewed:async()=>{}, logAdminAction:async()=>{}, caseActionService:{}, CaseService:{}, caseSlaService:{initializeCaseSla:async()=>({})}, slaService:{calculateSlaDueDate:async()=>null, calculateFallbackDueDateFromDays:()=>null}, getMimeType:()=>'', sanitizeFilename:(x)=>x, cleanupTempFile:async()=>{}, resolveCaseIdentifier:()=>null, StorageProviderFactory:{}, areFileUploadsDisabled:()=>true, enqueueStorageJob:async()=>{}, JOB_TYPES:{}, assertFirmContext:()=>{}, enforceTenantScope:()=>{}, CaseFile:{}, incrementTenantMetric:async()=>{}, getSession:async()=>({withTransaction:async(fn)=>fn(), endSession:async()=>{}}), getOrCreateDefaultClient:async()=>null, normalizeCreateInput:(b)=>b, validateStructuredInput:()=>{}, resolveAssigneeFromWorkbasketRules:async()=>null, createNotification:async()=>{}, NotificationTypes:{}, fs:{}, fsSync:{}, logActivitySafe:async()=>{}, path:require('path'), PDFDocument:{}, loadCaseRecordCoalesced:async()=>null, buildCaseQuery:()=>({}), sanitizeForLog:(x)=>x, sanitizeOutput:(x)=>x, enforceDocketLifecycleDefault:()=>{}, buildAddCommentErrorResponse:()=>{}, computeDeadlineFromTatDays:()=>null, findScopedCaseAttachment:async()=>null, checkCaseAccess:async()=>true, writeDocketAudit:async()=>{}, docketAuditService:{logDocketEvent:async()=>{}},
 });
 await svc.createCase({body:{title:'x',categoryId:'c1',subcategoryId:'s1'},user:{xID:'U1',firmId:'f1'}},mkRes());
 assert.ok(captured.dueDate);
 assert.strictEqual(new Date(captured.dueDate).getUTCDate(),11);
 console.log('case create deadline rule test passed');
})();
