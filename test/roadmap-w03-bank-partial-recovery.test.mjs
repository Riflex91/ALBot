import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {classifyBankPartialRecord,validateBankPartialRecord,partialDispatchDecision}
 from '../src/merchant/bank-partial-recovery.mjs';
import {createBank} from '../src/merchant/bank.mjs';

const owner='M',realm='EU:I',now=1700000000000;
const material={name:'beewing',q:131},blank=()=>Array(42).fill(null);
function checkpoint(extra={}){
 const at=extra.at??now;
 const r={version:2,owner,realm,at,pack:'items0',
  bankSlot:7,dest:0,splitSlot:1,item:{...material},
  sourcePrint:fingerprint(material),total:131,take:100,
  before:0,bankBefore:131,...extra};
 if(!Object.hasOwn(extra,'prepared'))r.prepared={
  at,session:'prepared-browser-session',realm:r.realm,pack:r.pack,
  bankSlot:r.bankSlot,dest:r.dest,splitSlot:r.splitSlot,
  sourcePrint:r.sourcePrint};
 if(!Object.hasOwn(extra,'dispatches'))r.dispatches=[];
 return r;
}
const step=(r,phase,session='old-session',at=r.at)=>({
 phase,session,at,realm:r.realm,pack:r.pack,bankSlot:r.bankSlot,
 dest:r.dest,splitSlot:r.splitSlot,sourcePrint:r.sourcePrint});
const dispatched=(r,phases)=>({
 ...r,dispatches:phases.map((p,i)=>step(r,p,
  i===0?'original-session':'restart-session'))});
