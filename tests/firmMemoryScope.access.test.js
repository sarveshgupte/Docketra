#!/usr/bin/env node
const assert = require('assert');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);

const authMiddlewarePath = require.resolve('../src/middleware/auth.middleware');
const tenantIdentityServicePath = require.resolve('../src/services/tenantIdentity.service');
const createAppModulePath = require.resolve('../src/app/createApp');
const authzServicePath = require.resolve('../src/services/authorization.service');
const bcryptModulePath = require.resolve('bcrypt');
const clientRepoPath = require.resolve('../src/repositories/ClientRepository');
const crmClientPath = require.resolve('../src/models/CrmClient.model');
const knowledgePath = require.resolve('../src/models/KnowledgeItem.model');
const leadPath = require.resolve('../src/models/Lead.model');
const userPath = require.resolve('../src/models/User.model');
const casePath = require.resolve('../src/models/Case.model');

const restore = [];
const swap = (modulePath, exportsValue) => { restore.push({ modulePath, original: require.cache[modulePath] }); delete require.cache[modulePath]; require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue }; };

(async () => {
  swap(bcryptModulePath, { hash: async () => 'h', compare: async () => true, genSalt: async () => 's' });
  swap(tenantIdentityServicePath, { resolveCanonicalTenantFromFirmId: async (fid) => ({ tenantId: String(fid), status: 'active' }), resolveTenantBySlug: async()=>null });
  swap(authzServicePath, { resolveRequestFirmRole: async (req) => ({ role: req.user.role, permissions: ['CLIENT_VIEW','KNOWLEDGE_VIEW','CRM_VIEW'] }) });
  swap(authMiddlewarePath, { authenticate: (req,res,next)=>{ const mode=req.headers['x-test-role']||'admin'; if(mode==='nofirm'){ req.user={role:'USER'}; req.jwt={}; return next(); } if(mode==='superadmin'){ req.user={role:'SUPER_ADMIN'}; req.jwt={}; return next(); } if(mode==='manager-noscope'){ req.user={role:'MANAGER',firmId:'507f1f77bcf86cd799439011',clientAccess:[]}; req.jwt={firmId:req.user.firmId}; return next(); } if(mode==='manager-scoped'){ req.user={role:'MANAGER',firmId:'507f1f77bcf86cd799439011',clientAccess:['507f1f77bcf86cd799439101']}; req.jwt={firmId:req.user.firmId}; return next(); } req.user={role:'ADMIN',firmId:'507f1f77bcf86cd799439011'}; req.jwt={firmId:req.user.firmId}; return next(); } });

  swap(clientRepoPath, { find: async (_f, filter) => [{ _id:'507f1f77bcf86cd799439101', clientId:'C000001', businessName:'Scoped', businessEmail:'a@a.com', primaryContactNumber:'1', status:'active' }].filter(c=>!filter?true:(!filter._id || filter._id.$in.includes(c._id))), count: async()=>1 });
  swap(crmClientPath, { find: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [{ _id:'legacy1', firmId:'507f1f77bcf86cd799439011', name:'Legacy' }] }) }) }) }) });
  swap(knowledgePath, { KNOWLEDGE_ITEM_TYPES:['playbook'], KNOWLEDGE_ITEM_STATUSES:['draft','active'], find: (filter)=>({ sort:()=>({ skip:()=>({ limit:()=>({ lean:async()=> (filter.linkedClientId ? [{_id:'k1',linkedClientId:'507f1f77bcf86cd799439101'}] : [{_id:'k1'}]) }) }) }) }), countDocuments: async()=>1 });
  swap(leadPath, { find: (query)=>({ select:()=>({ sort:()=>({ skip:()=>({ limit:()=>({ lean: async()=> (query.$or ? [{_id:'l1',linkedClientId:'507f1f77bcf86cd799439101'}] : [{_id:'l1'}]) }) }) }) }) }) });
  swap(userPath, { find: () => ({ select: () => ({ lean: async () => [] }) }) });
  swap(casePath, { aggregate: async ()=>[] });

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  let res = await request(app).get('/api/clients').set('x-test-role','admin');
  assert.strictEqual(res.status,200); assert.ok(res.body.data.length>=1);

  res = await request(app).get('/api/clients').set('x-test-role','manager-noscope');
  assert.strictEqual(res.status,200); assert.deepStrictEqual(res.body.data,[]);

  // createApp currently mounts CRM relationships via /api/clients equivalent in this harness
  res = await request(app).get('/api/clients').set('x-test-role','manager-scoped');
  assert.strictEqual(res.status,200);

  res = await request(app).get('/api/leads').set('x-test-role','manager-noscope');
  assert.strictEqual(res.status,200); assert.deepStrictEqual(res.body.data,[]);

  res = await request(app).get('/api/leads').set('x-test-role','nofirm');
  assert.ok([400,401,403].includes(res.status));

  res = await request(app).get('/api/clients').set('x-test-role','superadmin');
  assert.ok([400,401,403].includes(res.status));

  console.log('firmMemoryScope.access.test.js passed');
})().catch((e)=>{console.error(e); process.exit(1);}).finally(()=>{ for (const {modulePath, original} of restore){ delete require.cache[modulePath]; if(original) require.cache[modulePath]=original; } delete require.cache[createAppModulePath]; });
