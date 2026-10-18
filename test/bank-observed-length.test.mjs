import test from 'node:test';
import assert from 'node:assert/strict';
import {createBank} from '../src/merchant/bank.mjs';

function fixture(bankPacks){
 const performed=[],notes=[],writes=[];
 const c={name:'Merchant',map:'bank',in:'bank',items:Array(42).fill(null),
  bank:bankPacks,slots:{},gold:1000,rip:false};
 const cfg={party:{merchant:'Merchant'},merchant:{
  bank:true,bankWorkspace:0,expandBank:false,bankReclaim:false,
  consolidate:false,partialBank:false},production:{autoDisposition:false}};
 const e={safe:i=>!!i&&!i.l&&!i.b,spare:()=>1,count:()=>1,
  explicit:()=>null,note:msg=>notes.push(msg),travel:()=>true,
  perform:(kind,opts)=>{
   if(!opts.guard?.())return false;
   performed.push({kind,...opts.details,guard:opts.guard});
   return true;
  }};
 const p={c,G:{items:{mat:{s:9999},other:{s:9999}},
  bank_packs:{items0:['bank',100],items1:['bank',100]}},
  root:{},parent:{},read:()=>null,write:(k,v)=>{writes.push(k);return true;},
  realm:()=> 'EU:II'};
 const bot={p,cfg,me:{name:'Merchant',role:'merchant'},session:'bank-observation-test',
  economy:e,inventoryBlocked:false,journal:null,decisionEpoch:1,
  logistics:{reserved:false},free:()=>c.items.filter(x=>!x).length};
 const bank=createBank(bot);bot.bank=bank;
 return {bank,c,cfg,p,e,performed,notes,writes,bot};
}
const rule={name:'Bank mat',item:'mat',action:'bank',
 batch:1,keep:0,teamReserve:0,pack:'items0'};

test('empty bank pack [] still represents 42 legal slots, not zero',()=>{
 const f=fixture({items0:[],items1:[]});
 assert.deepEqual(f.bank.capacity().map(r=>[r.pack,r.size,r.observedLength,r.free]),
  [['items0',42,0,42],['items1',42,0,42]]);
});
test('abbreviated bank arrays count occupied slots but preserve the 42-slot game contract',()=>{
 const f=fixture({items0:[{name:'other',q:1},null,{name:'mat',q:3}]});
 assert.deepEqual(f.bank.capacity().map(r=>[r.size,r.observedLength,r.used,r.free]),
  [[42,3,2,40]]);
});
test('sparse bank array holes within observed length are normalized, with exactly 42 slots',()=>{
 const sparse=Array(4);sparse[1]={name:'mat',q:1};
 const f=fixture({items0:sparse});
 assert.deepEqual(f.bank.capacity().map(r=>[r.size,r.observedLength,r.used,r.free]),
  [[42,4,1,41]]);
 assert.equal(f.bank.packs()[0][1].length,42);
});
test('full bank array has zero free cells and never invents a destination',()=>{
 const items=Array.from({length:42},(_,n)=>({name:'other',level:0,q:1,data:{n}}));
 const f=fixture({items0:items});
 assert.deepEqual(f.bank.capacity().map(r=>[r.size,r.observedLength,r.used,r.free]),
  [[42,42,42,0]]);
 f.c.items[0]={name:'mat',q:1};
 assert.equal(f.bank.store(0,rule),false);
 assert.equal(f.performed.length,0);
});
test('empty compact bank pack accepts the first bank_store after live guard revalidation',()=>{
 const f=fixture({items0:[]});
 f.c.items[0]={name:'mat',q:1};
 assert.equal(f.bank.store(0,rule),true);
 assert.deepEqual(f.performed.map(x=>[x.kind,x.pack,x.bankSlot]),
  [['bank.store','items0',0]]);
 assert.equal(f.performed[0].guard(),true);
 // A concurrent deposit filling slot 0 cancels the deferred mutation.
 f.c.bank.items0[0]={name:'other',q:1};
 assert.equal(f.performed[0].guard(),false);
});
test('workspace reserve and full intervening pack block the delayed store',()=>{
 const f=fixture({items0:[]});
 f.cfg.merchant.bankWorkspace=2;
 f.c.items[0]={name:'mat',q:1};
 assert.equal(f.bank.store(0,rule),true);
 f.c.bank.items0=Array.from({length:42},(_,n)=>n<41?{name:'other',q:1}:null);
 assert.equal(f.performed[0].guard(),false,'only one free slot remains below workspace');
});

