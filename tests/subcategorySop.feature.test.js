const assert = require('assert');
const Category = require('../src/models/Category.model');
const categoryRouteSchemas = require('../src/schemas/category.routes.schema');
const adminRouteSchemas = require('../src/schemas/admin.routes.schema');
const { serializeDocketDetailDto } = require('../src/serializers/docketDetail.serializer');

require.cache[require.resolve('../src/services/auditLog.service')] = { exports: { logCaseHistory: async () => {} } };
const buildService = require('../src/services/caseCreate.service');

function mkRes(){ return { statusCode: 200, body:null, status(c){this.statusCode=c; return this;}, json(b){this.body=b; return this;} }; }

(async () => {
  const category = new Category({ firmId: '507f1f77bcf86cd799439011', name: 'Tax', subcategories: [{ id: 's1', name: 'GST', workbasketId: '507f1f77bcf86cd799439012' }] });
  assert.strictEqual(category.subcategories[0].sop.title, '');
  assert.strictEqual(category.subcategories[0].sop.body, '');
  assert.strictEqual(category.subcategories[0].sop.format, 'plain_text');

  category.subcategories[0].sop.title = 'x'.repeat(201);
  let err = category.validateSync();
  assert.ok(err);
  category.subcategories[0].sop.title = 'ok';
  category.subcategories[0].sop.body = 'x'.repeat(10001);
  err = category.validateSync();
  assert.ok(err);
  category.subcategories[0].sop.body = 'ok';
  category.subcategories[0].sop.format = 'html';
  err = category.validateSync();
  assert.ok(err);

  const payload = { name: 'GST', workbasketId: '507f1f77bcf86cd799439012', deadlineRule: { mode: 'NONE' }, checklistTemplate: [], sop: { title: 'Runbook', body: 'Do A', format: 'markdown' } };
  assert.ok(categoryRouteSchemas['POST /:id/subcategories'].body.parse(payload));
  assert.ok(adminRouteSchemas['POST /categories/:id/subcategories'].body.parse(payload));

  let captured = null;
  const Case = function(doc){ captured = doc; this.saveWithRetry = async () => {}; this.toObject = () => ({...doc, _id: '1'}); };
  const svc = buildService({ mongoose:{Types:{ObjectId:{isValid:()=>true}}},randomUUID:()=> 'r',createHash:()=>({update(){return this;},digest(){return 'h';}}),
    Case, Comment:{}, Attachment:{}, CaseHistory:{create:async()=>{}}, CaseAudit:{}, Client:{findOne:async()=>null}, User:{}, Team:{findOne:()=>({sort:()=>({select:()=>({lean:async()=>({_id:'wb'})})})})}, WorkType:{}, SubWorkType:{}, CrmClient:{}, Deal:{}, Invoice:{}, CaseRepository:{findOne:async()=>null}, ClientRepository:{findByClientId:async()=>({status:'ACTIVE', firmId:'f1'})}, AttachmentRepository:{},
    categoryRepository:{findActiveCategory: async()=>({name:'GST', subcategories:[{id:'s1', name:'GSTR-1', isActive:true, workbasketId:'wb', deadlineRule:{mode:'NONE', allowManualOverride:true}, checklistTemplate:[{id:'c1', title:'Check'}], sop:{title:'SOP', body:'Steps', format:'markdown'}}]})},
    detectDuplicates:async()=>({}), generateDuplicateOverrideComment:()=>'', CASE_CATEGORIES:{}, CASE_LOCK_CONFIG:{}, COMMENT_PREVIEW_LENGTH:80, CLIENT_STATUS:{ACTIVE:'ACTIVE'},
    CaseStatus:{ASSIGNED:'ASSIGNED',UNASSIGNED:'UNASSIGNED'}, DocketLifecycle:{ACTIVE:'ACTIVE',CREATED:'CREATED'}, toLifecycleFromStatus:()=>null, normalizeLifecycle:()=>null, isValidState:()=>true, isValidTransition:()=>true, isProduction:false,
    logCaseListViewed:async()=>{}, logAdminAction:async()=>{}, caseActionService:{}, CaseService:{}, caseSlaService:{initializeCaseSla:async()=>({})}, slaService:{calculateSlaDueDate:async()=>null, calculateFallbackDueDateFromDays:()=>null}, getMimeType:()=>'', sanitizeFilename:(x)=>x, cleanupTempFile:async()=>{}, resolveCaseIdentifier:()=>null, StorageProviderFactory:{}, areFileUploadsDisabled:()=>true, enqueueStorageJob:async()=>{}, JOB_TYPES:{}, assertFirmContext:()=>{}, enforceTenantScope:()=>{}, CaseFile:{}, incrementTenantMetric:async()=>{}, getSession:async()=>({withTransaction:async(fn)=>fn(), endSession:async()=>{}}), getOrCreateDefaultClient:async()=>({clientId:'C000001', firmId:'f1'}), normalizeCreateInput:(b)=>b, validateStructuredInput:()=>{}, resolveAssigneeFromWorkbasketRules:async()=>null, createNotification:async()=>{}, NotificationTypes:{}, fs:{}, fsSync:{}, logActivitySafe:async()=>{}, path:require('path'), PDFDocument:{}, loadCaseRecordCoalesced:async()=>null, buildCaseQuery:()=>({}), sanitizeForLog:(x)=>x, sanitizeOutput:(x)=>x, enforceDocketLifecycleDefault:()=>{}, buildAddCommentErrorResponse:()=>{}, computeDeadlineFromTatDays:()=>null, findScopedCaseAttachment:async()=>null, checkCaseAccess:async()=>true, writeDocketAudit:async()=>{}, docketAuditService:{logDocketEvent:async()=>{}, logCreation: async()=>{}},
  });
  await svc.createCase({body:{title:'x',categoryId:'c1',subcategoryId:'s1',isInternal:true},user:{xID:'U1',firmId:'f1',email:'u1@test.com',name:'U1',role:'ADMIN'},headers:{}},mkRes());
  assert.strictEqual(captured.sopSnapshot.title, 'SOP');
  assert.strictEqual(captured.sopSnapshot.body, 'Steps');
  assert.strictEqual(captured.sopSnapshot.sourceSubcategoryId, 's1');
  assert.ok(Array.isArray(captured.checklist));

  const dto = serializeDocketDetailDto({ caseObject: { sopSnapshot: captured.sopSnapshot, checklist: [] } });
  assert.strictEqual(dto.sop.title, 'SOP');
  assert.strictEqual(dto.sop.format, 'markdown');

  console.log('subcategory sop feature tests passed');
})();
