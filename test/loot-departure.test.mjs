import test from 'node:test';
import assert from 'node:assert/strict';
import {collectableChests,createLootDeparture} from '../src/items/loot-departure.mjs';
import {Executor} from '../src/core/executor.mjs';
test('departure never invents capacity, coordinates, instance or reward size',()=>{
 const c={map:'main',in:'one',x:0,y:0},chests={
  good:{x:10,y:0,items:2},big:{x:10,y:0,items:5},
  far:{x:701,y:0,items:1},unknown:{items:1},
  instance:{x:10,y:0,items:1,in:'two'},unknownSize:{x:1,y:0}};
 assert.deepEqual(collectableChests(c,chests,4,2),['good']);
});
test('departure waits for chest observation but releases after bounded timeout',()=>{
 let at=0,calls=0;const chests={a:{x:10,y:0,items:1}};
 const bot={p:{c:{map:'main',x:0,y:0},parent:{chests},realm:()=>'EUI',has:()=>true,call:()=>{calls++;return new Promise(()=>{});}},
  cfg:{farming:{loot:true,freeSlots:1}},free:()=>4,monsters:()=>[],
  running:true,event:()=>{},logistics:{},
  exec:new Executor({now:()=>at,active:()=>true,limit:2,onError:()=>{}})};
 const gate=createLootDeparture(bot,{now:()=>at}),dest={map:'bank',x:0,y:0};
 assert.equal(gate.beforeDeparture(dest,'economy'),false);assert.equal(calls,1);
 at=3500;assert.equal(gate.beforeDeparture(dest,'economy'),true);
 assert.equal(gate.beforeDeparture(dest,'economy'),true);assert.equal(calls,1);
 at=35001;bot.exec.poll();assert.equal(gate.beforeDeparture(dest,'economy'),false);
});
test('survival movement and uncertain inventory do not become trapped by loot',()=>{
 const bot={p:{c:{map:'main',x:0,y:0},parent:{chests:{a:{x:1,y:0,items:1}}},
  realm:()=>'EUI'},cfg:{farming:{loot:true}},free:()=>3,monsters:()=>[],
  inventoryBlocked:true};
 const gate=createLootDeparture(bot);
 assert.equal(gate.beforeDeparture(null,'kite'),true);
 assert.equal(gate.beforeDeparture(null,'economy'),true);
});
