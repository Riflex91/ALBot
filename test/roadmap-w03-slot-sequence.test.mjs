import test from 'node:test';
import assert from 'node:assert/strict';
import {planPhysicalSlotSequence} from '../src/items/slot-sequence.mjs';
import {forecastExchange} from '../src/merchant/storage-plan.mjs';

const G={items:{
 ore:{type:'material',s:9999},potion:{type:'pot',s:10},
 ring:{type:'ring'},scroll:{type:'uscroll',s:9999}
},drops:{ore:[[1,'ring',1]]}};
const fill=n=>Array.from({length:n},(_,k)=>({name:'dummy'+k,level:0}));
const proof=(items,steps,options={})=>planPhysicalSlotSequence(items,steps,G,{
 inventorySize:42,...options});
const remove=(id,slot,quantity=1)=>({id,kind:'remove',slot,quantity,permitted:true});
const withdraw=(id,item={name:'ring'})=>({
 id,kind:'withdraw',item,quantity:item.q??1,permitted:true
});
const receive=(id,item,quantity)=>({id,kind:'receive',item,quantity,permitted:true});
const merge=(id,source,destination)=>({id,kind:'merge',source,destination,permitted:true});

test('W03: bounded search finds remove-before-withdraw despite greedy input order',()=>{
 const items=fill(42);
 const result=proof(items,[withdraw('withdraw'),remove('sell',0)]);
 assert.equal(result.feasible,true);
 assert.deepEqual(result.steps.map(s=>s.id),['sell','withdraw']);
 assert.deepEqual(result.steps.map(s=>s.beforeSignedFree),[0,1]);
 assert.deepEqual(result.steps.map(s=>s.afterSignedFree),[1,0]);
 assert.equal(result.steps[0].freedNormalSlots,1);
 assert.equal(result.steps[1].newSlots,1);
 assert.equal(result.nextStep.kind,'remove');
 assert.equal(result.steps.every(s=>s.postActionConfirmationRequired),true);
 assert.equal(result.executable,false);
 assert.equal(result.confirmed,false);
 assert.equal(items[0].name,'dummy0');
});
test('W03: a partial sale does not free a stack for a following bank withdrawal',()=>{
 const items=[{name:'ore',q:100},...fill(41)];
 const result=proof(items,[remove('partial',0,1),withdraw('withdraw')]);
 assert.equal(result.feasible,false);
 assert.equal(result.reason,'no-proven-physical-sequence');
 const full=proof(items,[remove('full',0,100),withdraw('withdraw')]);
 assert.equal(full.feasible,true);
 assert.equal(full.steps[0].freedNormalSlots,1);
});
test('W03: never infer space from unknown, unpermitted or listed items',()=>{
 const items=fill(42);
 const notPermitted=proof(items,[withdraw('withdraw'),{...remove('sell',0),permitted:false}]);
 assert.equal(notPermitted.feasible,false);
 assert.equal(notPermitted.reason,'invalid-or-unpermitted-step');
 const listed=proof(items,[{id:'list',kind:'list',permitted:true}]);
 assert.equal(listed.feasible,false);
 assert.equal(listed.reason,'invalid-or-unpermitted-step');
});
test('W03: a validated compatible merge can make a new physical slot',()=>{
 const items=[{name:'potion',q:4},{name:'potion',q:6},...fill(40)];
 const result=proof(items,[withdraw('withdraw'),merge('merge',0,1)]);
 assert.equal(result.feasible,true);
 assert.deepEqual(result.steps.map(s=>s.kind),['merge','withdraw']);
 assert.equal(result.steps[0].mergedUnits,4);
 assert.equal(result.steps[0].freedNormalSlots,1);
});
test('W03: incompatible, overfull or protected merges never make room',()=>{
 const different=[{name:'potion',q:4,stat_type:'int'},
  {name:'potion',q:6},...fill(40)];
 assert.equal(proof(different,[merge('merge',0,1)]).feasible,false);
 const over=[{name:'potion',q:5},{name:'potion',q:6},...fill(40)];
 assert.equal(proof(over,[merge('merge',0,1)]).feasible,false);
 const locked=[{name:'potion',q:4,l:true},{name:'potion',q:6},...fill(40)];
 assert.equal(proof(locked,[merge('merge',0,1)]).feasible,false);
});
test('W03/G01: three whole removals must clear 44/42 overflow before withdrawal',()=>{
 const items=fill(44);
 const two=proof(items,[remove('r0',0),remove('r1',1),withdraw('w')]);
 assert.equal(two.feasible,false);
 const three=proof(items,[withdraw('w'),remove('r0',0),remove('r1',1),remove('r2',2)]);
 assert.equal(three.feasible,true);
 assert.equal(three.before.signedFree,-2);
 assert.deepEqual(three.steps.map(s=>s.afterSignedFree),[-1,0,1,0]);
});
test('W03: stack-compatible receiving uses headroom but bank withdrawal needs a slot',()=>{
 const items=[{name:'potion',q:9},...fill(41)];
 const merged=proof(items,[receive('receive',{name:'potion'},1)]);
 assert.equal(merged.feasible,true);
 assert.equal(merged.steps[0].mergedUnits,1);
 assert.equal(merged.steps[0].newSlots,0);
 assert.equal(proof(items,[withdraw('bank',{name:'potion',q:1})]).feasible,false);
});
test('W03: incoming multi-unit stack fills verified headroom and one new slot',()=>{
 const items=[{name:'potion',q:9},...fill(40),null];
 const result=proof(items,[receive('receive',{name:'potion'},5)]);
 assert.equal(result.feasible,true);
 assert.equal(result.steps[0].mergedUnits,1);
 assert.equal(result.steps[0].newSlots,1);
 assert.equal(result.after.free,0);
});
test('W03: withdrawals require a real whole observed bank stack',()=>{
 const items=[null,...fill(41)];
 const invalid=proof(items,[{...withdraw('w',{name:'potion',q:5}),quantity:1}]);
 assert.equal(invalid.feasible,false);
 assert.equal(proof(items,[withdraw('w',{name:'potion',q:5})]).feasible,true);
});
test('W03: deterministic craft plans consumed slots AND produced output',()=>{
 const items=[{name:'ore',q:2},{name:'ore',q:2},...fill(40)];
 const craft={id:'craft',kind:'produce',permitted:true,deterministic:true,
  inputs:[{slot:0,quantity:2},{slot:1,quantity:2}],
  outputs:[{item:{name:'ring'},quantity:1}]};
 const result=proof(items,[craft]);
 assert.equal(result.feasible,true);
 assert.equal(result.steps[0].consumed.length,2);
 assert.equal(result.steps[0].newSlots,1);
 assert.equal(result.after.free,1);
});
test('W03: unverified random output is not treated as guaranteed production',()=>{
 const items=[{name:'ore',q:2},...fill(41)];
 const craft={id:'random',kind:'produce',permitted:true,
  inputs:[{slot:0,quantity:2}],outputs:[{item:{name:'ring'},quantity:1}]};
 assert.equal(proof(items,[craft]).feasible,false);
 assert.equal(proof(items,[{...craft,deterministic:true,
  outcomes:[[{item:{name:'ring'},quantity:1}],[]]}]).feasible,false);
});
test('W03: output metadata, negative quantities and protected inputs fail closed',()=>{
 const items=[{name:'ore',q:2},...fill(41)];
 const base={id:'craft',kind:'produce',permitted:true,deterministic:true,
  inputs:[{slot:0,quantity:2}],outputs:[{item:{name:'unlisted'},quantity:1}]};
 assert.equal(proof(items,[base]).feasible,false);
 assert.equal(proof(items,[{...base,outputs:[{item:{name:'ring'},quantity:-1}]}]).feasible,false);
 const locked=[{name:'ore',q:2,l:true},...fill(41)];
 assert.equal(proof(locked,[{...base,outputs:[{item:{name:'ring'},quantity:1}]}]).feasible,false);
});
test('W03: action dependencies and bounded search terminate deterministically',()=>{
 const items=fill(42);
 const steps=[withdraw('w'),{...remove('r',0),after:['w']}];
 assert.equal(proof(items,steps).feasible,false);
 const valid=proof(items,[{...withdraw('w'),after:['r']},remove('r',0)]);
 assert.equal(valid.feasible,true);
 assert.deepEqual(valid.steps.map(s=>s.id),['r','w']);
 assert.equal(proof(items,valid.steps.map(s=>({...s,permitted:true,kind:'remove',slot:0,quantity:1})),
  {maxStates:0}).reason,'invalid-or-unbounded-request');
 const cyclic=proof(items,[{...withdraw('w'),after:['r']},
  {...remove('r',0),after:['w']}]);
 assert.equal(cyclic.feasible,false);
 assert.equal(cyclic.reason,'no-proven-physical-sequence');
});
test('W03/G01: exchange capacity uses signed headroom, not overflow holes',()=>{
 const items=[{name:'ore',q:1},...fill(43)];
 const forecast=forecastExchange(G,items,0,1,{inventorySize:42});
 assert.equal(forecast.known,true);
 assert.equal(forecast.freeBefore,0);
 assert.equal(forecast.freeAfterConsumption,0);
 assert.equal(forecast.worstOutputSlots,1);
 assert.equal(forecast.worstFree,-1);
});

