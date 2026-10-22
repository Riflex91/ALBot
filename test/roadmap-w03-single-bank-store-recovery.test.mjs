import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {validateBankStoreRecord,classifyBankStoreRecord}
 from '../src/merchant/bank-store-recovery.mjs';
import {createBank} from '../src/merchant/bank.mjs';

const owner='M',realm='EU:I',key='albot:bank-store:M';
const item={name:'ore',q:10},blank=()=>Array(42).fill(null);
function record(){
 const at=Date.now(),sourcePrint=fingerprint(item);
 return {version:1,owner,realm,at,pack:'items0',source:0,dest:7,
  item:{...item},sourcePrint,quantity:10,
  prepared:{kind:'bank.store',session:'original',at,realm,pack:'items0',
   source:0,dest:7,sourcePrint}};
}
const sent=r=>({...r,dispatch:{...r.prepared,at:Date.now(),session:'current'}});
function phase(r,source=item,dest=null,map='bank'){
 const inventory=blank(),pack=blank();inventory[0]=source;pack[7]=dest;
 return classifyBankStoreRecord(r,{owner,realm,inventory,
  bank:{items0:pack},map,packMap:()=> 'bank'}).phase;
}
test('W03 store record validates owner, realm, addresses and provenance',()=>{
 const r=record();
 assert.equal(validateBankStoreRecord(r,{owner,realm}).valid,true);
 for(const d of [{owner:'Other'},{realm:'US:I'},{dest:42},{source:1000},
  {quantity:9},{sourcePrint:'bad'},{version:0},
  {prepared:{...r.prepared,session:''}},
  {dispatch:{...r.prepared,source:1}}])
  assert.equal(validateBankStoreRecord({...r,...d},{owner,realm}).valid,false,
   JSON.stringify(d));
 assert.equal(validateBankStoreRecord(sent(r),{owner,realm}).valid,true);
});
test('W03 bank store distinguishes unsent, sent, observed and ambiguity',()=>{
 const r=record(),s=sent(r);
 assert.equal(phase(r),'prepared-unchanged');
 assert.equal(phase(s),'dispatched-unchanged');
 assert.equal(phase(s,null,item),'stored');
 assert.equal(phase(r,null,item),'unproven-store');
 assert.equal(phase(s,item,item),'ambiguous');
 assert.equal(phase(s,null,null),'ambiguous');
 assert.equal(phase(s,null,{name:'ore',q:8}),'ambiguous');
 assert.equal(phase(s,null,item,'main'),'unobserved');
});
function fixture(saved=null,{allowWrite=true}={}){
 const items=blank(),pack=blank(),db=new Map(),events=[],calls=[],notes=[];
 items[0]={...item};if(saved)db.set(key,saved);
 const p={c:{name:'M',map:'bank',in:'bank',items,bank:{items0:pack}},
  G:{items:{ore:{type:'material',s:9999}},bank_packs:{items0:['bank',0,0]}},
  realm:()=>realm,read:k=>db.get(k)??null,
  write:(k,v)=>{if(!allowWrite)return false;db.set(k,v);return true;},
  call:(...args)=>{calls.push(args);return true;}};
 const economy={safe:x=>!!x&&!x.l&&!x.b,spare:()=>99,
  count:()=>10,remaining:()=>true,travel:()=>true,note:s=>notes.push(s),
  perform:(kind,params)=>{events.push({kind,params});return true;}};
 const bot={p,economy,me:{name:'M',role:'merchant'},session:'current',
  cfg:{party:{merchant:'M'},merchant:{bank:true,bankWorkspace:0}},
  running:true,inventoryBlocked:false,journal:null,logistics:{reserved:false},
  exec:{busy:()=>false},free:()=>20};
 bot.bank=createBank(bot);
 return {bot,items,pack,db,events,calls,notes,rule:{action:'bank',item:'ore'}};
}
test('W03 store writes preparation before enqueue, dispatch before API',()=>{
 const f=fixture();
 assert.equal(f.bot.bank.store(0,f.rule),true);
 assert.ok(f.db.get(key).prepared);
 assert.equal(f.db.get(key).dispatch,undefined);
 assert.equal(f.calls.length,0);
 assert.equal(f.events[0].params.guard(),true);
 assert.equal(f.events[0].params.call(),true);
 assert.deepEqual(f.calls,[['bank_store',0,'items0',0]]);
 assert.ok(f.db.get(key).dispatch);
 assert.equal(f.bot.bank.recoveryStatus().store.phase,'dispatched-unchanged');
 f.bot.bank.store(0,f.rule);
 assert.equal(f.events.length,1,'cannot enqueue a second sent request');
 f.bot.bank.recover();
 assert.equal(f.bot.inventoryBlocked,true);
});
test('W03 observed store clears its journal only after exact source/destination',()=>{
 const f=fixture();
 assert.equal(f.bot.bank.store(0,f.rule),true);
 f.events[0].params.call();f.items[0]=null;f.pack[0]={...item};
 assert.equal(f.events[0].params.observe(),true);
 assert.equal(f.events[0].params.onConfirmed(),true);
 assert.equal(f.db.get(key),null);
 assert.equal(f.bot.bank.pending,false);
});
test('W03 failed preparation or dispatch write prevents bank_store',()=>{
 const a=fixture(null,{allowWrite:false});
 assert.equal(a.bot.bank.store(0,a.rule),false);
 assert.equal(a.bot.inventoryBlocked,true);assert.equal(a.calls.length,0);
 const b=fixture();b.bot.bank.store(0,b.rule);
 b.bot.p.write=(k,v)=>v?.dispatch?false:(b.db.set(k,v),true);
 assert.throws(()=>b.events[0].params.call(),/Dispatch-Beleg/);
 assert.equal(b.calls.length,0);assert.equal(b.bot.inventoryBlocked,true);
});
test('W03 restart may resolve unsent or physically completed store, not unknown',()=>{
 const a=fixture(record());
 assert.equal(a.bot.bank.recover(),true);assert.equal(a.db.get(key),null);
 const b=fixture(sent(record()));
 assert.equal(b.bot.bank.recover(),true);
 assert.equal(b.bot.inventoryBlocked,true);
 assert.ok(b.db.get(key).dispatch);assert.equal(b.calls.length,0);
 const c=fixture(sent(record()));c.items[0]=null;c.pack[7]={...item};
 assert.equal(c.bot.bank.recover(),true);assert.equal(c.db.get(key),null);
});
test('W03 off-map pack cannot confirm and double bank journal is conflict',()=>{
 const a=fixture(sent(record()));a.bot.p.c.map='main';
 assert.equal(a.bot.bank.recoveryStatus().store.phase,'unobserved');
 assert.equal(a.bot.bank.recover(),true);assert.ok(a.db.get(key).dispatch);
 const b=fixture(sent(record()));
 b.db.set('albot:bank-single:M',{version:0});
 b.bot.bank=createBank(b.bot);
 assert.equal(b.bot.inventoryBlocked,true);
 assert.equal(b.bot.bank.recoveryStatus().conflict,'simultaneous-bank-value-journals');
 assert.equal(b.bot.bank.recoveryStatus().store.phase,'conflict');
});

test('W03 store recovery refuses truncated bank-pack before and after images',()=>{
 const r=record(),s=sent(r),items=blank();
 for(const [checkpoint,source,destination,expected] of [
  [r,{...item},null,'prepared-unchanged'],
  [s,{...item},null,'dispatched-unchanged'],
  [s,null,{...item},'stored']
 ]){
  const bankPack=blank();bankPack[7]=destination;items[0]=source;
  const classify=pack=>classifyBankStoreRecord(checkpoint,{owner,realm,
   inventory:items,bank:{items0:pack},map:'bank',packMap:()=> 'bank'});
  assert.equal(classify(bankPack).phase,expected);
  for(const len of [8,33,41])
   assert.equal(classify(bankPack.slice(0,len)).phase,'unobserved');
 }
 const f=fixture(sent(record()));f.items[0]=null;f.pack[7]={...item};
 f.pack.length=8;
 assert.equal(f.bot.bank.recoveryStatus().store.phase,'unobserved');
 assert.equal(f.bot.bank.recover(),true);
 assert.ok(f.db.get(key),'a truncated deposit image cannot clear the checkpoint');
 assert.equal(f.bot.bank.pending,true);
});
