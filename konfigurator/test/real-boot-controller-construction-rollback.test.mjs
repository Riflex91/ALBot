import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBootResourceScope} from '../../src/runtime/boot-resource-scope.mjs';
import {createSkillWakeups} from '../../src/core/skill-wakeups.mjs';
import {createImpactIntents} from '../../src/combat/impact-intents.mjs';
import {createPotionReceipts} from '../../src/merchant/potion-receipts.mjs';
import {createCloudSync} from '../../src/world/cloud.mjs';
import {createPriorityScheduler} from '../../src/core/priority.mjs';
import {createTransport} from '../../src/party/transport.mjs';
import {auditRealRuntimeBootGraph} from '../../scripts/audit-config-restart-boot-graph.mjs';

function makeBot(){
 const active=new Map(),detached=[];
 let next=0;
 const ipc={
  onMessage(handler){
   const id=++next;active.set(id,{kind:'ipc',handler});
   return ()=>{active.delete(id);detached.push(id);};
  }
 };
 const p={root:{},ipc:true,headless:true,h:ipc,
  hook(name,handler){
   const id=++next;active.set(id,{kind:name,handler});
   return ()=>{active.delete(id);detached.push(id);};
  },
  realm:()=> 'EU1',c:{name:'Farmer_1'}};
 const bot={p,me:{name:'Farmer_1',group:'team',role:'farmer'},
  cfg:{characters:[{name:'Farmer_1',group:'team',role:'farmer',enabled:true}],
   merchant:{discoverOwnFarmers:false},
   party:{merchant:'Merchant_1',selection:'manual',maxFarmers:3},
   general:{transport:'ipc',messageTtlMs:6000}},
  session:'session-1',running:false};
 return {bot,active,detached};
}

test('actual closable controllers created during boot are released LIFO on a later construction failure',()=>{
 const scope=createBootResourceScope(),{bot,active,detached}=makeBot();
 let wake,impact,priority,transport,cloud;
 assert.throws(()=>scope.initialize(()=>{
  wake=scope.acquire('skill-wakeups',()=>createSkillWakeups({now:()=>1000}));
  wake.observe('attack',1800);
  scope.acquire('potion-receipts',()=>createPotionReceipts({
   session:bot.session,realm:bot.p.realm(),now:()=>1000}));
  impact=scope.acquire('impact-intents',()=>createImpactIntents({
   name:bot.me.name,session:bot.session,realm:bot.p.realm(),now:()=>1000}));
  impact.launched('attack',['monster-1']);
  cloud=scope.acquire('cloud-sync',()=>createCloudSync(bot));
  transport=scope.acquire('transport',()=>createTransport(bot));
  priority=scope.acquire('priority',()=>createPriorityScheduler(bot));
  priority.run([{id:'low',kind:'background',run:()=>true}]);
  assert.equal(active.size,2);
  throw Error('Injected real controller constructor failure');
 }),e=>{
  assert.equal(e.message,'Boot resource initialization aborted');
  assert.equal(e.cause.message,'Injected real controller constructor failure');
  assert.equal(e.rollbackComplete,true);return true;
 });
 assert.equal(active.size,0);
 assert.deepEqual(detached,[2,1]);
 assert.equal(wake.status().active,0);
 assert.equal(impact.snapshot().active,0);
 assert.equal(priority.status().waiting,0);
 assert.equal(scope.status().active,0);
 assert.deepEqual(scope.status().releaseOrder,[
  'priority','transport','cloud-sync','impact-intents',
  'potion-receipts','skill-wakeups'
 ]);
 assert.equal(scope.status().actualRollbackCertified,false);
 assert.equal(scope.status().applied,false);
 assert.equal(scope.status().acknowledged,false);
});

test('transport constructor failure after IPC subscription removes the original native handler',()=>{
 const {bot,active,detached}=makeBot();
 bot.p.hook=()=>{throw Error('CM native hook failed');};
 assert.throws(()=>createTransport(bot),/CM native hook failed/);
 assert.equal(active.size,0);
 assert.deepEqual(detached,[1]);
});

test('transport flags a failed partial rollback instead of falsely claiming cleanup',()=>{
 const {bot,active}=makeBot();
 bot.p.h.onMessage=handler=>{
  active.set(1,{kind:'ipc',handler});
  return ()=>{throw Error('native off failed');};
 };
 bot.p.hook=()=>{throw Error('native CM on failed');};
 assert.throws(()=>createTransport(bot),e=>
  e.message==='Transport initialization rollback incomplete'&&
  e.cause.registration.message==='native CM on failed'&&
  e.cause.rollback.message.startsWith('Transport listener cleanup incomplete'));
 assert.equal(active.size,1,'failed native disposer cannot be claimed removed');
});

test('normal transport close releases BOTH real listeners and remains idempotent',()=>{
 const {bot,active,detached}=makeBot();
 const transport=createTransport(bot);
 assert.equal(active.size,2);
 transport.close();
 assert.equal(active.size,0);
 assert.deepEqual(detached,[2,1]);
 transport.close();
 assert.deepEqual(detached,[2,1]);
});

test('real bootstrap routes all selected closeable factories through constructor rollback bracket',async()=>{
 const source=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
 const start=source.indexOf('const cleanup=createBootResourceScope()');
 const end=source.indexOf('  cleanup.initialize(()=>{\n  {const stop=p.watchChestOpened',start);
 assert.ok(start>0&&end>start,'construction and hook phases identified');
 const constructors=source.slice(start,end);
 assert.match(constructors,/cleanup\.initialize\(\(\)=>\{/);
 for(const [name,factory] of [
  ['skill-wakeups','createSkillWakeups'],
  ['potion-receipts','createPotionReceipts'],
  ['impact-intents','createImpactIntents'],
  ['cloud-sync','createCloudSync'],
  ['transport','createTransport'],
  ['priority','createPriorityScheduler']
 ])assert.ok(constructors.includes("cleanup.acquire('"+name+"',()=>"+factory+"("),
  'unowned real controller: '+name);
 assert.match(constructors,/bot\.rewards=createRewardMail\(bot\);\}\s*\}\);/);
 const disposal=source.slice(source.indexOf('dispose(){if(disposed)return;'));
 assert.match(disposal,/const released=cleanup\.close\(\)/);
 assert.doesNotMatch(disposal,/bot\.transport\.close\(\)/,
  'avoid double-closing native message subscriptions');
 const report=auditRealRuntimeBootGraph(source);
 assert.ok(report.factoryCount>=75);
 for(const slot of ['skillWakeups','potionReceipts','impactIntents',
  'cloud','transport','priority'])assert.ok(
  report.controllerFactories.some(x=>x.slot===slot),slot);
 assert.equal(report.actualRollbackCertified,false);
 assert.equal(report.restartAuthorized,false);
 assert.equal(report.applied,false);
});
