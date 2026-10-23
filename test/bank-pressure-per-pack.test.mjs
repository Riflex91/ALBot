import test from 'node:test';
import assert from 'node:assert/strict';
import {bankCapacityPressure,createBank} from '../src/merchant/bank.mjs';

const pack=(map,free)=>({map,items:Array.from({length:42},(_,i)=>
 i<42-free?{name:'locked',l:true}:null)});

test('per-pack workspace threshold: two unusable packs cannot pool free slots',()=>{
 const decision=bankCapacityPressure([pack('bank',2),pack('bank',2)],2,'bank');
 assert.deepEqual(decision,{pressed:true,locallyBlocked:true,usablePacks:0});
 assert.equal(bankCapacityPressure([pack('bank',3)],2,'bank').pressed,false);
 assert.equal(bankCapacityPressure([pack('bank',2),pack('bank_b',3)],2,'bank').pressed,false);
});
test('reclaim pressure threshold includes exactly the protected workspace size',()=>{
 assert.equal(bankCapacityPressure([pack('bank',2)],2,'bank').pressed,true);
 assert.equal(bankCapacityPressure([pack('bank',1)],2,'bank').pressed,true);
 assert.equal(bankCapacityPressure([pack('bank',0)],2,'bank').pressed,true);
 assert.equal(bankCapacityPressure([pack('bank',3)],2,'bank').pressed,false);
 assert.equal(bankCapacityPressure([],2,'bank').pressed,false);
 assert.equal(bankCapacityPressure([pack('bank_b',0)],2,'bank').pressed,false);
});
test('malformed bank pressure input cannot authorize an irreversible reclaim',()=>{
 assert.equal(bankCapacityPressure(null,2,'bank').pressed,false);
 assert.equal(bankCapacityPressure([{map:'bank',items:42}],2,'bank').pressed,false);
 assert.equal(bankCapacityPressure([pack('bank',1)],-1,'bank').pressed,false);
});
function merchantBank({localPacks=2,remoteFree=null}={}){
 const rows=Object.fromEntries(Array.from({length:localPacks},(_,idx)=>
  ['items'+idx,pack('bank',2).items]));
 const defs=Object.fromEntries(Object.keys(rows).map(k=>[k,['bank',1000]]));
 rows.items0[0]={name:'carrot',q:2};
 if(remoteFree!==null){
  rows.items8=pack('bank_b',remoteFree).items;
  defs.items8=['bank_b',1000];
 }
 const events=[],data=new Map(),calls=[];
 const c={name:'M',map:'bank',in:'bank',bank:rows,
  gold:1000,items:Array(42).fill(null)};
 const explicit={enabled:true,name:'Explicit sell',item:'carrot',action:'sell',
  batch:2,maxCount:9999,keep:0,teamReserve:0,minPrice:0};
 const e={
  safe:item=>!!item&&!item.l&&!item.b,
  value:()=>10,explicit:i=>i?.name==='carrot'?explicit:null,
  rules:()=>explicit,remaining:()=>true,count:()=>2,
  note:message=>events.push(message),
  perform:(kind,job)=>{calls.push({kind,job});return job.guard();}
 };
 const cfg={party:{merchant:'M'},merchant:{
  bank:true,bankReclaim:true,consolidate:false,expandBank:false,bankWorkspace:2
 },production:{autoDisposition:false,goals:[],gearTargets:[]}};
 const p={c,G:{items:{carrot:{type:'material',s:9999}},bank_packs:defs},
  realm:()=> 'EUII',read:k=>data.get(k)??null,
  write:(k,v)=>{data.set(k,v);return true;}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},session:'pressure-fixture-session',economy:e,
  running:true,inventoryBlocked:false,journal:null,decisionEpoch:1,
  free:()=>42,logistics:{reserved:false}};
 const bank=createBank(bot);
 return {p,c,bot,bank,calls,events,data};
}
test('real reclaim uses two durable observations when both local packs hold only workspace',()=>{
 const f=merchantBank();
 assert.equal(f.bank.reclaim(),false);
 assert.equal(f.bank.pressureStatus().observations,1);
 assert.equal(f.calls.length,0,'first observation cannot retrieve/sell');
 f.bot.decisionEpoch++;
 assert.equal(f.bank.reclaim(),true);
 assert.equal(f.bank.pressureStatus().observations,2);
 assert.deepEqual(f.calls.map(x=>x.kind),['bank.reclaim']);
 assert.equal(f.calls[0].job.details.item,'carrot');
 assert.equal(f.bank.pending,true,'persisted recoverable checkpoint is kept');
});
test('remote pack with usable capacity prevents even observing destructive reclaim pressure',()=>{
 const f=merchantBank({remoteFree:3});
 f.bot.decisionEpoch=1;
 assert.equal(f.bank.reclaim(),false);
 f.bot.decisionEpoch++;
 assert.equal(f.bank.reclaim(),false);
 assert.equal(f.bank.pressureStatus().observations,0);
 assert.deepEqual(f.calls,[]);
 assert.equal(f.bank.pending,false);
});
test('remote pack only at its own reserve is not treated as usable recovery capacity',()=>{
 const f=merchantBank({remoteFree:2});
 assert.equal(f.bank.reclaim(),false);
 assert.equal(f.bank.pressureStatus().observations,1);
 f.bot.decisionEpoch++;
 assert.equal(f.bank.reclaim(),true);
 assert.deepEqual(f.calls.map(x=>x.kind),['bank.reclaim']);
});

