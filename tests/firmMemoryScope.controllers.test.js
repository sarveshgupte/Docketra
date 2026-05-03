#!/usr/bin/env node
const assert = require('assert');

const crmClientModelPath = require.resolve('../src/models/CrmClient.model');
const clientModelPath = require.resolve('../src/models/Client.model');
const leadModelPath = require.resolve('../src/models/Lead.model');
const userModelPath = require.resolve('../src/models/User.model');
const caseModelPath = require.resolve('../src/models/Case.model');
const scopeServicePath = require.resolve('../src/services/firmMemoryScope.service');
const crmControllerPath = require.resolve('../src/controllers/crmClient.controller');
const leadControllerPath = require.resolve('../src/controllers/lead.controller');

const restore=[]; const swap=(p,e)=>{restore.push([p,require.cache[p]]); delete require.cache[p]; require.cache[p]={id:p,filename:p,loaded:true,exports:e};};

(async()=>{
  let lastLeadQuery = null;
  swap(clientModelPath, { find: (q)=>({ sort:()=>({ skip:()=>({ limit:()=>({ lean:async()=> [{ _id:'c1', firmId:q.firmId, legacyCrmClientId:'legacy-scoped' }] }) }) }) }) });
  swap(crmClientModelPath, { find: ()=>({ sort:()=>({ skip:()=>({ limit:()=>({ lean:async()=> [{ _id:'legacy-scoped', name:'Scoped Legacy' }, { _id:'legacy-firmwide', name:'ShouldHide' }] }) }) }) }) });
  swap(userModelPath, { find: () => ({ select: () => ({ lean: async () => [] }) }) });
  swap(caseModelPath, { aggregate: async () => [] });
  swap(leadModelPath, { find: (q)=>{ lastLeadQuery=q; return { select:()=>({ sort:()=>({ skip:()=>({ limit:()=>({ lean: async()=> [] }) }) }) }) }; } });

  delete require.cache[scopeServicePath];
  const { resolveFirmMemoryScope } = require('../src/services/firmMemoryScope.service');
  assert.ok(typeof resolveFirmMemoryScope === 'function');

  delete require.cache[crmControllerPath];
  const { listCrmClients } = require('../src/controllers/crmClient.controller');
  delete require.cache[leadControllerPath];
  const { listLeads } = require('../src/controllers/lead.controller');

  const mkRes = () => ({ code:200, body:null, status(c){this.code=c; return this;}, json(v){this.body=v; return this;} });

  let req={ query:{}, user:{ role:'MANAGER', firmId:'f1', clientAccess:['c1'] } }; let res=mkRes();
  await listCrmClients(req,res);
  assert.equal(res.code,200);
  assert.equal(res.body.data.some((c)=>String(c._id||'')==='legacy-firmwide'), false);

  req={ query:{}, user:{ role:'ADMIN', firmId:'f1' } }; res=mkRes();
  await listCrmClients(req,res);
  assert.equal(res.code,200);
  assert.equal(res.body.data.some((c)=>String(c.legacyCrmClientId||c._id)==='legacy-firmwide'), true);

  req={ query:{ status:'new' }, user:{ role:'MANAGER', firmId:'f1', clientAccess:['c1'] } }; res=mkRes();
  await listLeads(req,res);
  assert.equal(res.code,200);
  assert.ok(lastLeadQuery.$and || lastLeadQuery.$or);

  console.log('firmMemoryScope.controllers.test.js passed');
})().catch((e)=>{console.error(e); process.exit(1);}).finally(()=>{ for (const [p,o] of restore){ delete require.cache[p]; if(o) require.cache[p]=o; } delete require.cache[crmControllerPath]; delete require.cache[leadControllerPath]; });