test('W02/W04 malformed initial stock cannot certify a physical slot chain',()=>{
 for(const q of [null,0,-1,.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1]){
  const items=[{name:'ore',q},null,...fill(40)];
  const result=proof(items,[withdraw('bank',{name:'ring'})]);
  assert.equal(result.feasible,false,String(q));
  assert.equal(result.reason,'invalid-inventory');
  assert.equal(result.executable,false);
 }
 assert.equal(proof([{name:'ore'},null,...fill(40)],
  [withdraw('bank',{name:'ring'})]).feasible,true,
  'only an absent q may represent an unstacked ordinary item');
});

test('W02/W04 bank staging rejects false single-unit source quantities',()=>{
 const items=[null,...fill(41)];
 for(const q of [null,0,-1,1.5,NaN]){
  const result=proof(items,[{...withdraw('bank',{name:'ring',q}),
   quantity:1}]);
  assert.equal(result.feasible,false,String(q));
  assert.equal(result.reason,'no-proven-physical-sequence');
 }
 assert.equal(proof(items,[withdraw('bank',{name:'ring',q:1})]).feasible,true);
 assert.equal(proof(items,[withdraw('bank',{name:'ring'})]).feasible,true);
});

test('W02/W04 receive and production outputs cannot silently normalize contradicting stack q',()=>{
 const items=[null,...fill(41)];
 for(const q of [null,0,-1,2,NaN]){
  const receiveResult=proof(items,[receive('gift',{name:'potion',q},1)]);
  assert.equal(receiveResult.feasible,false,String(q));
  const produced=proof([{name:'ore',q:1},...fill(41)],[{
   id:'craft',kind:'produce',permitted:true,deterministic:true,
   inputs:[{slot:0,quantity:1}],
   outputs:[{item:{name:'ring',q},quantity:1}]
  }]);
  assert.equal(produced.feasible,false,String(q));
 }
 assert.equal(proof(items,[receive('gift',{name:'potion'},1)]).feasible,true);
 assert.equal(proof(items,[receive('gift',{name:'potion',q:1},1)]).feasible,true);
});