test('W04 compact bank packs always represent 42 logical cells',()=>{
 const full=pack('bank',0);
 assert.equal(bankCapacityPressure([{map:'bank',items:[]}],2,'bank').pressed,false);
 assert.equal(bankCapacityPressure([{map:'bank',items:[{name:'ordinary'}]}],2,'bank').pressed,false);
 assert.equal(bankCapacityPressure([full,{map:'bank_b',items:[]}],2,'bank').pressed,false);
});
test('W04 missing remote location or invalid physical pack revokes pressure',()=>{
 const local=pack('bank',2),G={items:{carrot:{s:9999}}};
 const bad=[
  {map:'bank_b',items:Array(43).fill(null)},{map:null,items:[]},
  {map:'bank_b',items:null},
  {map:'bank_b',items:[{name:'unknown',q:null}]},
  {map:'bank_b',items:[{name:'unknown',q:0}]},
  {map:'bank_b',items:[{name:'unknown',q:1.5}]},
  {map:'bank_b',items:[{name:'unknown',q:2}]},
  {map:'bank_b',items:[{name:'carrot',q:10000}]}
 ];
 for(const row of bad){
  const state=bankCapacityPressure([local,row],2,'bank',G);
  assert.equal(state.pressed,false,JSON.stringify(row));
  assert.equal(state.locallyBlocked,false);
 }
 assert.equal(bankCapacityPressure([local,{map:'bank_b',
  items:[{name:'unknown'}]}],2,'bank',G).pressed,false);
});
test('W04 queued emergency sale loses permission when bank workspace recovers',()=>{
 for(const edit of [
  f=>{f.c.bank.items1[39]=null;},
  f=>{f.c.bank.items8=[];f.p.G.bank_packs.items8=['bank_b',1000];}
 ]){
  const f=merchantBank();
  assert.equal(f.bank.reclaim(),false);
  f.bot.decisionEpoch++;
  assert.equal(f.bank.reclaim(),true);
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].job.guard(),true);
  edit(f);
  assert.equal(f.calls[0].job.guard(),false,
   'fresh free bank workspace revokes queued sale');
  assert.equal(f.calls.length,1);
 }
});
test('W04 invalid newly observed remote packs or illegal stack revoke emergency dispatch',()=>{
 for(const edit of [
  f=>{f.c.bank.items8=Array(43).fill(null);f.p.G.bank_packs.items8=['bank_b',1000];},
  f=>{f.c.bank.items8={damaged:true};f.p.G.bank_packs.items8=['bank_b',1000];},
  f=>{f.c.bank.items8=[];},
  f=>{f.c.bank.items1[5]={name:'carrot',q:10000};}
 ]){
  const f=merchantBank();
  assert.equal(f.bank.reclaim(),false);
  f.bot.decisionEpoch++;
  assert.equal(f.bank.reclaim(),true);
  assert.equal(f.calls[0].job.guard(),true);
  edit(f);
  assert.equal(f.calls[0].job.guard(),false);
 }
});
