import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityAfterConsumption} from '../src/items/physical-capacity.mjs';
import {purchaseFits} from '../src/merchant/economy.mjs';
import {physicalReceiveCapacity} from '../src/items/logistics.mjs';
import {actionCapacity} from '../src/production/production.mjs';

const potion={name:'hpot0',level:0,stat_type:'',p:'',title:''};
const G={items:{hpot0:{type:'pot',s:9999},ring:{type:'ring'}}};
const fillers=n=>Array.from({length:n},(_,k)=>({name:'dummy'+k,level:0}));

test('shared physical planner denies three units when one compatible unit fits at 42/42',()=>{
 const inv=[{...potion,q:9998},...fillers(41)];
 const p=capacityAfterConsumption(inv,[],potion,G.items.hpot0);
 assert.deepEqual([p.free,p.headroom,p.units],[0,1,1]);
 assert.equal(purchaseFits(inv,potion,3,G.items.hpot0),false);
 assert.equal(purchaseFits(inv,potion,1,G.items.hpot0),true);
 assert.equal(physicalReceiveCapacity(inv,potion,G.items.hpot0),1);
 assert.equal(actionCapacity(inv,[],potion,G,3),false);
 assert.equal(actionCapacity(inv,[],potion,G,1),true);
});
test('one real empty slot covers the stack remainder, not a phantom second slot',()=>{
 const inv=[{...potion,q:9998},...fillers(40),null];
 assert.equal(purchaseFits(inv,potion,10000,G.items.hpot0),true);
 assert.equal(purchaseFits(inv,potion,10001,G.items.hpot0),false);
 assert.equal(physicalReceiveCapacity(inv,potion,G.items.hpot0),10000);
 assert.equal(actionCapacity(inv,[],potion,G,10001),false);
});
test('consuming part of 344 items never frees a slot for a nonstackable craft result',()=>{
 const inv=[{name:'seashell',q:344},...fillers(41)];
 assert.equal(actionCapacity(inv,[{slot:0,quantity:10}],{name:'ring',level:0},G,1),false);
 assert.equal(actionCapacity(inv,[{slot:0,quantity:344}],{name:'ring',level:0},G,1),true);
 assert.equal(inv[0].q,344,'a capacity preview must not mutate live inventory');
});
test('crafting three output units into a near-full stack requires real additional room',()=>{
 const inv=[{name:'seashell',q:344},{...potion,q:9998},...fillers(40)];
 assert.equal(actionCapacity(inv,[{slot:0,quantity:10}],potion,G,3),false);
 assert.equal(actionCapacity(inv,[{slot:0,quantity:10}],potion,G,1),true);
 assert.equal(actionCapacity(inv,[{slot:0,quantity:344}],potion,G,3),true);
});
test('variant-locked and protected stacks do not provide imaginary merge headroom',()=>{
 const inv=[{...potion,q:9998,l:true},...fillers(41)];
 assert.equal(capacityAfterConsumption(inv,[],potion,G.items.hpot0).units,0);
 assert.equal(purchaseFits(inv,potion,1,G.items.hpot0),false);
 inv[0]={...potion,q:9998,stat_type:'int'};
 assert.equal(physicalReceiveCapacity(inv,potion,G.items.hpot0),0);
});
test('post-consumption plan rejects invalid or double-accounted inputs',()=>{
 const inv=[{name:'seashell',q:344},...fillers(41)];
 assert.equal(capacityAfterConsumption(inv,[{slot:0,quantity:345}],potion,G.items.hpot0),null);
 assert.equal(capacityAfterConsumption(inv,[{slot:0,quantity:2},{slot:0,quantity:2}],potion,G.items.hpot0),null);
 assert.equal(actionCapacity(inv,[{slot:0,quantity:345}],null,G),false);
});
