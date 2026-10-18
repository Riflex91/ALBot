import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecovery,inspectExchangeRecovery} from '../src/core/recovery.mjs';
import {fingerprint} from '../src/core/policy.mjs';
function fixture(){
 const before=[{name:'candy1',level:0,q:16},{name:'scroll0',level:0,q:2},null,null];
 const items=[{name:'candy1',level:0,q:15},{name:'scroll0',level:0,q:2},{name:'smoke',level:0,q:1},null];
 const journal={kind:'exchange',item:'candy1',quantity:1,before:16,
  at:100000,slots:[[0,fingerprint(before[0])]],cost:0,loss:14400,
  evidence:{gold:287700,realm:'USIV',inventory:before.map(i=>i?fingerprint(i):null)}};
 const events=[];
 const bot={p:{c:{gold:287700,items,q:{}},G:{drops:{candy1:[[1,'smoke',1]]}},
   realm:()=> 'USIV'},me:{name:'My_Merchant',role:'merchant'},
  cfg:{party:{merchant:'My_Merchant'},general:{messageTtlMs:10000}},
  journal,inventoryBlocked:true,exec:{pending:new Map()},
  checkpoint:{durable:true},transport:{peers:new Map()},
  event:(type,data)=>events.push({type,data}),endValue(result){
   assert.equal(result,'confirmed');this.journal=null;this.inventoryBlocked=false;
  },report(){}};
 return {bot,events,before};
}
test('exact exchange candy1 -> known smoke is verified with two stable after snapshots',()=>{
 const {bot,events}=fixture(),old=Date.now;let now=103000;Date.now=()=>now;
 try{
  const audit=inspectExchangeRecovery(bot);
  assert.equal(audit.eligible,true);
  assert.equal(audit.consumed,1);
  assert.deepEqual(audit.rewards,[{item:'smoke',quantity:1}]);
  const recovery=createRecovery(bot);
  assert.equal(recovery.reconcile(),false,'first observation must not clear journal');
  now+=999;assert.equal(recovery.reconcile(),false);
  now+=1;assert.equal(recovery.reconcile(),true);
  assert.equal(bot.journal,null);assert.equal(bot.inventoryBlocked,false);
  assert.equal(events.filter(x=>x.type==='recovery.exchangeVerified').length,1);
 }finally{Date.now=old;}
});
test('missing reward, changed gold, missing official drop table or unrelated loss never clears value journal',()=>{
 for(const mutate of [
  b=>{b.p.c.items[2]=null;},
  b=>{b.p.c.gold++;},
  b=>{b.p.G.drops={};},
  b=>{b.p.c.items[1]=null;},
  b=>{b.p.c.items[2]={name:'unrelated',level:0,q:1};},
  b=>{b.p.c.items[0].q=14;},
  b=>{b.exec.pending.set('exchange',{});},
  b=>{b.p.c.q.exchange={};},
  b=>{b.checkpoint.durable=false;},
  b=>{b.journal.slots[0][1]='corrupt';}
 ]){
  const {bot}=fixture();mutate(bot);
  assert.equal(inspectExchangeRecovery(bot).eligible,false);
  const recovery=createRecovery(bot);
  assert.equal(recovery.reconcile(),false);
  assert.ok(bot.journal);assert.equal(bot.inventoryBlocked,true);
 }
});
test('inventory changes between stable probes restart the exchange confirmation clock',()=>{
 const {bot}=fixture(),old=Date.now;let now=103000;Date.now=()=>now;
 try{
  const recovery=createRecovery(bot);
  assert.equal(recovery.reconcile(),false);
  now+=800;bot.p.c.items[3]=bot.p.c.items[2];bot.p.c.items[2]=null;
  assert.equal(recovery.reconcile(),false);
  now+=300;assert.equal(recovery.reconcile(),false);
  now+=700;assert.equal(recovery.reconcile(),true);
 }finally{Date.now=old;}
});
test('non-exchange journals do not inherit exchange auto-confirmation',()=>{
 const {bot}=fixture();bot.journal.kind='send';
 assert.equal(inspectExchangeRecovery(bot).eligible,false);
});

