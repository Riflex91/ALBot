import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {classifyBankReclaimRecord,validateBankReclaimRecord,inspectOffsiteBankReclaim}
 from '../src/merchant/bank-reclaim-recovery.mjs';
import {createBank} from '../src/merchant/bank.mjs';

const item={name:'ore',q:10},owner='M',realm='EU:I',pack='items0',now=1700000000000;
const empty=()=>Array(42).fill(null);
function record(extra={}){
 const at=extra.at??now;
 const r={version:2,owner,realm,at,item:{...item},pack,slot:27,
  dest:0,before:0,bankBefore:10,quantity:10,
  gold:1000,sourcePrint:fingerprint(item),expectedSaleGold:20,
  explicitOnly:true,...extra};
 if(!Object.hasOwn(extra,'prepared'))
  r.prepared={at,kind:'bank.reclaim',session:'original-browser-session',
   realm:r.realm,pack:r.pack,slot:r.slot,dest:r.dest,
   sourcePrint:r.sourcePrint};
 return r;
}
const context=(r,{source={...item},target=null,map='bank',bankPresent=true}={})=>{
 const inventory=empty(),bankPack=empty();
 inventory[0]=target;bankPack[27]=source;
 return classifyBankReclaimRecord(r,{owner,realm,now,inventory,
  bank:bankPresent?{items0:bankPack}:{},map,packMap:()=> 'bank'});
};
test('W04 recovery proof requires versioned, addressed owner/realm evidence',()=>{
 assert.equal(validateBankReclaimRecord(record(),{owner,realm,now}).valid,true);
 for(const bad of [{version:1},{owner:'Another'},{realm:'US:I'},
  {sourcePrint:'forged'},{quantity:9},{bankBefore:9},
  {before:-1},{explicitOnly:'yes'},{expectedSaleGold:Infinity},
  {gold:-1},{at:now+5000},{slot:42},{dest:1000},
  {item:{name:'ore',q:10,l:true}},{saleConfirmed:false}]){
  assert.equal(validateBankReclaimRecord(record(bad),{owner,realm,now}).valid,
   false,JSON.stringify(bad));
 }
});
test('W04 recovery states require the exact bank and inventory before/after image',()=>{
 const r=record();
 assert.equal(context(r).phase,'unchanged');
 assert.equal(context(r,{source:null,target:{...item}}).phase,'withdrawn');
 assert.equal(context(record({saleConfirmed:true}),{source:null}).phase,'sold');
 assert.equal(context(r,{source:null}).phase,'ambiguous');
 assert.equal(context(r,{source:{...item,q:8}}).phase,'ambiguous');
 assert.equal(context(r,{source:null,target:{...item,q:9}}).phase,'ambiguous');
 assert.equal(context(record({saleConfirmed:true}),{source:{...item}}).phase,'ambiguous');
 assert.equal(context(r,{source:null,target:{...item,l:true}}).phase,'ambiguous');
});
test('W04 missing or foreign bank observations are never treated as empty slots',()=>{
 assert.equal(context(record(),{bankPresent:false}).phase,'unobserved');
 assert.equal(context(record(),{map:'main'}).phase,'unobserved');
 assert.equal(context(record({realm:'US:I'})).phase,'invalid');
});

