import test from 'node:test';
import assert from 'node:assert/strict';
import {createEconomicIntelligence,describeInventoryDisposition} from '../src/production/intelligence.mjs';

const G={items:{ore:{type:'material'},potion:{type:'pot'},ring:{compound:true}}};
function explain(inventory,options={}){
 return describeInventoryDisposition({item:inventory[0],slot:0,inventory,G,
  now:100000, ...options});
}
const sell={name:'Sale rule',action:'sell',keep:0,teamReserve:0,batch:100};

test('W01: one sold unit from a 100-unit stack is never reported as a freed slot',()=>{
 const item={name:'ore',level:0,q:100};
 const result=explain([item],{explicit:{...sell,batch:1}});
 assert.equal(result.state,'explicit-rule-observed');
 assert.equal(result.slotRemovalUpperBound,1);
 assert.equal(result.physicalSlotEffect.potentialFreedSlots,0);
 assert.equal(result.physicalSlotEffect.confirmed,false);
 assert.equal(result.executable,false);
});
test('W01: reservation is gross committed demand and keeps disjoint units',()=>{
 const item={name:'ore',level:0,q:20};
 const result=explain([item],{reserved:6,explicit:{...sell,keep:2}});
 assert.equal(result.stock.local,20);
 assert.equal(result.reservation.grossQuantity,6);
 assert.equal(result.possibleUnreservedQuantity,12);
 assert.equal(result.slotRemovalUpperBound,12);
 assert.equal(result.physicalSlotEffect.potentialFreedSlots,0);
});
test('W01: distinct variant stock cannot satisfy a reservation or justify sale',()=>{
 const item={name:'ring',level:1,stat_type:'int',q:1};
 const different={name:'ring',level:1,stat_type:'str',q:9};
 const result=explain([item,different],{explicit:sell,reserved:1});
 assert.equal(result.stock.local,1);
 assert.equal(result.possibleUnreservedQuantity,0);
 assert.equal(result.state,'no-surplus');
});
test('W01: locked items, useful operating supplies and uncertain quantities remain distinguishable',()=>{
 const locked=explain([{name:'ore',q:2,l:'locked'}],{explicit:sell});
 assert.equal(locked.state,'protected');
 assert.equal(locked.slotRemovalUpperBound,0);
 assert.equal(locked.physicalSlotEffect.potentialFreedSlots,0);
 const potion=explain([{name:'potion',q:8}]);
 assert.equal(potion.state,'purpose-protected');
 assert.equal(potion.purpose.automaticProtection,true);
 const invalid=explain([{name:'ore',q:Infinity}],{explicit:sell});
 assert.equal(invalid.state,'observation-unverified');
 assert.equal(invalid.possibleUnreservedQuantity,null);
});
test('W01: an unresolved value journal takes precedence and never authorizes retry',()=>{
 const result=explain([{name:'ore',q:1}],{explicit:sell,valueBlocked:true});
 assert.equal(result.state,'value-effect-unclear');
 assert.equal(result.physicalSlotEffect.confirmed,false);
 assert.equal(result.executable,false);
});
test('W01: changing inventory slot between observation and explanation fails closed',()=>{
 const item={name:'ore',q:1};
 const result=describeInventoryDisposition({item,slot:0,inventory:[{name:'ore',q:1}],G});
 assert.equal(result.state,'observation-unverified');
});
test('W01: API explanation never invokes the auto planner, sends actions or requests helpers',()=>{
 let dispatches=0,queries=0;
 const item={name:'ore',q:1};
 const bot={
  p:{G:{...G,version:'test'},c:{items:[item]}},
  cfg:{production:{autoDisposition:true}},
  me:{name:'Merchant',role:'merchant'},
  economy:{
   explicit:()=>{queries++;return sell;},
   remaining:()=>true,
   safe:()=>true,
   rules:()=>{dispatches++;throw Error('planner used');}
  },
  production:{reservedQuantity:()=>0},
  event:()=>{dispatches++;},
  transport:{peers:new Map()},
  bank:null
 };
 const intelligence=createEconomicIntelligence(bot);
 const result=intelligence.explainInventorySlot(0);
 assert.equal(result.state,'explicit-rule-observed');
 assert.equal(queries,1);
 assert.equal(dispatches,0);
 assert.equal(result.executable,false);
});

test('W01/W02: opt-in bounded sale is a read-only candidate, never physical confirmation',()=>{
 const item={name:'ore',q:20};
 const rule={...sell,action:'keep',enabled:true,excessAction:'sell',
  targetCount:10,maxCount:12,batch:100};
 const result=explain([item],{explicit:rule,reserved:6});
 assert.equal(result.state,'bounded-excess-observed');
 assert.equal(result.observedRule.action,'sell');
 assert.equal(result.stockPolicy.maximum,12);
 assert.equal(result.stockPolicy.protectedFloor,12);
 assert.equal(result.stockPolicy.boundedExcess,8);
 assert.equal(result.slotRemovalUpperBound,8);
 assert.equal(result.physicalSlotEffect.confirmed,false);
 assert.equal(result.executable,false);
});
test('W01/W02: opt-in never promotes protected potions or insufficient stock to a sale',()=>{
 const item={name:'potion',q:20};
 const rule={...sell,action:'keep',enabled:true,excessAction:'sell',targetCount:10,maxCount:12};
 const held=explain([item],{explicit:rule,reserved:20});
 assert.equal(held.state,'no-surplus');
 assert.equal(held.slotRemovalUpperBound,0);
 const rare=explain([{name:'ore',q:20,stat_type:'str'}],{
  explicit:rule,reserved:0
 });
 assert.equal(rare.state,'no-bounded-excess');
 assert.equal(rare.slotRemovalUpperBound,0);
});

test('G01/W01: removing one fully sold overflow stack does not claim a normal slot',()=>{
 const inv=Array.from({length:44},(_,slot)=>({name:slot===0?'ore':'dummy'+slot,q:1}));
 const report=describeInventoryDisposition({item:inv[0],slot:0,inventory:inv,
  G,explicit:sell,inventorySize:42});
 assert.equal(report.state,'explicit-rule-observed');
 assert.equal(report.slotRemovalUpperBound,1);
 assert.equal(report.physicalSlotEffect.signedFreeBefore,-2);
 assert.equal(report.physicalSlotEffect.signedFreeAfterWholeRemoval,-1);
 assert.equal(report.physicalSlotEffect.potentialFreedSlots,0);
 assert.equal(report.executable,false);
});
