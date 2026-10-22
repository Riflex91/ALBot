import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {validateBankSwapRecord,classifyBankSwapRecord}
 from '../src/merchant/bank-swap-recovery.mjs';
import {createBank} from '../src/merchant/bank.mjs';

const owner='M',realm='EU:I',key='albot:bank-swap:M';
const first={name:'ore',q:7},second={name:'ore',q:9},blank=()=>Array(42).fill(null);
function record(){
 const at=Date.now(),fa=fingerprint(first),fb=fingerprint(second);
 return {version:1,owner,realm,at,pack:'items0',a:3,b:7,
  first:{...first},second:{...second},qa:7,qb:9,total:16,fa,fb,
  prepared:{kind:'bank.consolidate',session:'initial',at,realm,
   pack:'items0',a:3,b:7,fa,fb}};
}
const sent=r=>({...r,dispatch:{...r.prepared,at:Date.now(),session:'current'}});
function phase(r,{a=first,b=second,map='bank',present=true}={}){
 const pack=blank();pack[3]=a;pack[7]=b;
 return classifyBankSwapRecord(r,{owner,realm,bank:present?{items0:pack}:null,
  map,packMap:()=> 'bank'}).phase;
}
test('W03 swap journal validates owner, realm, address, variant and dispatch provenance',()=>{
 const r=record();assert.equal(validateBankSwapRecord(r,{owner,realm}).valid,true);
 for(const bad of [{owner:'X'},{realm:'US:I'},{b:42},{a:7,b:3},
  {a:3,b:3},{total:17},{qa:8},{fa:'wrong'},
  {second:{name:'ore',q:9,stat_type:'int'}},
  {prepared:{...r.prepared,session:''}},
  {dispatch:{...r.prepared,a:2}}])
  assert.equal(validateBankSwapRecord({...r,...bad},{owner,realm}).valid,false,
   JSON.stringify(bad));
 assert.equal(validateBankSwapRecord(sent(r),{owner,realm}).valid,true);
});
test('W03 bank_swap distinguishes both legal directions from uncertain server state',()=>{
 const r=record(),s=sent(r),merged={name:'ore',q:16};
 assert.equal(phase(r),'prepared-unchanged');
 assert.equal(phase(s),'dispatched-unchanged');
 assert.equal(phase(s,{a:null,b:merged}),'merged-b');
 assert.equal(phase(s,{a:merged,b:null}),'merged-a');
 assert.equal(phase(r,{a:null,b:merged}),'unproven-merge');
 assert.equal(phase(s,{a:null,b:{name:'ore',q:15}}),'ambiguous');
 assert.equal(phase(s,{a:first,b:merged}),'ambiguous');
 assert.equal(phase(s,{map:'main'}),'unobserved');
 assert.equal(phase(s,{present:false}),'unobserved');
});
function fixture(saved=null,{allowWrite=true,enqueue=true}={}){
 const bank=blank(),memory=new Map(),calls=[],jobs=[],notes=[];
 bank[3]={...first};bank[7]={...second};
 if(saved)memory.set(key,saved);
 const p={c:{name:'M',map:'bank',in:'bank',items:blank(),bank:{items0:bank}},
  G:{items:{ore:{type:'material',s:9999}},bank_packs:{items0:['bank',0,0]}},
  read:k=>memory.get(k)??null,
  write:(k,v)=>{if(!allowWrite)return false;memory.set(k,v);return true;},
  realm:()=>realm,call:(...args)=>{calls.push(args);return true;}};
 const e={safe:i=>!!i&&!i.l&&!i.b,spare:()=>10,count:()=>16,
  explicit:()=>null,travel:()=>true,note:s=>notes.push(s),
  perform:(kind,params)=>{jobs.push({kind,params});return enqueue;}};
 const bot={p,economy:e,me:{name:'M',role:'merchant'},session:'current',
  cfg:{party:{merchant:'M'},merchant:{bank:true,consolidate:true},
   production:{autoDisposition:false}},running:true,inventoryBlocked:false,
  journal:null,logistics:{reserved:false},exec:{busy:()=>false},free:()=>40};
 bot.bank=createBank(bot);
 return {bot,bank,memory,calls,jobs,notes};
}
test('W03 bank_swap persists prepared and dispatched before API, once only',()=>{
 const f=fixture();assert.equal(f.bot.bank.consolidate(),true);
 assert.equal(f.jobs[0].kind,'bank.consolidate');
 assert.ok(f.memory.get(key).prepared);
 assert.equal(f.memory.get(key).dispatch,undefined);
 assert.equal(f.calls.length,0);
 assert.equal(f.jobs[0].params.guard(),true);
 assert.equal(f.jobs[0].params.call(),true);
 assert.deepEqual(f.calls,[['bank_swap','items0',3,7]]);
 assert.equal(f.bot.bank.recoveryStatus().swap.phase,'dispatched-unchanged');
 assert.equal(f.bot.bank.consolidate(),true);
 assert.equal(f.jobs.length,1,'no second enqueue after dispatch');
 f.bot.bank.recover();
 assert.equal(f.bot.inventoryBlocked,true);
 assert.ok(f.memory.get(key).dispatch);
});
test('W03 exact addressed physical merge clears the durable journal',()=>{
 const f=fixture();f.bot.bank.consolidate();f.jobs[0].params.call();
 f.bank[3]=null;f.bank[7]={name:'ore',q:16};
 assert.equal(f.jobs[0].params.observe(),true);
 assert.equal(f.jobs[0].params.onConfirmed(),true);
 assert.equal(f.memory.get(key),null);
 assert.equal(f.bot.bank.pending,false);
});
test('W03 failed preparation/dispatch storage prevents bank_swap call',()=>{
 const no=fixture(null,{allowWrite:false});
 assert.equal(no.bot.bank.consolidate(),false);
 assert.equal(no.jobs.length,0);assert.equal(no.calls.length,0);
 const f=fixture();f.bot.bank.consolidate();
 f.bot.p.write=(k,v)=>v?.dispatch?false:(f.memory.set(k,v),true);
 assert.throws(()=>f.jobs[0].params.call(),/Dispatchbeleg/);
 assert.equal(f.calls.length,0);assert.equal(f.bot.inventoryBlocked,true);
});
test('W03 bank_swap restart clears only proven non-dispatch or observed completion',()=>{
 const original=fixture(record());
 assert.equal(original.bot.bank.recover(),true);
 assert.equal(original.memory.get(key),null);
 const sentUnchanged=fixture(sent(record()));
 assert.equal(sentUnchanged.bot.bank.recover(),true);
 assert.equal(sentUnchanged.bot.inventoryBlocked,true);
 assert.equal(sentUnchanged.calls.length,0);
 assert.ok(sentUnchanged.memory.get(key).dispatch);
 const successful=fixture(sent(record()));
 successful.bank[3]=null;successful.bank[7]={name:'ore',q:16};
 assert.equal(successful.bot.bank.recover(),true);
 assert.equal(successful.memory.get(key),null);
 assert.equal(successful.bot.inventoryBlocked,false);
});
test('W03 off-map cannot prove merge; simultaneous bank journals remain quarantined',()=>{
 const away=fixture(sent(record()));away.bot.p.c.map='main';
 assert.equal(away.bot.bank.recoveryStatus().swap.phase,'unobserved');
 assert.equal(away.bot.bank.recover(),true);
 assert.ok(away.memory.get(key).dispatch);assert.equal(away.calls.length,0);
 const conflict=fixture(sent(record()));
 conflict.memory.set('albot:bank-store:M',{version:0});
 conflict.bot.bank=createBank(conflict.bot);
 assert.equal(conflict.bot.inventoryBlocked,true);
 const status=conflict.bot.bank.recoveryStatus();
 assert.equal(status.conflict,'simultaneous-bank-value-journals');
 assert.equal(status.swap.phase,'conflict');
 assert.equal(status.store.phase,'conflict');
});
test('W03 bank_swap guard rejects drift, limit changes and revoked consolidation',()=>{
 const f=fixture();f.bot.bank.consolidate();const guard=f.jobs[0].params.guard;
 f.bank[7]={name:'ore',q:8};assert.equal(guard(),false);
 f.bank[7]={...second};f.bot.cfg.merchant.consolidate=false;
 assert.equal(guard(),false);f.bot.cfg.merchant.consolidate=true;
 f.bot.p.G.items.ore.s=15;assert.equal(guard(),false);
 assert.equal(f.calls.length,0);
});