test('W02/W04 protected quantity drift cannot create empty slots through remove or merge',()=>{
 for(const q of [null,-1,.5]){
  const items=[{name:'potion',q},{name:'potion',q:5},...fill(40)];
  assert.equal(proof(items,[remove('remove',0)]).feasible,false);
  assert.equal(proof(items,[merge('merge',0,1)]).feasible,false);
 }
 const good=[{name:'potion',q:4},{name:'potion',q:6},...fill(40)];
 assert.equal(proof(good,[merge('merge',0,1)]).feasible,true);
});

test('W03 observed source stacks respect per-item maximum before any slot proof',()=>{
 for(const invalid of [
   {name:'potion',q:11},{name:'ring',q:2},
   {name:'ore',q:10000},{name:'unknown-material',q:2}
 ]){
  const result=proof([invalid,null,...fill(40)],
   [withdraw('bank',{name:'ring'})]);
  assert.equal(result.feasible,false,JSON.stringify(invalid));
  assert.equal(result.reason,'invalid-inventory');
  assert.equal(result.executable,false);
 }
 for(const valid of [
   {name:'potion',q:10},{name:'ring'},
   {name:'ore',q:9999},{name:'unknown-material'}
 ]){
  assert.equal(proof([valid,null,...fill(40)],
   [withdraw('bank',{name:'ring'})]).feasible,true,
   JSON.stringify(valid));
 }
 // Overflow changes slot availability, never raises the per-stack cap.
 const overflow=[{name:'potion',q:11},...fill(43)];
 assert.equal(proof(overflow,[remove('free',0,11)]).reason,
  'invalid-inventory');
});


