import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalInventoryCapacity,capacityAfterConsumption} from '../src/items/physical-capacity.mjs';
import {purchaseFits} from '../src/merchant/economy.mjs';
import {physicalReceiveCapacity} from '../src/items/logistics.mjs';
import {actionCapacity} from '../src/production/production.mjs';

const G={items:{ring:{type:'ring'},pot:{type:'pot',s:9999}}};
const dummy=n=>({name:'filler'+n,level:0});
const filled=n=>Array.from({length:n},(_,i)=>dummy(i));
const ring={name:'ring',level:0};
const opts={inventorySize:42};

test('G01 signed capacity reproduces official isize=42, occupied=44 case',()=>{
 const items=filled(44);
 const initial=physicalInventoryCapacity(items,opts);
 assert.equal(initial.signedFree,-2);
 assert.equal(initial.overflowDebt,2);
 assert.equal(initial.overflowEntries,2);
 assert.equal(initial.overflowOccupied,2);
 assert.equal(initial.occupied,44);
 const after=capacityAfterConsumption(items,[{slot:3,quantity:1}],
  ring,G.items.ring,opts);
 assert.deepEqual([after.signedFree,after.free,after.units],[-1,0,0]);
 assert.equal(actionCapacity(items,[{slot:3,quantity:1}],ring,G,1,opts),false);
 assert.equal(items[3].name,'filler3','pure preview never consumes an input');
});
test('G01 two removed whole stacks clear overflow debt, three create one normal slot',()=>{
 const items=filled(44);
 const consumed=n=>Array.from({length:n},(_,slot)=>({slot,quantity:1}));
 const two=capacityAfterConsumption(items,consumed(2),null,null,opts);
 const three=capacityAfterConsumption(items,consumed(3),ring,G.items.ring,opts);
 assert.equal(two.signedFree,0);
 assert.equal(two.free,0);
 assert.equal(three.signedFree,1);
 assert.equal(three.free,1);
 assert.equal(three.units,1);
 assert.equal(actionCapacity(items,consumed(3),ring,G,1,opts),true);
});
test('G01 a hole in normal range does not grant a phantom slot while overflow persists',()=>{
 const items=filled(43);items[0]=null;
 const capacity=physicalInventoryCapacity(items,opts);
 assert.equal(capacity.emptyEntries,1);
 assert.equal(capacity.signedFree,0);
 assert.equal(capacity.free,0);
 assert.equal(capacity.overflowOccupied,1);
 assert.equal(purchaseFits(items,ring,1,G.items.ring,opts),false);
 assert.equal(physicalReceiveCapacity(items,ring,G.items.ring,opts),0);
});
test('G01 a freed overflow row does not grant any new ordinary receiving slot',()=>{
 const items=filled(44);
 const result=capacityAfterConsumption(items,[{slot:43,quantity:1}],
  ring,G.items.ring,opts);
 assert.equal(result.signedFree,-1);
 assert.equal(result.free,0);
 assert.equal(result.units,0);
});
test('G01 compatible stack headroom is independent from signed free slots',()=>{
 const pot={name:'pot',level:0,q:9998};
 const items=[pot,...filled(43)];
 const plan=capacityAfterConsumption(items,[],pot,G.items.pot,opts);
 assert.deepEqual([plan.signedFree,plan.free,plan.headroom,plan.units],
  [-2,0,1,1]);
 assert.equal(purchaseFits(items,pot,1,G.items.pot,opts),true);
 assert.equal(purchaseFits(items,pot,2,G.items.pot,opts),false);
 assert.equal(physicalReceiveCapacity(items,pot,G.items.pot,opts),1);
 assert.equal(physicalReceiveCapacity(items,pot,G.items.pot,
  {inventorySize:42,maxNewSlots:0}),1);
});
test('G01 locked or different-variant stacks cannot invent receiving capacity',()=>{
 const items=[{name:'pot',q:9998,stat_type:'int'},...filled(43)];
 assert.equal(physicalReceiveCapacity(items,{name:'pot',level:0},
  G.items.pot,opts),0);
 items[0]={name:'pot',q:9998,l:true};
 assert.equal(purchaseFits(items,{name:'pot',level:0},1,G.items.pot,opts),false);
});
test('G01 a partial stack reduction does not create ordinary free slots',()=>{
 const items=[{name:'pot',q:50},...filled(43)];
 const plan=capacityAfterConsumption(items,[{slot:0,quantity:49}],
  ring,G.items.ring,opts);
 assert.equal(plan.signedFree,-2);
 assert.equal(plan.free,0);
 assert.equal(plan.units,0);
});
test('G01 actual isize prevails over nominal arrays, even with holes',()=>{
 const items=filled(42);items[0]=null;
 const result=physicalInventoryCapacity(items,{inventorySize:40});
 assert.equal(result.signedFree,-1);
 assert.equal(result.free,0);
 assert.equal(result.overflowDebt,1);
 assert.equal(physicalInventoryCapacity(items,opts).free,1);
});
test('G01 invalid capacity proof fails closed, including buy and output planner',()=>{
 const items=filled(44);
 assert.equal(physicalInventoryCapacity(items,{inventorySize:-1}),null);
 assert.equal(capacityAfterConsumption(items,[],ring,G.items.ring,
  {inventorySize:NaN}),null);
 assert.equal(purchaseFits(items,ring,1,G.items.ring,{inventorySize:-1}),false);
 assert.equal(actionCapacity(items,[],ring,G,1,{inventorySize:-1}),false);
});
test('G01 42/42 remains full; confirmed whole-stack consumption really releases a slot',()=>{
 const items=filled(42);
 assert.equal(physicalInventoryCapacity(items,opts).signedFree,0);
 assert.equal(purchaseFits(items,ring,1,G.items.ring,opts),false);
 const plan=capacityAfterConsumption(items,[{slot:41,quantity:1}],
  ring,G.items.ring,opts);
 assert.equal(plan.free,1);
 assert.equal(plan.units,1);
});