function evidence(r,{source={...material},dest=null,split=null,
 map='bank',packPresent=true,bankMap='bank'}={}){
 const inventory=blank(),pack=blank();inventory[0]=dest;
 inventory[1]=split;pack[7]=source;
 return classifyBankPartialRecord(r,{owner,realm,now,inventory,
  bank:packPresent?{items0:pack}:{},map,packMap:()=>bankMap});
}
test('W03 partial checkpoint must be v2, same character/realm and exact whole-stack fingerprint',()=>{
 assert.equal(validateBankPartialRecord(checkpoint(),{owner,realm,now}).valid,true);
 for(const change of [{version:1},{owner:'Other'},{realm:'US:I'},
  {sourcePrint:'changed'},{bankSlot:42},{dest:1},{splitSlot:0},
  {total:132},{take:131},{take:0},{before:-1},
  {bankBefore:130},{item:{...material,l:true}},
  {item:{...material,q:130}},{at:now+3000}]){
  assert.equal(validateBankPartialRecord(checkpoint(change),{owner,realm,now}).valid,
   false,JSON.stringify(change));
 }
});
test('W03 exact source and destination states form the four finite phases',()=>{
 const r=checkpoint();
 assert.equal(evidence(r).phase,'original');
 assert.equal(evidence(r,{source:null,dest:{...material}}).phase,'withdrawn');
 assert.equal(evidence(r,{source:null,
  dest:{name:'beewing',q:31},split:{name:'beewing',q:100}}).phase,'split');
 assert.equal(evidence(r,{source:{name:'beewing',q:31},
  split:{name:'beewing',q:100}}).phase,'returned');
});
test('W03 other inventory quantity cannot impersonate a returned split stack',()=>{
 const r=checkpoint();
 for(const sample of [{source:null,split:{name:'beewing',q:100}},
  {source:{...material},split:{name:'beewing',q:100}},
  {source:{name:'beewing',q:31},dest:{name:'beewing',q:100}},
  {source:null,dest:{name:'beewing',q:31},split:{name:'beewing',q:99}},
  {source:{name:'beewing',q:32},split:{name:'beewing',q:100}},
  {source:{name:'beewing',q:31},split:{name:'beewing',q:100,l:true}}]){
  assert.equal(evidence(r,sample).phase,'ambiguous',JSON.stringify(sample));
 }
});
test('W03 stale or off-map bank arrays cannot act as physical recovery receipts',()=>{
 assert.equal(evidence(checkpoint(),{map:'main'}).phase,'unobserved');
 assert.equal(evidence(checkpoint(),{packPresent:false}).phase,'unobserved');
 assert.equal(evidence(checkpoint(),{bankMap:'bank_b'}).phase,'unobserved');
 assert.equal(evidence(checkpoint({realm:'US:I'})).phase,'invalid');
});
function fixture(saved=null,{persist=true,perform=true}={}){
 const store=new Map(saved?[['albot:bank-partial:M',saved]]:[]),pack=blank(),
  inventory=blank(),calls=[],events=[],notes=[];
 pack[7]={...material};
 let canWrite=persist;
 const p={c:{name:'M',map:'bank',in:'bank',items:inventory,
  bank:{items0:pack},gold:1000,slots:{}},
  G:{items:{beewing:{s:9999,type:'material'}},
   bank_packs:{items0:['bank',0,0]}},realm:()=>realm,
  read:key=>store.get(key)??null,
  call:()=>true,
  write:(key,value)=>{if(!canWrite)return false;store.set(key,value);return true;}};
 const economy={safe:i=>!!i&&!i.l&&!i.b,
  travel:()=>true,note:s=>notes.push(s),count:i=>
   inventory.filter(x=>x?.name===i.name).reduce((n,x)=>n+(x.q??1),0),
  remaining:()=>true,spare:()=>9999,
  explicit:()=>null,rules:()=>null,
  perform:(kind,options)=>{calls.push({kind,options});return perform;}};
 const bot={p,economy,cfg:{party:{merchant:'M'},
  merchant:{bank:true,partialBank:true,partialBankMaxStack:9999,
   bankReclaim:false},production:{autoDisposition:false,
    goals:[],gearTargets:[]}},me:{name:'M'},session:'new',
  inventoryBlocked:false,journal:null,running:true,
  logistics:{reserved:false},exec:{busy:()=>false},
  event:(...args)=>events.push(args),free:()=>inventory.filter(x=>!x).length};
 bot.bank=createBank(bot);
 return {bot,pack,inventory,calls,events,notes,store,stopWrites(){canWrite=false;}};
}
test('W03 partial recovery emits only the next observed valid physical action',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.calls.at(-1).kind,'bank.partial.retrieve');
 assert.equal(f.calls.at(-1).options.guard(),true);
 assert.equal(f.calls.at(-1).options.call(),true);
 assert.equal(f.store.get('albot:bank-partial:M').dispatches.length,1);
 f.pack[7]=null;f.inventory[0]={...material};
 assert.equal(f.calls.at(-1).options.observe(),true);
 f.bot.bank.recover();
 assert.equal(f.calls.at(-1).kind,'bank.partial.split');
 assert.equal(f.calls.at(-1).options.guard(),true);
 assert.equal(f.calls.at(-1).options.call(),true);
 assert.equal(f.store.get('albot:bank-partial:M').dispatches.length,2);
 f.inventory[0]={name:'beewing',q:31};
 f.inventory[1]={name:'beewing',q:100};
 f.bot.bank.recover();
 assert.equal(f.calls.at(-1).kind,'bank.partial.return');
 assert.equal(f.calls.at(-1).options.guard(),true);
 assert.equal(f.calls.at(-1).options.call(),true);
 assert.equal(f.store.get('albot:bank-partial:M').dispatches.length,3);
 f.inventory[0]=null;f.pack[7]={name:'beewing',q:31};
 assert.equal(f.calls.at(-1).options.observe(),true);
 f.bot.bank.recover();
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get('albot:bank-partial:M'),null);
 assert.equal(f.events.at(-1)[0],'bank.partial.complete');
});
test('W03 aggregate counts without addressed returned slot cannot clear partial checkpoint',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 f.pack[7]=null;f.inventory[0]={name:'beewing',q:100};
 f.inventory[1]={name:'beewing',q:31};
 f.bot.bank.recover();
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.calls.length,0);
});
test('W03 pending partial recovery with old unversioned checkpoint fails closed',()=>{
 const legacy=checkpoint({version:undefined,at:Date.now()}),f=fixture(legacy);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 f.bot.bank.recover();
 assert.equal(f.calls.length,0);
});
test('W03 unresolved bank map does not attempt even a reversible repeat',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 f.bot.p.c.map='main';
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.calls.length,0);
 assert.equal(f.bot.bank.pending,true);
});
test('W03 failed returned-phase checkpoint clearing blocks rather than claims success',()=>{
 const base=checkpoint({at:Date.now()});
 const r=dispatched(base,['original','withdrawn','split']),f=fixture(r);
 f.pack[7]={name:'beewing',q:31};f.inventory[1]={name:'beewing',q:100};
 f.stopWrites();
 f.bot.bank.recover();
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.events.length,0);
});
test('W03 late bank slot drift cancels previously planned next step',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 f.bot.bank.recover();
 const first=f.calls.at(-1).options;
 f.pack[7]={name:'beewing',q:130};
 assert.equal(first.guard(),false);
});