test('live 1047->1046 anniversarygift and +20000 gold clears stale journal without replay',()=>{
 const {bot,events}=fixture(),old=Date.now;let now=1792268750000;
 const before=Array(42).fill(null);
 before[9]={name:'anniversarygift',q:1047};
 const after=Array(42).fill(null);
 after[9]={name:'anniversarygift',q:1046};
 bot.journal={kind:'exchange',item:'anniversarygift',quantity:1,before:1047,
  at:1792268717316,slots:[[9,fingerprint(before[9])]],cost:0,loss:60,
  evidence:{gold:210000,realm:'USIV',
   inventory:before.map(x=>x?fingerprint(x):null)}};
 bot.p.c.items=after;bot.p.c.gold=230000;
 bot.p.G.drops.anniversarygift=[
  [608910,'gold',5000],[200000,'gold',20000],
  [190000,'open','anniversary_legacy'],[990,'open','anniversary_equipment']
 ];
 bot.p.G.drops.anniversary_legacy=[[1,'cake']];
 bot.p.G.drops.anniversary_equipment=[[1,'candleward']];
 bot.endValue=result=>{
  assert.equal(result,'confirmed');bot.inventoryBlocked=false;bot.journal=null;
 };
 const action=()=>assert.fail('Reconciliation must not send another exchange request');
 bot.p.call=action;
 Date.now=()=>now;
 try{
  const audit=inspectExchangeRecovery(bot);
  assert.equal(audit.eligible,true,JSON.stringify(audit));
  assert.deepEqual(audit.rewards,[{item:'gold',quantity:20000}]);
  const recover=createRecovery(bot);
  assert.equal(recover.reconcile(),false);
  now+=1000;
  assert.equal(recover.reconcile(),true);
  assert.equal(bot.inventoryBlocked,false);
  assert.equal(bot.journal,null);
  assert.equal(events.filter(x=>x.type==='recovery.exchangeVerified').length,1);
 }finally{Date.now=old;}
});
test('a gold increase only clears exchange journal when ONE exact official payout and no other mutation',()=>{
 const f=fixture(),bot=f.bot;
 const before=Array(42).fill(null);before[9]={name:'anniversarygift',q:1047};
 const after=Array(42).fill(null);after[9]={name:'anniversarygift',q:1046};
 bot.journal={kind:'exchange',item:'anniversarygift',quantity:1,
  at:1792268717316,slots:[[9,fingerprint(before[9])]],cost:0,loss:60,
  evidence:{realm:'USIV',gold:210000,inventory:before.map(x=>x?fingerprint(x):null)}};
 bot.p.G.drops.anniversarygift=[[1,'gold',20000],[1,'gold',5000],[1,'cake']];
 bot.p.c.items=after;bot.p.c.gold=230001;
 assert.equal(inspectExchangeRecovery(bot).eligible,false,'unlisted gold increment');
 bot.p.c.gold=230000;bot.p.c.items[15]={name:'cake'};
 assert.equal(inspectExchangeRecovery(bot).eligible,false,'unrelated item cannot be counted as same payout');
 bot.p.c.items[15]=null;bot.p.c.items[9].q=1045;
 assert.equal(inspectExchangeRecovery(bot).eligible,false,'double consumption');
 bot.p.c.items[9].q=1046;bot.p.c.gold=209999;
 assert.equal(inspectExchangeRecovery(bot).eligible,false,'gold loss is not an exchange reward');
});

test('consumed but unverifiable exchange is archived after stable live snapshots, never replayed',()=>{
 const {bot,events}=fixture();const old=Date.now;let now=200000;
 // The server demonstrably consumed one source, but the drop table is not
 // currently available after boot. Local inventory is authoritative; an
 // unknown output is never marked confirmed or redispatched.
 bot.p.G.drops={};
 bot.p.write=()=>true;
 let cleared=0;
 bot.checkpoint.clear=()=>{cleared++;return true;};
 bot.p.call=()=>assert.fail('No original exchange replay is allowed');
 Date.now=()=>now;
 try{
  const r=createRecovery(bot);
  assert.equal(r.reconcile(),false,'first snapshot is not sufficient');
  now+=4000;assert.equal(r.reconcile(),false,'stability lease not finished');
  now+=1000;assert.equal(r.reconcile(),true);
  assert.equal(cleared,1);
  assert.equal(bot.inventoryBlocked,false);
  assert.equal(bot.journal,null);
  assert.equal(events.filter(x=>x.type==='recovery.exchangeUnconfirmedReleased').length,1);
  assert.equal(events.filter(x=>x.type==='recovery.exchangeVerified').length,0);
 }finally{Date.now=old;}
});
test('no value checkpoint is discarded if source was not consumed or archive cannot be written',()=>{
 for(const modify of [
  bot=>{bot.p.c.items[0].q=16;},
  bot=>{bot.p.c.q.exchange={};},
  bot=>{bot.p.write=()=>false;},
  bot=>{bot.checkpoint.clear=()=>false;}
 ]){
  const {bot}=fixture(),old=Date.now;let now=200000;
  bot.p.G.drops={};bot.p.write=()=>true;
  bot.checkpoint.clear=()=>true;
  modify(bot);
  Date.now=()=>now;
  try{const r=createRecovery(bot);
   assert.equal(r.reconcile(),false);
   now+=6000;
   assert.equal(r.reconcile(),false);
   assert.ok(bot.journal);assert.equal(bot.inventoryBlocked,true);
  }finally{Date.now=old;}
 }
});