function fixture({saved,bankItem={...item},carried=null,realmValue=realm,
 write=true,perform=true,rules=true}={}){
 const store=new Map(saved?[['albot:bank-reclaim:M',saved]]:[]);
 const calls=[],sales=[],notes=[],travels=[],gameCalls=[],items=empty(),bankPack=empty();
 items[0]=carried;bankPack[27]=bankItem;
 const sourceRule={enabled:true,action:'sell',item:'ore',batch:10,
  maxCount:9999,keep:0,teamReserve:0,minPrice:0,maxActions:0};
 const p={c:{map:'bank',items,bank:{items0:bankPack},
  gold:1000,slots:{}},G:{items:{ore:{type:'material',s:9999,g:2}}},
  realm:()=>realmValue,read:k=>store.get(k)??null,
  call:(...args)=>{gameCalls.push(args);return true;},
  write:(k,v)=>{if(write!==true)return false;store.set(k,v);return true;}};
 const bot={p,me:{name:'M',role:'merchant'},session:'new-session',
  cfg:{party:{merchant:'M'},merchant:{bank:true,bankReclaim:true,
   preventiveStorage:true,bankWorkspace:2},production:{
   autoDisposition:false,goals:[],gearTargets:[]}},
  running:true,logistics:{reserved:false},inventoryBlocked:false,
  journal:null,exec:{busy:()=>false},
  free:()=>items.filter(x=>!x).length,
  economy:{
   safe:i=>!!i&&!i.l&&!i.b,
   value:()=>2,explicit:()=>rules?sourceRule:null,
   rules:()=>rules?sourceRule:null,remaining:()=>true,
   count:i=>items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
   spare:()=>10,note:s=>notes.push(s),
   travel:(destination,label)=>{travels.push({destination,label});return false;},
   npcSell:(slot,rule,options)=>{sales.push({slot,rule,options});return true;},
   perform:(kind,args)=>{calls.push({kind,args});return perform;}
  }};
 bot.bank=createBank(bot);
 return {bot,store,calls,sales,notes,travels,gameCalls,bankPack,items,sourceRule};
}
test('W04 restart reconciles untouched bank checkpoint without selling',()=>{
 const f=fixture({saved:record({at:Date.now()})});
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get('albot:bank-reclaim:M'),null);
 assert.equal(f.sales.length,0);
});
test('W04 restart resumes ONLY the fully observed withdrawn bank item',()=>{
 const f=fixture({saved:record({at:Date.now()}),bankItem:null,carried:{...item}});
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.sales.length,1);
 assert.equal(f.bot.bank.pending,true,'no confirmation yet');
 assert.equal(f.sales[0].rule._bankExplicitSource,f.sourceRule);
 // Simulate a separate confirmed executor receipt, not an inferred sale.
 assert.equal(f.sales[0].options.onConfirmed(),true);
 assert.equal(f.store.get('albot:bank-reclaim:M').saleConfirmed,true);
 f.items[0]=null;
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.bank.pending,false);
});
test('W04 a different account realm and legacy unversioned records quarantine',()=>{
 for(const data of [record({at:Date.now(),realm:'US:I'}),
  {...record({at:Date.now()}),version:undefined}]){
  const f=fixture({saved:data});
  assert.equal(f.bot.inventoryBlocked,true);
  assert.equal(f.bot.bank.pending,true);
  assert.equal(f.bot.bank.recoverCapacity(),true);
  assert.equal(f.sales.length,0);
 }
});
test('W04 missing bank pack, altered target or revoked explicit rule never repeat sale',()=>{
 for(const altered of [{bankItem:null,carried:{...item,q:9}},
  {bankItem:{...item,q:8}},
  {bankItem:null,carried:{...item},rules:false}]){
  const f=fixture({saved:record({at:Date.now()}),...altered});
  const prior=f.store.get('albot:bank-reclaim:M');
  f.bot.bank.recoverCapacity();
  assert.equal(f.sales.length,0,JSON.stringify(altered));
  assert.equal(f.bot.bank.pending,true);
  const retained=f.store.get('albot:bank-reclaim:M');
  assert.equal(retained.version,2);
  assert.notEqual(retained.saleConfirmed,true,'withdrawal evidence alone never proves NPC sale');
  if(altered.bankItem===null&&altered.carried?.q===10)
   assert.ok(retained.withdrawal,'exact bank withdrawal is journaled despite revoked sale right');
  else assert.equal(retained,prior,'ambiguous physical source must not mutate checkpoint');
 }
});
test('W04 rejected bank action releases intent only after exact before-image proof',()=>{
 const f=fixture({perform:false});
 f.bot.bank.preventiveDisposition();
 assert.equal(f.bot.bank.preventiveDisposition(),false);
 assert.equal(f.calls.length,1);
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get('albot:bank-reclaim:M'),null);
});
test('W04 failed checkpoint clear retains conservative block after rejected queue',()=>{
 const f=fixture({perform:false});
 const write=f.bot.p.write;
 let calls=0;
 f.bot.p.write=(k,v)=>k==='albot:bank-reclaim:M'?++calls===1?write(k,v):false:write(k,v);
 f.bot.bank.preventiveDisposition();
 assert.equal(f.bot.bank.preventiveDisposition(),false);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.store.get('albot:bank-reclaim:M').version,2);
});