test('W03 cyclic or unserializable physical input never crashes the slot planner',()=>{
 for(const item of [
  {name:'ring',data:{self:null}},
  {name:'ring',data:1n},
  {name:'ring',acc:123,data:{value:1n}},
  {name:'ring',data:'x'.repeat(5000)}
 ]){
  if(item.data?.self===null)item.data.self=item.data;
  const items=[item,null,...fill(40)];
  const r=proof(items,[withdraw('w',{name:'ring'})]);
  assert.equal(r.feasible,false);
  assert.equal(r.reason,'invalid-inventory');
  assert.equal(r.executable,false);
 }
 assert.equal(proof([{name:'ring',data:{id:'real'}},null,...fill(40)],
  [remove('r',0),withdraw('w',{name:'ring'})]).feasible,true,
  'ordinary serializable metadata must remain feasible');
});
test('W03 cyclic or oversized incoming variants cannot fabricate slot feasibility',()=>{
 const circular={name:'ring',data:{}};
 circular.data.loop=circular.data;
 for(const candidate of [circular,{name:'ring',data:1n},
  {name:'ring',data:'x'.repeat(5000)}]){
  const inventory=[null,...fill(41)];
  for(const step of [
   receive('mail',candidate,1),
   {...withdraw('bank'),item:candidate,quantity:1},
   {id:'produce',kind:'produce',permitted:true,deterministic:true,
    inputs:[{slot:1,quantity:1}],outputs:[{item:candidate,quantity:1}]}
  ]){
   assert.doesNotThrow(()=>proof(inventory,[step]));
   const result=proof(inventory,[step]);
   assert.equal(result.feasible,false,step.kind);
   assert.equal(result.reason,'no-proven-physical-sequence',step.kind);
  }
 }
});

test('W03 unoccupied slots are never executable source removals or mergers',()=>{
 const items=[null,...fill(41)];
 const phantom=proof(items,[remove('phantom',0)]);
 assert.equal(phantom.feasible,false);
 assert.equal(phantom.reason,'no-proven-physical-sequence');
 assert.equal(proof(items,[merge('phantom-merge',0,1)]).feasible,false);
 assert.equal(proof(items,[merge('phantom-merge',0,0)]).feasible,false);
 const real=proof(items,[remove('real',1)]);
 assert.equal(real.feasible,true);
 assert.equal(real.steps[0].freedNormalSlots,1);
});
