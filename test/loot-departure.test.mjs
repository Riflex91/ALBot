import test from 'node:test';
import assert from 'node:assert/strict';
import {collectableChests,createLootDeparture,createLootBacklog} from '../src/items/loot-departure.mjs';
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


function mockLootBacklog({size=9,free=40}={}){
 let at=10000;
 const chests=Object.fromEntries(Array.from({length:size},(_,i)=>[
  'chest-'+String(i).padStart(2,'0'),{map:'main',in:'main',x:12+i,y:3,items:1}
 ]));
 const calls=[],events=[];
 const bot={running:true,me:{role:'farmer',name:'Self'},teamNames:['Self','Other'],
  p:{c:{map:'main',in:'main',x:0,y:0,rip:false},parent:{chests},
   realm:()=>'EUII',has:n=>n==='loot',
   call:(name,...args)=>{calls.push([name,...args]);return Promise.resolve();}},
  cfg:{farming:{loot:true,lootEveryMs:1800,freeSlots:4}},
  free:()=>free,monsters:()=>[],logistics:{},movement:{order:null},
  strategy:{busy:false},account:{active:()=>true},
  exec:{run:(key,resources,guard,invoke)=>{
   if(!guard())return false;invoke();return true;
  }},event:(type,data)=>events.push({type,...data})};
 const collector=createLootBacklog(bot,{now:()=>at});
 return {bot,collector,chests,calls,events,advance:ms=>{at+=ms;}};
}
test('chest backlog chooses distinct visible chest ids and accelerates collection',()=>{
 const env=mockLootBacklog();
 assert.equal(env.collector.shouldYieldPull(),true);
 assert.equal(env.collector.tick(),true);
 assert.deepEqual(env.calls[0],['loot','chest-00']);
 env.advance(200);
 assert.equal(env.collector.tick(),false);
 env.advance(201);
 assert.equal(env.collector.tick(),true);
 assert.deepEqual(env.calls[1],['loot','chest-01']);
 assert.equal(env.collector.status().visible,9);
 // Chest disappearance alone does not invent an inventory receipt.
 assert.ok(env.events.every(row=>row.outcome!=='physical-receipt'));
});
test('backlog pauses optional pulls for at most four seconds then releases',()=>{
 const env=mockLootBacklog();
 assert.equal(env.collector.shouldYieldPull(),true);
 env.advance(3999);
 assert.equal(env.collector.shouldYieldPull(),true);
 env.advance(1);
 assert.equal(env.collector.shouldYieldPull(),false);
 assert.equal(env.collector.shouldYieldPull(),false);
 assert.equal(env.events.some(row=>row.type==='loot.backlogYieldExpired'),true);
 env.advance(10001);
 assert.equal(env.collector.shouldYieldPull(),true);
});
test('backlog never blocks urgent engaged-team defense or inventory ownership',()=>{
 const env=mockLootBacklog();
 env.bot.monsters=()=>[{hp:100,target:'Other',dead:false}];
 assert.equal(env.collector.shouldYieldPull(),false);
 // Collection may continue opportunistically without owning attack resources.
 assert.equal(env.collector.tick(),true);
 env.bot.monsters=()=>[];
 env.bot.inventoryBlocked=true;
 env.advance(500);
 assert.equal(env.collector.tick(),false);
 assert.equal(env.collector.shouldYieldPull(),false);
 env.bot.inventoryBlocked=false;
 env.bot.logistics.reserved=true;
 assert.equal(env.collector.tick(),false);
 env.bot.logistics.reserved=false;
 env.bot.combatAssessment={emergency:()=>({active:true})};
 assert.equal(env.collector.tick(),false);
 assert.equal(env.collector.shouldYieldPull(),false);
});
test('backlog excludes wrong instance, distant and uncollectable chests',()=>{
 const env=mockLootBacklog({size:0,free:10});
 Object.assign(env.chests,{
  good:{x:10,y:10,items:1},
  other:{x:10,y:10,in:'different',items:1},
  distant:{x:900,y:0,items:1},
  tooLarge:{x:10,y:0,items:7},
  unknown:{x:15,y:0}
 });
 assert.equal(env.collector.status().visible,2);
 assert.equal(env.collector.tick(),true);
 assert.deepEqual(env.calls[0],['loot','good']);
});
test('headless visibility fallback preserves native loot() without fabricated chest ids',()=>{
 const env=mockLootBacklog({size:0});
 assert.equal(env.collector.shouldYieldPull(),false);
 assert.equal(env.collector.tick(),true);
 assert.deepEqual(env.calls,[['loot']]);
 env.advance(1000);
 assert.equal(env.collector.tick(),false);
 env.advance(801);
 assert.equal(env.collector.tick(),true);
});