function bankWithTwoMaps({localFree=1,remoteFree=10}={}){
 const filled=(free)=>Array.from({length:42},(_,slot)=>
  slot<42-free?{name:'other',q:1,data:{slot}}:null);
 const f=fixture({items0:filled(localFree),items8:filled(remoteFree)});
 f.p.G.bank_packs.items8=['bank_b',1000];
 f.cfg.merchant.bankWorkspace=2;
 f.c.items[0]={name:'mat',level:0,q:1};
 const travel=[];
 f.e.travel=location=>{
  travel.push(location.map);
  return location.map===f.c.map;
 };
 const openRule={...rule};
 delete openRule.pack;
 return {...f,openRule,travel};
}
test('bank store travels to genuinely usable other-map pack instead of looping on local workspace',()=>{
 const f=bankWithTwoMaps({localFree:1,remoteFree:12});
 assert.equal(f.bank.store(0,f.openRule),false,'remote map travel is not bank_store');
 assert.deepEqual(f.travel,['bank_b']);
 assert.deepEqual(f.performed,[]);
 f.c.map=f.c.in='bank_b';
 assert.equal(f.bank.store(0,f.openRule),true);
 assert.deepEqual(f.performed.map(x=>[x.kind,x.pack,x.bankSlot]),
  [['bank.store','items8',30]]);
 assert.equal(f.performed[0].guard(),true);
});
test('bank store stays on current bank map when a pack has more than the workspace reserve',()=>{
 const f=bankWithTwoMaps({localFree:3,remoteFree:12});
 assert.equal(f.bank.store(0,f.openRule),true);
 assert.deepEqual(f.travel,['bank'],'local bank store must not trigger an unnecessary bank_b trip');
 assert.equal(f.performed[0].pack,'items0');
 assert.equal(f.performed[0].bankSlot,39);
});
test('explicit pack routing is never silently widened to an unrelated bank map',()=>{
 const f=bankWithTwoMaps({localFree:1,remoteFree:12});
 assert.equal(f.bank.store(0,rule),false);
 assert.deepEqual(f.travel,[],'a workspace-blocked explicit pack is not a valid bank destination');
 assert.deepEqual(f.performed,[]);
 assert.equal(f.c.items[0].name,'mat');
});
test('remote pack filling during travel cannot authorize a stale bank_store destination',()=>{
 const f=bankWithTwoMaps({localFree:1,remoteFree:4});
 assert.equal(f.bank.store(0,f.openRule),false);
 f.c.map=f.c.in='bank_b';
 f.c.bank.items8=Array.from({length:42},(_,i)=>({name:'other',q:1,data:{i}}));
 assert.equal(f.bank.store(0,f.openRule),false);
 assert.deepEqual(f.performed,[]);
 assert.equal(f.c.items[0].name,'mat');
});

test('emergency bank parking never removes Seashell exchange inputs while market goals wait',()=>{
 const f=fixture({items0:[]});
 f.cfg.production.autoDisposition=true;
 f.p.G.items.seashell={type:'material',e:10,s:9999};
 f.c.items[0]={name:'seashell',level:0,q:345};
 f.bot.production={status:()=>({steps:[{kind:'marketBuy',item:'poison'}]}),
  reservedQuantity:()=>0};
 assert.equal(f.bank.park(0),false,
  'unreserved but still exchange-eligible Seashells must remain at the production hub');
 assert.deepEqual(f.performed,[]);
 // Proven ordinary reversible gear parking remains available during pressure.
 f.p.G.items.ringsj={type:'ring'};
 f.c.items[0]={name:'ringsj',level:0,q:1};
 assert.equal(f.bank.park(0),true);
 assert.equal(f.performed[0].kind,'bank.store');
 assert.equal(f.performed[0].capacityRecovery,true);
});