test('live 1008 anniversary gifts untouched and distance-rejected: release after 120s and stable gold/inventory without replay',()=>{
 const {bot,events}=fixture(),old=Date.now;
 const before=Array(42).fill(null);
 before[9]={name:'anniversarygift',level:0,q:1008};
 before[27]={name:'monstertoken',level:0,q:2};
 let now=1792308793536+121000;
 bot.journal={kind:'exchange',item:'anniversarygift',quantity:1,
  before:1008,at:1792308793536,slots:[[9,fingerprint(before[9])]],
  loss:60,cost:0,evidence:{realm:'USIV',gold:210000,
   inventory:before.map(i=>i?fingerprint(i):null)}};
 bot.p.c.items=structuredClone(before);bot.p.c.gold=210000;
 let archives=[],cleared=0,actions=0;
 bot.p.write=(key,value)=>{archives.push({key,value});return true;};
 bot.checkpoint.clear=()=>{cleared++;return true;};
 bot.p.call=()=>{actions++;throw Error('never redispatch a pending exchange');};
 Date.now=()=>now;
 try{
  const recovery=createRecovery(bot);
  assert.equal(recovery.reconcile(),false,'first full snapshot only');
  now+=4999;assert.equal(recovery.reconcile(),false,'stability requires 5s');
  now+=1;assert.equal(recovery.reconcile(),true);
  assert.equal(actions,0);
  assert.equal(cleared,1);
  assert.equal(bot.journal,null);
  assert.equal(bot.inventoryBlocked,false);
  assert.equal(archives.length,1);
  assert.equal(archives[0].value.status,'unchanged-unverified-no-replay');
  assert.equal(events.filter(e=>e.type==='recovery.exchangeUnchangedReleased').length,1);
  assert.equal(events.filter(e=>e.type==='recovery.exchangeVerified').length,0);
 }finally{Date.now=old;}
});
test('unchanged exchange is never released if delayed, modified, pending or durable archive cannot persist',()=>{
 const old=Date.now;
 for(const mutation of [
  b=>{b.p.c.gold++;},
  b=>{b.p.c.items[0].q++;},
  b=>{b.p.c.items[1]={name:'reward',q:1};},
  b=>{b.exec.pending.set('exchange',{});},
  b=>{b.p.c.q.exchange={};},
  b=>{b.checkpoint.durable=false;},
  b=>{b.p.write=()=>false;},
  b=>{b.checkpoint.clear=()=>false;},
  b=>{b.journal.slots[0][1]='wrong-source';}
 ]){
  let now=230000;
  const {bot,before}=fixture();
  bot.p.c.items=structuredClone(before);
  bot.p.write=()=>true;bot.checkpoint.clear=()=>true;
  mutation(bot);Date.now=()=>now;
  try{
   const r=createRecovery(bot);
   assert.equal(r.reconcile(),false);
   now+=6000;assert.equal(r.reconcile(),false);
   assert.equal(bot.inventoryBlocked,true);
   assert.ok(bot.journal);
  }finally{Date.now=old;}
 }
 const {bot}=fixture();bot.p.c.items=structuredClone([{
  name:'candy1',level:0,q:16},{name:'scroll0',level:0,q:2},null,null]);
 bot.p.write=()=>true;bot.checkpoint.clear=()=>true;
 let now=100000+119999;Date.now=()=>now;
 try{
  const r=createRecovery(bot);assert.equal(r.reconcile(),false);
  now+=1;assert.equal(r.reconcile(),false,'first observation after 120s');
  assert.ok(bot.journal);
 }finally{Date.now=old;}
});