test('W03 stage proofs require ordered three-call sequence, not an unverified phase',()=>{
 const r=checkpoint();
 assert.equal(partialDispatchDecision(r,'original').allowed,true);
 assert.equal(partialDispatchDecision(r,'withdrawn').reason,'unproven-previous-dispatch');
 const afterRetrieve=dispatched(r,['original']);
 assert.equal(partialDispatchDecision(afterRetrieve,'original').reason,
  'dispatched-step-outcome-unknown');
 assert.equal(partialDispatchDecision(afterRetrieve,'withdrawn').allowed,true);
 const afterSplit=dispatched(r,['original','withdrawn']);
 assert.equal(partialDispatchDecision(afterSplit,'withdrawn').allowed,false);
 assert.equal(partialDispatchDecision(afterSplit,'split').allowed,true);
 const all=dispatched(r,['original','withdrawn','split']);
 assert.equal(partialDispatchDecision(all,'returned').allowed,true);
 assert.equal(partialDispatchDecision(all,'split').allowed,false);
});
test('W03 legacy v2 journal cannot implicitly authorize any partial bank API',()=>{
 const old=checkpoint({at:Date.now(),prepared:undefined,dispatches:undefined});
 const f=fixture(old);
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.calls.length,0);
 assert.equal(f.bot.bank.recoveryStatus().partial.dispatchReason,
  'legacy-partial-without-dispatch-chain');
 assert.equal(f.store.get('albot:bank-partial:M'),old);
});
test('W03 uncertain retrieve dispatch with unchanged bank source is never repeated',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(dispatched(r,['original']));
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.calls.length,0);
 assert.equal(f.bot.bank.pending,true);
});
test('W03 split and return requests are not repeated while outcome is uncertain',()=>{
 for(const phases of [['original','withdrawn'],['original','withdrawn','split']]){
  const r=checkpoint({at:Date.now()}),f=fixture(dispatched(r,phases));
  f.pack[7]=null;f.inventory[0]=phases.length===2?{...material}:
   {name:'beewing',q:31};
  if(phases.length===3)f.inventory[1]={name:'beewing',q:100};
  assert.equal(f.bot.bank.recover(),true);
  // A split that was sent but has not changed either physical slot
  // cannot be sent a second time, even after a new runtime session.
  if(phases.length===2){
   assert.equal(f.bot.inventoryBlocked,true);
   assert.equal(f.calls.length,0);
  }else{
   assert.equal(f.bot.inventoryBlocked,true);
   assert.equal(f.calls.length,0);
  }
 }
});
test('W03 reject API dispatch when its new durable write fails',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 assert.equal(f.bot.bank.recover(),true);
 const call=f.calls.at(-1).options.call;
 f.stopWrites();
 assert.throws(()=>call(),/Dispatch-Beleg/);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.store.get('albot:bank-partial:M'),r);
});
test('W03 persisted first step can advance in a different browser session',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(dispatched(r,['original']));
 f.pack[7]=null;f.inventory[0]={...material};
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.calls.at(-1).kind,'bank.partial.split');
 assert.equal(f.calls.at(-1).options.call(),true);
 const saved=f.store.get('albot:bank-partial:M');
 assert.equal(saved.dispatches.length,2);
 assert.equal(saved.dispatches[0].session,'original-session');
 assert.equal(saved.dispatches[1].session,'new');
});
test('W03 invalid or reordered dispatch history is not admissible',()=>{
 const r=checkpoint();
 for(const d of [
  [step(r,'withdrawn')], [step(r,'original'),step(r,'original')],
  [step(r,'original',{bad:true})], // malformed session
  [step(r,'original','',now)], [step(r,'original','s',now-1)],
  [step(r,'original','s',now+3000)],
  [step(r,'original'),step(r,'withdrawn','s',now-1)]
 ]){
  const invalid=checkpoint({dispatches:d});
  assert.equal(validateBankPartialRecord(invalid,{owner,realm,now}).valid,false);
 }
});