test('W04 persist withdrawal before leaving bank, then drive NPC sale using exact offsite inventory',()=>{
 const f=fixture({saved:record({at:Date.now()}),bankItem:null,carried:{...item}});
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.sales.length,1);
 const receipt=f.store.get('albot:bank-reclaim:M').withdrawal;
 assert.ok(receipt,'physical bank withdrawal must be journaled before NPC travel');
 assert.equal(receipt.bankCount,0);
 assert.equal(receipt.inventoryCount,10);
 assert.equal(receipt.sourcePrint,fingerprint(item));
 f.bot.p.c.map='main';
 f.bot.p.c.bank={}; // server no longer exposes bank packs outside bank
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.sales.length,2,'live carried item may continue an already evidenced sale');
 assert.equal(f.travels.length,0,'no unnecessary bank return before NPC sale');
 assert.equal(f.sales[1].options.onConfirmed(),true);
 f.items[0]=null;
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.sales.length,2,'NPC sale is never repeated after its durable confirmation');
 assert.deepEqual(f.travels.at(-1).destination.map,'bank');
 assert.equal(f.bot.bank.pending,true,'offsite NPC receipt is not an observed bank source');
 f.bot.p.c.map='bank';
 f.bot.p.c.bank={items0:f.bankPack};
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.bank.pending,false,'only a fresh bank/source observation clears checkpoint');
 assert.equal(f.store.get('albot:bank-reclaim:M'),null);
});
test('W04 an offsite v2 checkpoint without a durable withdrawal receipt returns to bank instead of selling',()=>{
 const f=fixture({saved:record({at:Date.now()}),bankItem:null,carried:{...item}});
 f.bot.p.c.map='main';f.bot.p.c.bank={};
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.sales.length,0);
 assert.equal(f.travels.at(-1).destination.map,'bank');
 assert.equal(f.bot.bank.pending,true);
 f.bot.p.c.map='bank';f.bot.p.c.bank={items0:f.bankPack};
 f.bot.bank.recoverCapacity();
 assert.equal(f.sales.length,1,'first reobserve the true addressed withdrawal');
 assert.ok(f.store.get('albot:bank-reclaim:M').withdrawal);
});
test('W04 revoked explicit rule or altered carried stack blocks offsite continuation',()=>{
 for(const options of [{rules:false,carried:{...item}},
  {rules:true,carried:{...item,q:9}}]){
  const saved=record({at:Date.now()}),wd={
   at:Date.now(),realm,pack:'items0',slot:27,dest:0,
   sourcePrint:fingerprint(item),inventoryCount:10,bankCount:0};
  const f=fixture({saved:{...saved,withdrawal:wd},bankItem:null,...options});
  f.bot.p.c.map='main';f.bot.p.c.bank={};
  f.bot.bank.recoverCapacity();
  assert.equal(f.sales.length,0,JSON.stringify(options));
  assert.equal(f.bot.bank.pending,true);
 }
});
test('W04 old v2 already-confirmed NPC sale only returns to bank and never sells again',()=>{
 const f=fixture({saved:record({at:Date.now(),saleConfirmed:true}),
  bankItem:null,carried:null});
 f.bot.p.c.map='main';f.bot.p.c.bank={};
 f.bot.bank.recoverCapacity();
 assert.equal(f.sales.length,0);
 assert.equal(f.travels.at(-1).destination.map,'bank');
 f.bot.p.c.map='bank';f.bot.p.c.bank={items0:f.bankPack};
 f.bot.bank.recoverCapacity();
 assert.equal(f.bot.bank.pending,false);
});
test('W04 a failure to persist withdrawal receipt blocks travel to NPC or sale',()=>{
 const f=fixture({saved:record({at:Date.now()}),bankItem:null,carried:{...item},write:false});
 f.bot.bank.recoverCapacity();
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.sales.length,0);
 assert.equal(f.bot.bank.pending,true);
});
test('W04 offsite receipt fails closed when altered, missing or forged',()=>{
 const base=record(),wd={at:now,realm,pack:'items0',slot:27,dest:0,
  sourcePrint:fingerprint(item),inventoryCount:10,bankCount:0};
 for(const corrupt of [{slot:22},{bankCount:1},{inventoryCount:9},
  {sourcePrint:'forged'},{at:now-1},{realm:'US:I'}]){
  const bad=record({withdrawal:{...wd,...corrupt}});
  assert.equal(validateBankReclaimRecord(bad,{owner,realm,now}).valid,false,
   JSON.stringify(corrupt));
 }
 const inventory=empty();inventory[0]={...item};
 assert.equal(inspectOffsiteBankReclaim(record(),{owner,realm,now,inventory}).eligible,false);
 assert.equal(inspectOffsiteBankReclaim(record({withdrawal:wd}),{
  owner,realm,now,inventory}).eligible,true);
 inventory[0]={...item,q:9};
 assert.equal(inspectOffsiteBankReclaim(record({withdrawal:wd}),{
  owner,realm,now,inventory}).eligible,false);
 assert.equal(inspectOffsiteBankReclaim(record({withdrawal:wd,saleConfirmed:true}),{
  owner,realm,now,inventory}).eligible,false);
});