test('W03 bank-swap recovery needs a full pack to verify merge or unchanged phase',()=>{
 const original=record(),sentRecord=sent(original);
 for(const [checkpoint,a,b,phase] of [
  [original,{...first},{...second},'prepared-unchanged'],
  [sentRecord,{...first},{...second},'dispatched-unchanged'],
  [sentRecord,null,{name:'ore',q:16},'merged-b'],
  [sentRecord,{name:'ore',q:16},null,'merged-a']
 ]){
  const full=blank();full[3]=a;full[7]=b;
  const classify=pack=>classifyBankSwapRecord(checkpoint,{owner,realm,
   bank:{items0:pack},map:'bank',packMap:()=> 'bank'});
  assert.equal(classify(full).phase,phase);
  for(const size of [8,30,41])
   assert.equal(classify(full.slice(0,size)).phase,'unobserved');
 }
 const f=fixture(sent(record()));
 f.bank[3]=null;f.bank[7]={name:'ore',q:16};f.bank.length=8;
 assert.equal(f.bot.bank.recoveryStatus().swap.phase,'unobserved');
 assert.equal(f.bot.bank.recover(),true);
 assert.ok(f.memory.get(key),'incomplete merge observation is not a receipt');
 assert.equal(f.bot.bank.pending,true);
});
