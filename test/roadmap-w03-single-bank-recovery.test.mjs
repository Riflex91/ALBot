import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {classifyBankSingleRecord,validateBankSingleRecord}
 from '../src/merchant/bank-single-recovery.mjs';
import {createBank} from '../src/merchant/bank.mjs';

const owner='M',realm='EU:I',item={name:'ore',q:10},blank=()=>Array(42).fill(null);
const key='albot:bank-single:M';
function record(extra={}){
 const at=extra.at??Date.now(),sourcePrint=fingerprint(item);
 return {version:1,owner,realm,at,pack:'items0',slot:7,dest:0,
  item:{...item},sourcePrint,quantity:10,before:0,bankBefore:10,
  prepared:{kind:'bank.retrieve',session:'source-session',at,realm,
   pack:'items0',slot:7,dest:0,sourcePrint},...extra};
}
const dispatched=r=>({...r,dispatch:{...r.prepared,session:'current-session',at:Date.now()}});
function observation(r,{source={...item},target=null,map='bank',found=true}={}){
 const inventory=blank(),pack=blank();inventory[0]=target;pack[7]=source;
 return classifyBankSingleRecord(r,{owner,realm,inventory,
  bank:found?{items0:pack}:{},map,packMap:()=> 'bank'});
}
test('W03 single retrieval checks exact variant, owner, realm and receipt provenance',()=>{
 const r=record();assert.equal(validateBankSingleRecord(r,{owner,realm}).valid,true);
 for(const change of [{owner:'Other'},{realm:'US:I'},{version:2},
  {dest:1000},{slot:42},{quantity:9},{bankBefore:9},
  {sourcePrint:'tampered'},{item:{name:'ore',q:9}},
  {prepared:{...r.prepared,session:''}},
  {prepared:{...r.prepared,pack:'items3'}}]){
  assert.equal(validateBankSingleRecord({...r,...change},{owner,realm}).valid,
   false,JSON.stringify(change));
 }
 assert.equal(validateBankSingleRecord(dispatched(r),{owner,realm}).valid,true);
 assert.equal(validateBankSingleRecord({...r,dispatch:{...r.prepared,slot:10}},
  {owner,realm}).valid,false);
});
test('W03 single physical phases never interpret stale bank snapshot as a receipt',()=>{
 const r=record(),d=dispatched(r);
 assert.equal(observation(r).phase,'prepared-unchanged');
 assert.equal(observation(d).phase,'dispatched-unchanged');
 assert.equal(observation(d,{source:null,target:{...item}}).phase,'withdrawn');
 assert.equal(observation(r,{source:null,target:{...item}}).phase,'unproven-withdrawal');
 assert.equal(observation(d,{source:null}).phase,'ambiguous');
 assert.equal(observation(d,{source:{...item,q:9}}).phase,'ambiguous');
 assert.equal(observation(d,{source:null,target:{...item,q:9}}).phase,'ambiguous');
 assert.equal(observation(d,{map:'main'}).phase,'unobserved');
 assert.equal(observation(d,{found:false}).phase,'unobserved');
});
function fixture(saved=null,{write=true,enqueue=true}={}){
 const items=blank(),pack=blank(),calls=[],events=[],log=[],store=new Map();
 pack[7]={...item};if(saved)store.set(key,saved);
 const p={c:{name:'M',map:'bank',in:'bank',gold:1000,items,
  bank:{items0:pack}},G:{items:{ore:{type:'material',s:9999}},
  bank_packs:{items0:['bank',0,0]}},realm:()=>realm,
  read:k=>store.get(k)??null,
  write:(k,v)=>{if(!write)return false;store.set(k,v);return true;},
  call:(...args)=>{calls.push(args);return true;}};
 const e={safe:i=>!!i&&!i.l&&!i.b,count:i=>items.reduce((n,x)=>
  n+(x?.name===i?.name?(x.q??1):0),0),
  remaining:()=>true,spare:()=>10,
  travel:()=>true,note:s=>log.push(s),explicit:()=>null,rules:()=>null,
  perform:(kind,params)=>{events.push({kind,params});return enqueue;}};
 const bot={p,me:{name:'M',role:'merchant'},session:'current-session',
  cfg:{party:{merchant:'M'},merchant:{bank:true,partialBank:false},
   production:{autoDisposition:false,goals:[],gearTargets:[]}},
  economy:e,inventoryBlocked:false,running:true,journal:null,
  logistics:{reserved:false},exec:{busy:()=>false},
  free:()=>items.filter(x=>!x).length};
 bot.bank=createBank(bot);
 const rule={pack:'items0',batch:10,maxCount:100,action:'retrieve'};
 return {bot,items,pack,store,events,calls,log,rule};
}
test('W03 full retrieval stores prepared intent before enqueue and dispatch before server API',()=>{
 const f=fixture();
 assert.equal(f.bot.bank.retrieve(item,f.rule,10),true);
 assert.equal(f.events.length,1);
 assert.equal(f.events[0].kind,'bank.retrieve');
 assert.ok(f.store.get(key).prepared);
 assert.equal(f.store.get(key).dispatch,undefined);
 assert.equal(f.calls.length,0);
 assert.equal(f.events[0].params.guard(),true);
 assert.equal(f.events[0].params.call(),true);
 assert.equal(f.calls.length,1);
 assert.deepEqual(f.calls[0],['bank_retrieve','items0',7,0]);
 assert.equal(f.store.get(key).dispatch.session,'current-session');
 assert.equal(f.bot.bank.recoveryStatus().single.phase,'dispatched-unchanged');
 assert.equal(f.bot.bank.recoveryStatus().requiresManualReview,true);
 f.bot.bank.recover();
 assert.equal(f.bot.inventoryBlocked,true,'uncertain response cannot be retried');
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.calls.length,1);
});
test('W03 full retrieval resolves only after the observed addressed source/dest effect',()=>{
 const f=fixture();
 f.bot.bank.retrieve(item,f.rule,10);
 f.events[0].params.call();
 f.pack[7]=null;f.items[0]={...item};
 assert.equal(f.events[0].params.observe(),true);
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get(key),null);
});
test('W03 full retrieval rejected before execution clears only exact before image',()=>{
 const f=fixture(null,{enqueue:false});
 assert.equal(f.bot.bank.retrieve(item,f.rule,10),false);
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get(key),null);
 assert.equal(f.calls.length,0);
});
test('W03 full retrieval dispatch cannot execute after failed durable write',()=>{
 const f=fixture();
 f.bot.bank.retrieve(item,f.rule,10);
 f.bot.p.write=(k,v)=>v?.dispatch?false:(f.store.set(k,v),true);
 assert.throws(()=>f.events[0].params.call(),/Dispatch-Journal/);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.calls.length,0);
 assert.equal(f.bot.bank.pending,true);
});
test('W03 restart with unsent exact before image may clear; dispatched must not',()=>{
 const a=fixture(record());
 assert.equal(a.bot.bank.recover(),true);
 assert.equal(a.bot.bank.pending,false);
 const b=fixture(dispatched(record()));
 assert.equal(b.bot.bank.recover(),true);
 assert.equal(b.bot.bank.pending,true);
 assert.equal(b.bot.inventoryBlocked,true);
 assert.equal(b.calls.length,0);
});
test('W03 single transfer off-map requires bank re-observation, not phantom stock',()=>{
 const f=fixture(dispatched(record()));
 f.bot.p.c.map='main';f.bot.p.c.bank={};
 assert.equal(f.bot.bank.recoveryStatus().single.phase,'unobserved');
 f.bot.bank.recover();
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.calls.length,0);
});
test('W03 single transfer blocks overlapping bank retrieve and partial journal',()=>{
 const f=fixture();
 f.bot.bank.retrieve(item,f.rule,10);
 assert.equal(f.bot.bank.retrieve(item,f.rule,10),true,'only recovery, no new queue');
 assert.equal(f.events.length,1);
 assert.equal(f.bot.bank.singlePending,true);
});