const dispatch=(r,at=Date.now())=>({
 at,kind:'bank.reclaim',session:'original-browser-session',
 realm:r.realm,pack:r.pack,slot:r.slot,dest:r.dest,
 sourcePrint:r.sourcePrint
});
test('W04 bank_retrieve is never called before a durable dispatch receipt exists',()=>{
 const f=fixture();
 f.bot.bank.preventiveDisposition();
 f.bot.bank.preventiveDisposition();
 assert.equal(f.calls.length,1,'reclaim intent is enqueued exactly once');
 assert.equal(f.gameCalls.length,0,'enqueue alone is not server execution');
 const before=f.store.get('albot:bank-reclaim:M');
 assert.equal(before.dispatch,undefined);
 const invoke=f.calls[0].args.call;
 assert.equal(invoke(),true);
 assert.deepEqual(f.gameCalls[0],['bank_retrieve','items0',27,0]);
 const after=f.store.get('albot:bank-reclaim:M');
 assert.equal(after.version,2);
 assert.equal(after.dispatch.kind,'bank.reclaim');
 assert.equal(after.dispatch.sourcePrint,after.sourcePrint);
 assert.equal(after.dispatch.session,'new-session');
 const diagnosed=f.bot.bank.recoveryStatus();
 assert.equal(diagnosed.reclaim.dispatchRecorded,true);
 assert.equal(diagnosed.reclaim.phase,'dispatched-unchanged');
 assert.equal(diagnosed.requiresManualReview,true);
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.inventoryBlocked,true,'no immediate release after uncertain dispatch');
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.gameCalls.length,1,'no duplicate bank_retrieve');
});
test('W04 failed dispatch receipt write blocks API call even with a queued closure',()=>{
 const f=fixture();
 f.bot.bank.preventiveDisposition();
 f.bot.bank.preventiveDisposition();
 assert.equal(f.calls.length,1);
 const write=f.bot.p.write;
 f.bot.p.write=(k,v)=>k==='albot:bank-reclaim:M'&&v?.dispatch?
  false:write(k,v);
 assert.throws(()=>f.calls[0].args.call(),/dauerhaften Beleg/);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.gameCalls.length,0,'never call game when durable receipt failed');
 assert.equal(f.store.get('albot:bank-reclaim:M').dispatch,undefined);
 assert.equal(f.bot.bank.pending,true);
});
test('W04 rejected queued action remains releasable if never actually dispatched',()=>{
 const f=fixture({perform:false});
 f.bot.bank.preventiveDisposition();
 f.bot.bank.preventiveDisposition();
 assert.equal(f.calls.length,1);
 assert.equal(f.store.get('albot:bank-reclaim:M'),null);
 assert.equal(f.gameCalls.length,0);
});
test('W04 legacy V2 without preparation cannot be mistaken for a never-sent request',()=>{
 const old=record({at:Date.now(),prepared:undefined});
 const f=fixture({saved:old});
 assert.equal(f.bot.bank.recoveryStatus().reclaim.phase,'legacy-unchanged-uncertain');
 assert.equal(f.bot.bank.recoveryStatus().requiresManualReview,true);
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.sales.length,0);
 assert.equal(f.gameCalls.length,0);
 assert.deepEqual(f.store.get('albot:bank-reclaim:M'),old);
});
test('W04 new prepared unchanged checkpoint may be cleared without an API dispatch',()=>{
 const recent=record({at:Date.now()});
 const f=fixture({saved:recent});
 assert.equal(f.bot.bank.recoveryStatus().reclaim.phase,'unchanged');
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get('albot:bank-reclaim:M'),null);
});
test('W04 malformed prepared receipt blocks all automatic bank recovery',()=>{
 const r=record();
 for(const corrupted of [{kind:'bank.other'},{session:''},
  {slot:1},{realm:'other'},{pack:'items3'},{at:now-1},
  {sourcePrint:'incorrect'},{dest:99}]){
  const bad=record({prepared:{...r.prepared,...corrupted}});
  assert.equal(validateBankReclaimRecord(bad,{owner,realm,now}).valid,
   false,JSON.stringify(corrupted));
  assert.equal(context(bad).phase,'invalid');
 }
});
test('W04 a restart with dispatched unchanged source does not release intent',()=>{
 const r=record({at:Date.now()});
 const f=fixture({saved:{...r,dispatch:dispatch(r)}});
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.bot.bank.recoveryStatus().reclaim.phase,'dispatched-unchanged');
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.sales.length,0);
 assert.equal(f.gameCalls.length,0);
 assert.ok(f.store.get('albot:bank-reclaim:M').dispatch);
});
test('W04 a dispatched call can progress if exact withdrawn source becomes visible',()=>{
 const r=record({at:Date.now()});
 const f=fixture({saved:{...r,dispatch:dispatch(r)},
  bankItem:null,carried:{...item}});
 assert.equal(f.bot.bank.recoveryStatus().reclaim.phase,'withdrawn');
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.sales.length,1);
 const saved=f.store.get('albot:bank-reclaim:M');
 assert.ok(saved.withdrawal);
 assert.ok(saved.dispatch);
});
test('W04 invalid dispatch provenance cannot authorize sale or journal clearance',()=>{
 const r=record(),d=dispatch(r,now);
 for(const bad of [{kind:'bank.other'},{session:''},{realm:'US:I'},
  {pack:'items1'},{slot:20},{dest:5},{sourcePrint:'forged'},
  {at:now-1},{at:now+5000}]){
  const recordWithBad={...r,dispatch:{...d,...bad}};
  assert.equal(validateBankReclaimRecord(recordWithBad,{owner,realm,now}).valid,
   false,JSON.stringify(bad));
  assert.equal(context(recordWithBad).phase,'invalid');
 }
});
