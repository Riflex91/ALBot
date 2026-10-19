import test from 'node:test';
import assert from 'node:assert/strict';
import {identity,verifiedExactGoalIdentity,chooseRule}
 from '../src/core/policy.mjs';
import {exactAutoDeliveryVariant,productionGoalMatchesItem,
 pendingDeliveryRuleNeeds} from '../src/production/production.mjs';
import {purposeReservations} from '../src/production/purpose-allocation.mjs';
import {lootPurposeEvidence} from '../src/items/loot-receipts.mjs';

const item={name:'token',level:1,stat_type:'dex',p:'rare',data:{seed:7}};
const goal=(variant)=>({enabled:true,name:'Ranger token',item:'token',
 level:1,quantity:1,recipient:'Ranger',gearSlot:'mainhand',variant});
const valid={stat_type:'dex',p:'rare',data:{seed:7}};
const evidence=()=>[{id:'chest:X',physical:true,at:100,
 items:[{variant:identity(item),quantity:1}]}];
const purpose=(g)=>purposeReservations({G:{items:{token:{}}},
 goals:[g],stock:()=>1});
const hints=g=>lootPurposeEvidence({proofs:evidence(),inventory:[item],
 gearGoals:[g],reserve:()=>0,now:200});
const capacity=()=>1;

test('W13 canonical goal exact identity remains complete for legal opaque item data',()=>{
 const g=goal({...valid,name:'token',level:1});
 assert.equal(verifiedExactGoalIdentity(g),identity(item));
 assert.equal(exactAutoDeliveryVariant(g),identity(item));
 assert.equal(productionGoalMatchesItem(item,g),true);
 assert.equal(purpose(g).blocked,false);
 assert.equal(purpose(g).quantity(item),1);
 assert.deepEqual(pendingDeliveryRuleNeeds([g],()=>0,'Merchant',capacity)
  .map(r=>r.recipient),['Ranger']);
 assert.deepEqual(hints(g)[0].candidateRecipients,['Ranger']);
 assert.equal(hints(g)[0].dispatchAuthorized,false);
});

test('W13 unsupported variant fields cannot be silently omitted from the physical promise',()=>{
 for(const [key,value] of [
  ['q',1],['src','server:item'],['extra','must-match'],
  ['locked',true],['custom',{required:1}],['owner','Other']
 ]){
  const g=goal({...valid,[key]:value});
  assert.equal(verifiedExactGoalIdentity(g),null,key);
  assert.equal(exactAutoDeliveryVariant(g),null,key);
  assert.equal(productionGoalMatchesItem(item,g),false,key);
  assert.equal(purpose(g).blocked,true,key);
  assert.deepEqual(pendingDeliveryRuleNeeds([g],()=>0,'Merchant',capacity),[],key);
  assert.deepEqual(hints(g)[0].candidateRecipients,[],key);
 }
});

test('W13 cyclic or unrepresentable ignored fields cannot revive an exact goal',()=>{
 const cyclic={token:'x'};cyclic.self=cyclic;
 const candidates=[
  {...valid,extra:cyclic},
  {...valid,extra:1n},
  {...valid,extra:()=>{}},
  {...valid,extra:undefined},
  {...valid,data:{nested:1n}}
 ];
 for(const v of candidates){
  const g=goal(v);
  assert.doesNotThrow(()=>verifiedExactGoalIdentity(g));
  assert.equal(verifiedExactGoalIdentity(g),null);
  assert.deepEqual(pendingDeliveryRuleNeeds([g],()=>0,'Merchant',capacity),[]);
  assert.equal(purpose(g).blocked,true);
  assert.deepEqual(hints(g)[0].candidateRecipients,[]);
 }
});

test('W13 item or level overrides and invalid parent level are not valid proofs',()=>{
 const cases=[
  goal({...valid,name:'another'}),
  goal({...valid,level:2}),
  {...goal(valid),level:100},
  {...goal(valid),level:-1},
  {...goal(valid),item:''}
 ];
 for(const g of cases){
  assert.equal(verifiedExactGoalIdentity(g),null);
  assert.equal(exactAutoDeliveryVariant(g),null);
  assert.equal(productionGoalMatchesItem(item,g),false);
 }
});

test('W13 generic goals keep their normal recipient/stock semantics',()=>{
 const generic=goal(null);
 assert.equal(verifiedExactGoalIdentity(generic),null);
 assert.equal(productionGoalMatchesItem(item,generic),true);
 assert.deepEqual(pendingDeliveryRuleNeeds([generic],()=>0,
  'Merchant',capacity).map(r=>r.recipient),['Ranger']);
 assert.equal(purpose(generic).blocked,false);
 assert.deepEqual(hints(generic)[0].candidateRecipients,['Ranger']);
});

test('W13 verified generated send rules do not widen to unsupported exact fields',()=>{
 const bad=goal({...valid,uid:'not-represented'});
 const rule={enabled:true,_autoProduction:true,name:'Exact send',
  item:'token',action:'send',role:'merchant',character:'Merchant',
  recipient:'Ranger',minLevel:1,maxLevel:1,statType:'dex',
  property:'rare',title:'',priority:100,batch:1,keep:0,
  teamReserve:0,_autoExactVariant:exactAutoDeliveryVariant(bad)};
 const context={role:'merchant',character:'Merchant',
  map:'main',server:'EUI',task:'delivery'};
 assert.equal(rule._autoExactVariant,null);
 assert.equal(chooseRule([rule],item,context),null,
  'missing exact identity must not turn an exact generated rule into generic');
 const normal=goal(valid);
 const accepted={...rule,_autoExactVariant:exactAutoDeliveryVariant(normal)};
 assert.ok(chooseRule([accepted],item,context));
 assert.equal(chooseRule([accepted],{...item,data:{seed:8}},context),null);
});

test('W13 oversize exact identity is denied across every account planning surface',()=>{
 const g=goal({stat_type:'dex',data:{payload:'x'.repeat(600)}});
 assert.equal(verifiedExactGoalIdentity(g),null);
 assert.equal(productionGoalMatchesItem(item,g),false);
 assert.equal(purpose(g).blocked,true);
 assert.deepEqual(pendingDeliveryRuleNeeds([g],()=>0,'Merchant',capacity),[]);
 assert.deepEqual(hints(g)[0].candidateRecipients,[]);
});
