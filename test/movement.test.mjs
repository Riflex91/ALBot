import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovement} from '../src/core/movement.mjs';
import {Executor} from '../src/core/executor.mjs';
import {combatApproach} from '../src/combat/farmer.mjs';

test('combat approach uses short reachable steps and actual target coordinates behind obstacles',()=>{
 const c={map:'main',in:'main',real_x:200,real_y:770},target={map:'main',in:'main',real_x:520,real_y:753};
 const direct=combatApproach(c,target,90,()=>true);assert.ok(direct.x>200&&direct.x<261);assert.equal(direct.radius,6);
 const route=combatApproach(c,target,90,()=>false);assert.deepEqual(route,{map:'main',in:'main',x:520,y:753,radius:90});
});

test('rejected movement clears ownership, delays retry and ignores completion of canceled routes',async()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  let reject,stops=0;const events=[],c={map:'main',in:'main',x:0,y:0},bot={running:true,cfg:{world:{excludedMaps:[]},farming:{pvp:false}},event:(...e)=>events.push(e)};
  bot.p={c,G:{maps:{main:{}}},root:{},has:()=>true,call:(name)=>{if(name==='can_move_to')return false;if(name==='stop'){stops++;return Promise.resolve();}return new Promise((_,r)=>reject=r);}};
  bot.exec=new Executor({now:()=>now,active:()=>true,limit:4,onError(){}});const movement=createMovement(bot),dest={map:'main',in:'main',x:520,y:753,radius:90};
  movement.go(dest,'combat');assert.ok(movement.order);reject({reason:'failed'});await Promise.resolve();bot.exec.poll();assert.equal(movement.order,null);assert.equal(stops,1);assert.ok(events.some(([k])=>k==='movement.failed'));
  movement.go(dest,'combat');assert.equal(movement.order,null);now+=3001;movement.go(dest,'combat');const canceledReject=reject;movement.stop();movement.go({...dest,x:600},'combat');const latest=movement.order;
  canceledReject({reason:'interrupted'});await Promise.resolve();bot.exec.poll();assert.equal(movement.order,latest);assert.equal(movement.status().destination.x,600);movement.stop();
 }finally{Date.now=original;}
});

test('merchant chooses faster town while moving and waits for observed arrival',async()=>{const calls=[],events=[],c={name:'M',map:'main',in:'main',x:1500,y:0,speed:50,moving:true,c:{}},bot={running:true,me:{role:'merchant'},cfg:{merchant:{townTravel:true,townMinSavingsMs:3000},world:{excludedMaps:[]},farming:{pvp:false}},monsters:()=>[],event:(type,data)=>events.push({type,...data})};bot.p={c,G:{maps:{main:{spawns:[[0,0]]}}},root:{},has:()=>true,call:(id)=>{calls.push(id);if(id==='stop')c.moving=false;return Promise.resolve();}};bot.exec=new Executor({now:()=>Date.now(),active:()=>true,limit:4,onError(){}});const movement=createMovement(bot);movement.go({map:'main',in:'main',x:-35,y:-162},'economy');assert.deepEqual(calls,['stop','town']);movement.go({map:'main',in:'main',x:-35,y:-162},'economy');assert.deepEqual(calls,['stop','town']);assert.equal(movement.order,null);await Promise.resolve();bot.exec.poll();assert.ok(bot.exec.pending.has('travel.town'));c.x=c.y=0;bot.exec.poll();assert.equal(bot.exec.pending.has('travel.town'),false);assert.ok(events.some(e=>e.type==='travel.compare'&&e.savedMs>3000));});

