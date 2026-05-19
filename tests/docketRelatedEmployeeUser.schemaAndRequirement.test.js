const assert = require('assert');
const fs = require('fs');
const path = require('path');
require.cache[require.resolve('../src/services/auditLog.service')] = { exports: { logCaseHistory: async () => {} } };
const buildService = require('../src/services/caseCreate.service');

const schemaSource = fs.readFileSync(path.join(__dirname, '..', 'src/schemas/case.routes.schema.js'), 'utf8');
assert(schemaSource.includes('relatedEmployeeUserId: objectIdString.optional()'), 'createCase schema should allow relatedEmployeeUserId');
assert(schemaSource.includes("'GET /eligible-users': { query: strictEmpty }"), 'route schema should include GET /eligible-users');

function mkRes(){ return { statusCode: 200, body:null, status(c){ this.statusCode=c; return this;}, json(b){ this.body=b; return this; } }; }

function mkSvc({ categoryRequires = false, subcategoryRequires = false, relatedUser = null } = {}) {
  const Case = function(doc){ this.doc = doc; this.saveWithRetry = async()=>{}; this.toObject = ()=>({ ...doc, _id:'1', caseId:'CASE-1' }); };
  return buildService({
    mongoose: { Types: { ObjectId: { isValid: (v) => /^[a-f\d]{24}$/i.test(String(v || '')) } } },
    randomUUID: ()=>'req-1', createHash:()=>({update(){return this;}, digest(){return 'h';}}),
    Case, Comment:{}, Attachment:{}, CaseHistory:{create:async()=>{}}, CaseAudit:{}, Client:{findOne:async()=>null},
    User:{ findOne: ()=>({ select: ()=>({ lean: async()=> relatedUser }) }) },
    Team:{findOne:()=>({sort:()=>({select:()=>({lean:async()=>({_id:'wb'})})})})}, WorkType:{}, SubWorkType:{}, CrmClient:{}, Deal:{}, Invoice:{},
    CaseRepository:{findOne:async()=>null}, ClientRepository:{findByClientId:async()=>({status:'ACTIVE', firmId:'firm-1'})}, AttachmentRepository:{},
    categoryRepository:{ findActiveCategory: async()=>({ _id:'cat1', name:'HR', requiresRelatedEmployeeUser: categoryRequires, subcategories:[{ id:'sub1', name:'Payroll', isActive:true, workbasketId:'wb', requiresRelatedEmployeeUser: subcategoryRequires }] }) },
    detectDuplicates:async()=>({}), generateDuplicateOverrideComment:()=>'', CASE_CATEGORIES:{}, CASE_LOCK_CONFIG:{}, COMMENT_PREVIEW_LENGTH:80, CLIENT_STATUS:{ACTIVE:'ACTIVE'},
    CaseStatus:{ASSIGNED:'ASSIGNED',UNASSIGNED:'UNASSIGNED'}, DocketLifecycle:{ACTIVE:'ACTIVE',CREATED:'CREATED'}, toLifecycleFromStatus:()=>null, normalizeLifecycle:()=>null, isValidState:()=>true, isValidTransition:()=>true, isProduction:false,
    logCaseListViewed:async()=>{}, logAdminAction:async()=>{}, caseActionService:{}, CaseService:{}, caseSlaService:{initializeCaseSla:async()=>({})}, slaService:{calculateSlaDueDate:async()=>null, calculateFallbackDueDateFromDays:()=>null},
    getMimeType:()=>'', sanitizeFilename:(x)=>x, cleanupTempFile:async()=>{}, resolveCaseIdentifier:()=>null, StorageProviderFactory:{}, areFileUploadsDisabled:()=>true, enqueueStorageJob:async()=>{}, JOB_TYPES:{}, assertFirmContext:()=>{}, enforceTenantScope:()=>{}, CaseFile:{}, incrementTenantMetric:async()=>{}, getSession:async()=>({withTransaction:async(fn)=>fn(), endSession:async()=>{}}), getOrCreateDefaultClient:async()=>({clientId:'C000001', firmId:'firm-1'}),
    normalizeCreateInput:(b)=>b, validateStructuredInput:()=>{}, resolveAssigneeFromWorkbasketRules:async({assignedTo})=>assignedTo||null,
    createNotification:async()=>{}, NotificationTypes:{}, fs:{}, fsSync:{}, logActivitySafe:async()=>{}, path:require('path'), PDFDocument:{}, loadCaseRecordCoalesced:async()=>null, buildCaseQuery:()=>({}), sanitizeForLog:(x)=>x, sanitizeOutput:(x)=>x, enforceDocketLifecycleDefault:()=>{}, buildAddCommentErrorResponse:()=>{}, computeDeadlineFromTatDays:()=>null, findScopedCaseAttachment:async()=>null, checkCaseAccess:async()=>true, writeDocketAudit:async()=>{}, docketAuditService:{logDocketEvent:async()=>{}, logCreation:async()=>{}},
  });
}

(async () => {
  const baseReq = { body:{ title:'T', categoryId:'cat1', subcategoryId:'sub1', isInternal:true }, user:{ xID:'X1', firmId:'firm-1', email:'x@test.com', role:'ADMIN' }, headers:{} };

  let svc = mkSvc({ categoryRequires: true, relatedUser: null });
  let res = mkRes();
  await svc.createCase(baseReq, res);
  assert.strictEqual(res.statusCode, 400, 'required category should block missing related employee/user');

  svc = mkSvc({ subcategoryRequires: true, relatedUser: { _id:'507f1f77bcf86cd799439011', xID:'X000123', name:'Rahul', email:'r@test.com', status:'disabled' } });
  res = mkRes();
  await svc.createCase({ ...baseReq, body: { ...baseReq.body, relatedEmployeeUserId:'507f1f77bcf86cd799439011' } }, res);
  assert.strictEqual(res.statusCode, 201, 'required category/subcategory should allow valid active/inactive user');

  svc = mkSvc({ categoryRequires: false, subcategoryRequires: false, relatedUser: null });
  res = mkRes();
  await svc.createCase(baseReq, res);
  assert.strictEqual(res.statusCode, 201, 'optional category should allow blank related employee/user');

  console.log('docket related employee/user schema + requirement checks passed');
})().catch((e)=>{ console.error(e); process.exit(1); });