test('W03 partial journal refuses split/return confirmation with invalid quantity components',()=>{
 const r=checkpoint();
 const inventory=blank(),pack=blank();
 const inspect=()=>classifyBankPartialRecord(r,{owner,realm,now,inventory,
  bank:{items0:pack},map:'bank',packMap:()=> 'bank'});
 pack[7]={...material};
 inventory[2]={name:'beewing',q:-1};
 inventory[3]={name:'beewing',q:1};
 assert.equal(inspect().phase,'ambiguous','invalid zero-sum must not prove original');
 inventory[2]=null;inventory[3]=null;
 assert.equal(inspect().phase,'original');
 pack[7]=null;inventory[0]={name:'beewing',q:31};
 inventory[1]={name:'beewing',q:100};
 inventory[2]={name:'beewing',q:.5};
 inventory[3]={name:'beewing',q:-.5};
 assert.equal(inspect().phase,'ambiguous','split not proven by net-zero fractions');
 inventory[2]=null;inventory[3]=null;
 assert.equal(inspect().phase,'split');
 inventory[0]=null;pack[7]={name:'beewing',q:31};
 inventory[2]={name:'beewing',q:null};
 assert.equal(inspect().phase,'ambiguous',
  'an explicitly null quantity is not an implicit one-unit stack');
 inventory[2]=null;
 assert.equal(inspect().phase,'returned');
});

test('W03 partial bank recovery accepts compact packs after each confirmed step',()=>{
 const r=checkpoint(),states=[
  {source:{...material},dest:null,split:null,expected:'original'},
  {source:null,dest:{...material},split:null,expected:'withdrawn'},
  {source:null,dest:{name:'beewing',q:31},
   split:{name:'beewing',q:100},expected:'split'},
  {source:{name:'beewing',q:31},dest:null,
   split:{name:'beewing',q:100},expected:'returned'}
 ];
 for(const s of states){
  const inventory=blank(),pack=blank();
  inventory[0]=s.dest;inventory[1]=s.split;pack[7]=s.source;
  const check=rows=>classifyBankPartialRecord(r,{owner,realm,now,
   inventory,bank:{items0:rows},map:'bank',packMap:()=> 'bank'});
  assert.equal(check(pack).phase,s.expected);
  for(const length of [8,22,41])
   assert.equal(check(pack.slice(0,length)).phase,s.expected);
  const bad=pack.slice(0,9);bad[8]={name:'other',q:null};
  assert.equal(check(bad).phase,'ambiguous');
  assert.equal(check(Array(43).fill(null)).phase,'unobserved');
 }
});
