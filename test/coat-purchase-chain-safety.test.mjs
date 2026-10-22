import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingGearChainInput,physicalGearChainStock} from '../src/production/production.mjs';
import {planProduction} from '../src/production/planner.mjs';
const goal={enabled:true,name:'Gear: Optimiertes Gear My_Ranger1 chest',
 item:'coat',level:5,quantity:1,recipient:'My_Ranger1',gearSlot:'chest'};
const step={kind:'buy',item:'coat',level:0,quantity:1};
const items=[{name:'coat',level:5},{name:'coat',level:4},
 {name:'coat',level:2},{name:'coat',level:0}];
test('live reproduction: existing coat +5, +4, +2 and +0 prohibit fresh NPC coat buy',()=>{
 const held=pendingGearChainInput(items,goal,step);
 assert.equal(held?.blocked,true);
 assert.equal(held.reason,'existing-physical-upgrade-input');
 for(let level=0;level<5;level++){
  const expected=items.some(i=>i.level===level)?1:0;
  assert.equal(physicalGearChainStock(items,goal,'coat',level),expected);
 }
 assert.equal(physicalGearChainStock(items,goal,'coat',5),0);
});
test('planner actually mutates existing +4 coat instead of buying +0',()=>{
 const held=[{name:'coat',level:5},{name:'coat',level:4}];
 const plans=planProduction({
  G:{items:{coat:{upgrade:true},scroll0:{}}},
  item:'coat',level:5,quantity:1,
  stock:(name,level)=>physicalGearChainStock(held,goal,name,level),
  bank:()=>0,canBuy:()=>true,allowed:['npc'],helpers:()=>[],
  maxDepth:8,permit:()=>true
 });
 assert.equal(plans.length,1);
 assert.deepEqual(plans[0],{kind:'upgrade',item:'coat',level:4,
   targetLevel:5,quantity:1});
 assert.equal(plans.some(s=>s.kind==='buy'&&s.item==='coat'),false);
});
test('other recipient committed send, explicit keep, locked and banked items are not consumed or used as purchase veto',()=>{
 const opts={explicit:i=>i.name==='coat'?{action:'send',recipient:'My_Ranger2'}:null};
 const blocked=[{name:'coat',level:4}];
 assert.equal(physicalGearChainStock(blocked,goal,'coat',4,opts),0);
 assert.equal(pendingGearChainInput(blocked,goal,step,opts),null);
 for(const i of [{name:'coat',level:4,l:true},
   {name:'coat',level:4,b:true}]){
  assert.equal(physicalGearChainStock([i],goal,'coat',4),0);
  assert.equal(pendingGearChainInput([i],goal,step),null);
 }
 assert.equal(physicalGearChainStock([{name:'coat',level:4}],goal,'coat',4,
  {explicit:()=>({action:'keep'})}),0);
});
test('only an exhausted existing chain can admit a new single base coat',()=>{
 assert.equal(pendingGearChainInput([{name:'coat',level:5}],goal,step),null,
  'one finished unit may already be committed to another recipient');
 assert.equal(pendingGearChainInput([],goal,step),null);
 assert.equal(pendingGearChainInput([{name:'coat',level:0}],goal,step)?.blocked,true,
  'a successful NPC purchase must block the very next stale dispatch');
 assert.equal(pendingGearChainInput(null,goal,step)?.reason,'unknown-inventory');
 assert.equal(pendingGearChainInput([{name:'coat',level:0,q:9}],goal,step)?.reason,
  'invalid-physical-gear-input');
});
test('non-gear NPC consumables are unaffected by the new guard',()=>{
 assert.equal(pendingGearChainInput(items,goal,
  {kind:'buy',item:'scroll0',level:0,quantity:1}),null);
 assert.equal(pendingGearChainInput(items,{...goal,gearSlot:null},step),null);
});
