import test from 'node:test';
import assert from 'node:assert/strict';
import {createGearAllocation,inspectGearClaimEvidence} from '../src/production/allocation.mjs';
import {identity,fingerprint} from '../src/core/policy.mjs';

const variant={name:'staff',level:3,stat_type:'int'};
const v=identity(variant),fp=fingerprint(variant);
const row=(id,state='unresolved')=>({
 id,recipient:'Priest',recipientSession:'r1',slot:0,
 fingerprint:fp,variant:v,quantity:1,gearSlot:'mainhand',
 expected:fingerprint(null),realm:'EUI',at:Date.now()-120000,
 state,settlement:{receipt:false}
});
function fixture(records=[],inventory=[{...variant}]){
 const store=new Map([['albot:gear:Merchant:allocations',structuredClone(records)]]);
 let writes=true,goal=true;
 const peer={running:true,rip:false,realm:'EUI',session:'r1',
  gear:{slots:{mainhand:null}}};
 const bot={me:{name:'Merchant'},p:{
  c:{items:inventory},realm:()=> 'EUI',
  read:k=>store.get(k)??null,
  write:(k,value)=>{if(!writes)return false;store.set(k,structuredClone(value));return true;}
 },transport:{fresh:()=>peer},
 cfg:{general:{messageTtlMs:10000}},
 gear:{goals:()=>goal?[{name:'Priest staff',recipient:'Priest',
  item:'staff',level:3,gearSlot:'mainhand'}]:[]},
 event:()=>{}};
 return {bot,allocation:createGearAllocation(bot),peer,store,
  setWrites:v=>writes=v,setGoal:v=>goal=v,
  job:()=>({id:'new',to:'Priest',session:'r1',slot:0,
   item:{...variant},fingerprint:fp,quantity:1,
   gear:{goal:'Priest staff',slot:'mainhand',expected:fingerprint(null)},
   gearAck:fingerprint(null)})};
}
test('W13 raw history over 64 keeps every pending claim instead of forgetting older ones',()=>{
 const records=Array.from({length:65},(_,i)=>row('old:'+i));
 const f=fixture(records);
 const status=f.allocation.recoveryStatus();
 assert.equal(status.outstandingCount,65);
 assert.equal(status.unsafeHistory,true);
 assert.equal(status.blockedNewGear,true);
 assert.equal(status.outstanding.length,32,'diagnostic list is bounded');
 assert.equal(f.allocation.status().length,65,'no outstanding claim discarded');
 assert.equal(f.allocation.offer(variant,'Priest'),false);
 assert.equal(f.allocation.guard(f.job()),false);
 assert.equal(f.allocation.reserve(f.job()),false);
 assert.equal(f.store.get('albot:gear:Merchant:allocations').length,65);
});
test('W13 long completed history can be trimmed without losing the few active claims',()=>{
 const records=[row('open:1'),row('open:2','reserved'),
  ...Array.from({length:120},(_,i)=>row('history:'+i,'delivered'))];
 const f=fixture(records,[{...variant},{...variant},{...variant}]);
 assert.equal(f.allocation.recoveryStatus().unsafeHistory,false);
 assert.equal(f.allocation.recoveryStatus().outstandingCount,2);
 assert.equal(f.allocation.status().length,64);
 assert.deepEqual(f.allocation.status().slice(0,2).map(x=>x.id),
  ['open:1','open:2']);
 assert.equal(f.allocation.offer(variant,'Priest')?.slot,'mainhand',
  'the third real copy may be promised, not the first two');
});
test('W13 malformed persisted allocation is a blocking safety fault, not an empty ledger',()=>{
 for(const bad of [5,{},[null],[row('a'),{id:'broken'}],
  [{...row('a'),quantity:0}],
  [{...row('a'),state:'unrecognized'}]]){
  const f=fixture();
  f.store.set('albot:gear:Merchant:allocations',bad);
  const fresh=createGearAllocation(f.bot);
  assert.equal(fresh.recoveryStatus().unsafeHistory,true);
  assert.equal(fresh.offer(variant,'Priest'),false);
  assert.equal(fresh.reserve(f.job()),false);
 }
});
test('W13 audit identifies matching equipped variant but never asserts a successful delivery',()=>{
 const f=fixture([row('lost')]);f.peer.gear.slots.mainhand={...variant};
 const status=f.allocation.recoveryStatus();
 assert.equal(status.authority,'diagnostic-only');
 assert.equal(status.autoClear,false);
 assert.equal(status.autoResend,false);
 assert.equal(status.outstanding[0].recipientSessionVerified,true);
 assert.equal(status.outstanding[0].recipientEquippedVariantMatches,true);
 assert.equal(status.outstanding[0].evidence,
  'matching-gear-is-not-unique-transfer-proof');
 assert.equal(status.outstanding[0].canClearClaim,false);
 assert.equal(status.outstanding[0].canResend,false);
 assert.equal(f.allocation.status()[0].state,'unresolved');
});
test('W13 wrong realm, restarted session or missing recipient gear cannot be a proof',()=>{
 const original=row('lost');
 for(const mutate of [
  p=>{p.realm='USI';},p=>{p.session='reboot';},
  p=>{p.running=false;},p=>{p.rip=true;},
  p=>{p.gear.slots.mainhand={name:'wrong',level:3};}
 ]){
  const f=fixture([original]);
  f.peer.gear.slots.mainhand={...variant};
  mutate(f.peer);
  const audit=f.allocation.recoveryStatus().outstanding[0];
  assert.equal(audit.recipientEquippedVariantMatches,false);
  assert.equal(audit.canClearClaim,false);
 }
 const malformed=inspectGearClaimEvidence({id:'a',state:'unresolved',
  variant:v,quantity:0});
 assert.equal(malformed,null);
});
test('W13 sender persists completed state only if the checkpoint write succeeds',()=>{
 const f=fixture([row('confirmed','delivered')]);
 f.peer.gear.slots.mainhand={...variant};
 f.setWrites(false);
 f.allocation.tick();
 assert.equal(f.allocation.status()[0].state,'delivered');
 f.setWrites(true);
 f.allocation.tick();
 assert.equal(f.allocation.status()[0].state,'equipped');
 assert.equal(f.store.get('albot:gear:Merchant:allocations')[0].state,'equipped');
});
test('W13 no auto-release even with receiver receipt and missing sender inventory',()=>{
 const q={...row('lost'),settlement:{receipt:true}};
 const f=fixture([q],[]);
 f.peer.gear.slots.mainhand={...variant};
 const diag=f.allocation.recoveryStatus().outstanding[0];
 assert.equal(diag.senderStillCarriesUnits,0);
 assert.equal(diag.receiverReceiptRecorded,true);
 assert.equal(diag.recipientEquippedVariantMatches,true);
 assert.equal(diag.canClearClaim,false);
 assert.equal(f.allocation.status()[0].state,'unresolved');
 assert.equal(f.allocation.recoveryStatus().blockedNewGear,false);
});

