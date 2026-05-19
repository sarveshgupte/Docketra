const assert = require('assert');
require.cache[require.resolve('../src/services/auditLog.service')] = { exports: { logCaseHistory: async () => {} } };
const buildService = require('../src/services/caseCreate.service');

function mkRes(){ return { statusCode: 200, body: null, status(c){ this.statusCode = c; return this; }, json(b){ this.body = b; return this; } }; }

function buildSvc({ relatedUser = null } = {}) {
  let captured = null;
  const Case = function(doc){ captured = doc; this.saveWithRetry = async () => {}; this.toObject = () => ({ ...doc, _id: '1', caseId: 'CASE-1' }); };
  const svc = buildService({
    mongoose: { Types: { ObjectId: { isValid: (v) => /^[a-f\d]{24}$/i.test(String(v || '')) } } },
    randomUUID: () => 'req-1', createHash: () => ({ update(){ return this; }, digest(){ return 'h'; } }),
    Case, Comment:{}, Attachment:{}, CaseHistory:{create:async()=>{}}, CaseAudit:{}, Client:{findOne:async()=>null},
    User:{ findOne: (q)=>({ select: ()=>({ lean: async ()=> {
      if (q?.xID) return null;
      if (!relatedUser) return null;
      if (String(relatedUser.firmId) !== String(q.firmId)) return null;
      if (String(relatedUser.status).toLowerCase() === 'deleted') return null;
      return relatedUser;
    } }) }) },
    Team:{findOne:()=>({sort:()=>({select:()=>({lean:async()=>({_id:'wb-fallback'})})})})}, WorkType:{}, SubWorkType:{}, CrmClient:{}, Deal:{}, Invoice:{},
    CaseRepository:{ findOne: async ()=>null }, ClientRepository:{findByClientId: async ()=>({status:'ACTIVE', firmId:'firm-1'})}, AttachmentRepository:{},
    categoryRepository:{ findActiveCategory: async ()=>({ name:'Tax', subcategories:[{id:'sub-1', name:'GST', isActive:true, workbasketId:'wb-mapped'}] }) },
    detectDuplicates:async()=>({}), generateDuplicateOverrideComment:()=>'', CASE_CATEGORIES:{}, CASE_LOCK_CONFIG:{}, COMMENT_PREVIEW_LENGTH:80, CLIENT_STATUS:{ACTIVE:'ACTIVE'},
    CaseStatus:{ASSIGNED:'ASSIGNED',UNASSIGNED:'UNASSIGNED'}, DocketLifecycle:{ACTIVE:'ACTIVE',CREATED:'CREATED'}, toLifecycleFromStatus:()=>null, normalizeLifecycle:()=>null, isValidState:()=>true, isValidTransition:()=>true, isProduction:false,
    logCaseListViewed:async()=>{}, logAdminAction:async()=>{}, caseActionService:{}, CaseService:{}, caseSlaService:{initializeCaseSla:async()=>({})}, slaService:{calculateSlaDueDate:async()=>null, calculateFallbackDueDateFromDays:()=>null},
    getMimeType:()=>'', sanitizeFilename:(x)=>x, cleanupTempFile:async()=>{}, resolveCaseIdentifier:()=>null, StorageProviderFactory:{}, areFileUploadsDisabled:()=>true, enqueueStorageJob:async()=>{}, JOB_TYPES:{}, assertFirmContext:()=>{}, enforceTenantScope:()=>{}, CaseFile:{}, incrementTenantMetric:async()=>{}, getSession:async()=>({withTransaction:async(fn)=>fn(), endSession:async()=>{}}), getOrCreateDefaultClient:async()=>({clientId:'C000001', firmId:'firm-1'}),
    normalizeCreateInput:(b)=>b, validateStructuredInput:()=>{}, resolveAssigneeFromWorkbasketRules:async ({assignedTo})=>assignedTo||null,
    createNotification:async()=>{}, NotificationTypes:{}, fs:{}, fsSync:{}, logActivitySafe:async()=>{}, path:require('path'), PDFDocument:{}, loadCaseRecordCoalesced:async()=>null, buildCaseQuery:()=>({}), sanitizeForLog:(x)=>x, sanitizeOutput:(x)=>x, enforceDocketLifecycleDefault:()=>{}, buildAddCommentErrorResponse:()=>{}, computeDeadlineFromTatDays:()=>null, findScopedCaseAttachment:async()=>null, checkCaseAccess:async()=>true, writeDocketAudit:async()=>{}, docketAuditService:{logDocketEvent:async()=>{}, logCreation:async()=>{}},
  });
  return { svc, getCaptured: () => captured };
}

async function createWith(body, relatedUser){
  const { svc, getCaptured } = buildSvc({ relatedUser });
  const res = mkRes();
  await svc.createCase({ body, user:{ xID:'X1', firmId:'firm-1', email:'x1@test.com', name:'X1', role:'ADMIN' }, headers:{} }, res);
  return { res, captured: getCaptured() };
}

(async () => {
  const base = { title:'T', categoryId:'cat-1', subcategoryId:'sub-1', isInternal:true };
  const activeUser = { _id:'507f1f77bcf86cd799439011', xID:'X000123', name:'Rahul', email:'r@test.com', status:'active', firmId:'firm-1' };
  const inactiveUser = { ...activeUser, _id:'507f1f77bcf86cd799439012', status:'disabled' };

  let out = await createWith(base, null);
  assert.strictEqual(out.res.statusCode, 201, 'create without related user should pass');

  out = await createWith({ ...base, relatedEmployeeUserId: activeUser._id }, activeUser);
  assert.strictEqual(out.res.statusCode, 201);
  assert.strictEqual(out.captured.relatedEmployeeUser.xID, 'X000123');

  out = await createWith({ ...base, relatedEmployeeUserId: inactiveUser._id }, inactiveUser);
  assert.strictEqual(out.res.statusCode, 201, 'inactive/deactivated should be allowed');

  out = await createWith({ ...base, relatedEmployeeUserId: 'bad-id' }, activeUser);
  assert.strictEqual(out.res.statusCode, 400, 'invalid user id should fail');

  out = await createWith({ ...base, relatedEmployeeUserId: activeUser._id }, { ...activeUser, status:'deleted' });
  assert.strictEqual(out.res.statusCode, 400, 'deleted user should fail');

  out = await createWith({ ...base, relatedEmployeeUserId: activeUser._id }, { ...activeUser, firmId:'firm-2' });
  assert.strictEqual(out.res.statusCode, 400, 'cross-firm user should fail');

  console.log('docket related employee/user create validations passed');
})().catch((e)=>{ console.error(e); process.exit(1); });
