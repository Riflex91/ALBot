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


test('smart_move is never aborted by the position stall watchdog',()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  let stops=0;const events=[],c={map:'main',in:'main',x:0,y:0};
  const bot={running:true,cfg:{world:{excludedMaps:[]},farming:{pvp:false}},event:(...e)=>events.push(e)};
  bot.p={c,G:{maps:{main:{}}},root:{},parent:{},has:()=>true,call:(name)=>{if(name==='can_move_to')return false;if(name==='stop'){stops++;return Promise.resolve();}if(name==='smart_move')return new Promise(()=>{});}};
  bot.exec=new Executor({now:()=>now,active:()=>true,limit:4,onError(){}});const movement=createMovement(bot),dest={map:'main',in:'main',x:520,y:753,radius:90};
  movement.go(dest,'combat');now+=60000;movement.poll();assert.ok(movement.order,'native smart_move keeps movement ownership while its Promise is pending');assert.equal(stops,0);
  assert.ok(!events.some(([kind,data])=>kind==='movement.failed'&&data.reason==='no_progress'));
 }finally{Date.now=original;}
});

test('plain move still retries after twelve seconds without position progress',()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  let stops=0;const events=[],c={map:'main',in:'main',x:0,y:0};
  const bot={running:true,cfg:{world:{excludedMaps:[]},farming:{pvp:false}},event:(...e)=>events.push(e)};
  bot.p={c,G:{maps:{main:{}}},root:{},parent:{},has:()=>true,call:(name)=>{if(name==='can_move_to')return true;if(name==='stop'){stops++;return Promise.resolve();}if(name==='move')return new Promise(()=>{});}};
  bot.exec=new Executor({now:()=>now,active:()=>true,limit:4,onError(){}});const movement=createMovement(bot),dest={map:'main',in:'main',x:100,y:0,radius:8};
  movement.go(dest,'combat');now+=13000;movement.poll();assert.equal(movement.order,null);assert.equal(stops,1);
  assert.ok(events.some(([kind,data])=>kind==='movement.failed'&&data.reason==='no_progress'));
 }finally{Date.now=original;}
});