test('W13 exactly 64 pending records exclude ALL completed history instead of slice(-0)',()=>{
 const pending=Array.from({length:64},(_,i)=>row('claim:'+i));
 const history=Array.from({length:20},(_,i)=>row('old:'+i,'delivered'));
 const f=fixture([...pending,...history]);
 assert.equal(f.allocation.recoveryStatus().unsafeHistory,false);
 assert.equal(f.allocation.status().length,64);
 assert.equal(f.allocation.status().filter(x=>x.state==='delivered').length,0);
 assert.deepEqual(f.allocation.status().map(x=>x.id),pending.map(x=>x.id));
 assert.equal(f.allocation.offer(variant,'Priest'),false);
});
test('W13 a new 64th pending reservation drops only completed history',()=>{
 const pending=Array.from({length:63},(_,i)=>row('claim:'+i));
 const history=Array.from({length:10},(_,i)=>row('old:'+i,'delivered'));
 const f=fixture([...pending,...history],
  Array.from({length:64},()=>({...variant})));
 assert.equal(f.allocation.status().length,64);
 assert.equal(f.allocation.reserve(f.job()),true);
 assert.equal(f.allocation.status().length,64);
 assert.equal(f.allocation.status().filter(x=>x.state==='delivered').length,0);
 assert.equal(f.allocation.recoveryStatus().outstandingCount,64);
 assert.equal(f.allocation.reserve({...f.job(),id:'newer'}),false);
});