test('smart_move pending pathfinding is not cancelled by twelve-second position-stall watchdog',()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  const events=[],calls=[],c={name:'A',map:'main',in:'main',x:0,y:0,moving:false};
  const bot={running:true,me:{role:'farmer'},cfg:{world:{excludedMaps:[]},farming:{pvp:false}},event:(...e)=>events.push(e)};
  bot.p={c,root:{},parent:{smart:{searching:true,moving:false}},G:{maps:{main:{}}},has:()=>true,call:(name)=>{
   calls.push(name);if(name==='can_move_to')return false;
   if(name==='smart_move')return new Promise(()=>{});
   if(name==='stop')return Promise.resolve();
  }};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot),dest={map:'main',in:'main',x:520,y:753,radius:90};
  movement.go(dest,'combat');
  assert.equal(movement.order?.mode,'smart_move');
  now+=13000;movement.poll();
  assert.equal(movement.order?.mode,'smart_move','Active pathfinding must keep its movement owner');
  assert.equal(calls.filter(x=>x==='stop').length,0);
  now+=46000;movement.poll();
  assert.ok(movement.order,'Still awaiting native smart_move; no false no-progress abort at 59 seconds');
  assert.ok(!events.some(([kind,data])=>kind==='movement.failed'&&data?.reason==='no_progress'));
  movement.stop();
 }finally{Date.now=original;}
});

test('plain move still aborts after twelve seconds without position change',()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  const calls=[],c={map:'main',in:'main',x:0,y:0},bot={running:true,me:{role:'farmer'},cfg:{world:{excludedMaps:[]},farming:{pvp:false}}};
  bot.p={c,root:{},parent:{},G:{maps:{main:{}}},has:()=>true,call:name=>{
   calls.push(name);if(name==='can_move_to')return true;
   if(name==='move')return new Promise(()=>{});
   if(name==='stop')return Promise.resolve();
  }};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot);
  movement.go({map:'main',in:'main',x:100,y:0,radius:8},'combat');
  assert.equal(movement.order?.mode,'move');
  now+=13000;movement.poll();
  assert.equal(movement.order,null);
  assert.equal(calls.filter(x=>x==='stop').length,1);
 }finally{Date.now=original;}
});

test('merchant town transition stops parent smart_move before invoking town',()=>{
 const original=Date.now;let now=40000;Date.now=()=>now;
 try{
  const calls=[],c={name:'M',map:'main',in:'main',x:1500,y:0,speed:50,moving:false,c:{}};
  const bot={running:true,me:{role:'merchant'},cfg:{merchant:{townTravel:true,townMinSavingsMs:3000},world:{excludedMaps:[]},farming:{pvp:false}},monsters:()=>[]};
  bot.p={c,root:{},parent:{smart:{moving:true,searching:true}},G:{maps:{main:{spawns:[[0,0]]}}},has:()=>true,call:name=>{calls.push(name);return Promise.resolve();}};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot);
  movement.go({map:'main',in:'main',x:-35,y:-162,radius:20},'economy');
  assert.deepEqual(calls,['stop','town'],'Stop active parent smart path before channel travel');
  movement.stop();
 }finally{Date.now=original;}
});

test('smart_move remains bounded by the existing 120-second total travel limit',()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  const events=[],calls=[],c={name:'A',map:'main',in:'main',x:0,y:0,moving:false};
  const bot={running:true,me:{role:'farmer'},cfg:{world:{excludedMaps:[]},farming:{pvp:false}},event:(...args)=>events.push(args)};
  bot.p={c,root:{},parent:{smart:{searching:true}},G:{maps:{main:{}}},has:()=>true,call:name=>{
   calls.push(name);if(name==='can_move_to')return false;
   if(name==='smart_move')return new Promise(()=>{});
   if(name==='stop')return Promise.resolve();
  }};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot);
  movement.go({map:'main',in:'main',x:520,y:753,radius:90},'combat');
  now+=120001;movement.poll();
  assert.equal(movement.order,null,'Bounded smart pathfinding must eventually release the movement owner');
  assert.equal(calls.filter(x=>x==='stop').length,1);
  assert.ok(events.some(([kind,data])=>kind==='movement.failed'&&data.reason==='timeout'));
 }finally{Date.now=original;}
});

test('explicit stop cancels parent-owned searching path even without a local order',()=>{
 const calls=[],c={map:'main',in:'main',x:0,y:0,moving:false};
 const bot={running:true,cfg:{world:{excludedMaps:[]},farming:{pvp:false}}};
 bot.p={c,root:{},parent:{smart:{searching:true,moving:false}},G:{maps:{main:{}}},call:name=>{calls.push(name);return Promise.resolve();}};
 bot.exec=new Executor({now:Date.now,active:()=>true,limit:4,onError(){}});
 createMovement(bot).stop();
 assert.deepEqual(calls,['stop']);
});
