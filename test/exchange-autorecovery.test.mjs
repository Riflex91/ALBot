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
