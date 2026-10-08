import test from 'node:test';
import assert from 'node:assert/strict';
import {planProduction} from '../src/production/planner.mjs';
import {Executor} from '../src/core/executor.mjs';
import {createEncounter} from '../src/combat/encounter.mjs';
import {createContentGuard} from '../src/world/content.mjs';
test('craft count distinguishes dispatch batches from produced units including rounded surplus',()=>{
 const G={items:{ore:{},bar:{}},craft:{bar:{items:[[1,'ore']],q:5,cost:0}}};
 const plan=planProduction({G,item:'bar',quantity:11,stock:()=>0,bank:()=>0,canBuy:()=>false,allowed:['craft','farm']});
 assert.equal(plan[0].quantity,3);assert.equal(plan[1].quantity,3);assert.equal(plan[1].outputQuantity,15);
});
test('P90 exchange procurement plans conservative actual input after existing stock',()=>{
 const G={items:{ticket:{e:2},prize:{}},drops:{ticket:[[.1,'prize']]}};
 const input=confidence=>planProduction({G,item:'prize',quantity:1,stock:n=>n==='ticket'?2:0,bank:()=>0,canBuy:()=>false,allowed:['exchange','farm'],confidence})[0].quantity;
 assert.ok(input('p90')>input('mean'));assert.equal(input('mean'),18);
});
test('global dispatch collects producers then rechecks guards and chooses emergency resource owner',()=>{
 const calls=[],exec=new Executor({now:()=>0,active:()=>true,limit:10,onError(){}});let live=true;
 exec.beginFrame();exec.run('purchase',['inventory'],()=>live,()=>calls.push('purchase'));
 exec.run('potion',['inventory'],()=>true,()=>calls.push('potion'));live=false;
 assert.deepEqual(calls,[]);exec.flush();assert.deepEqual(calls,['potion']);assert.equal(exec.pending.has('purchase'),false);
});
test('adaptive pulling requires measured safe baseline and forbids follower independent pulls',()=>{
 let mobs=[];const c={name:'A',hp:100,max_hp:100,mp:100,max_mp:100,xp:0};
 const bot={me:{name:'A'},leader:'A',farmers:['A'],teamNames:['A'],running:true,cfg:{general:{},party:{enabled:true,aoe:true,aoeMaxTargets:5},farming:{maxAggro:5}},p:{c,G:{monsters:{goo:{}}},read:()=>({}),write:()=>true},transport:{fresh:()=>null},capabilities:{snapshot:()=>({aoe:[{capacity:5}]})},monsters:()=>mobs,teamPlan:{target:()=> 'goo',wantsCombat:()=>true},event(){}};
 const encounter=createEncounter(bot);encounter.tick();assert.equal(encounter.status().capacity,1);assert.equal(encounter.permit({}),true);
 mobs=[{target:'A',hp:100}];encounter.tick();assert.equal(encounter.permit({}),false);
 bot.me.name='B';assert.equal(encounter.permit({}),false);assert.equal(encounter.permit({target:'A'}),true);
});
test('stable combat drift remains quarantined while new semantics are unsafe',()=>{
 let safe=true;const bot={me:{name:'A'},cfg:{world:{cacheTtlMs:1}},p:{read:()=>({}),write:()=>true},strategy:{safeTarget:()=>safe},event(){}};
 const guard=createContentGuard(bot);guard.approve('farm:main:goo',{attack:1});assert.equal(guard.approve('farm:main:goo',{attack:999}),false);
 const now=Date.now;Date.now=()=>now()+100;try{safe=false;assert.equal(guard.approve('farm:main:goo',{attack:999}),false);safe=true;assert.equal(guard.approve('farm:main:goo',{attack:999}),true);}finally{Date.now=now;}
});

test('non-dispatched value intent cannot settle or block another action journal',()=>{let journal=null;const exec=new Executor({now:()=>0,active:()=>true,limit:10,onError(){}});exec.beginFrame();exec.run('buy',['inventory'],()=>!journal,()=>{journal='buy';},{value:true,onSettle:()=>assert.fail('Unsent purchase must never settle another journal')});exec.run('potion',['inventory'],()=>!journal,()=>{journal='potion';},{value:true});exec.flush();assert.equal(journal,'potion');assert.equal(exec.pending.has('buy'),false);});

test('channel travel holds movement until observed arrival rather than immediate API return',async()=>{let arrived=false,clock=0;const calls=[],exec=new Executor({now:()=>clock,active:()=>true,limit:10,onError(){}});exec.run('travel.town',['movement'],()=>true,()=>undefined,{waitForObservation:true,observe:()=>arrived,onSettle:r=>calls.push(r)});await Promise.resolve();exec.poll();assert.equal(exec.busy('movement'),true);assert.equal(exec.run('move',['movement'],()=>true,()=>assert.fail('Town channel interrupted')),false);arrived=true;clock=5000;exec.poll();assert.equal(exec.busy('movement'),false);assert.deepEqual(calls,['confirmed']);});

import {createBank} from '../src/merchant/bank.mjs';
test('bank route availability respects full stacks until partial retrieval is enabled',()=>{const cfg={merchant:{partialBank:false}},bot={cfg,me:{name:'M'},p:{c:{bank:{items0:[{name:'elixir',q:12}]}},read:()=>null},economy:{safe:i=>!!i,explicit:()=>null}};const bank=createBank(bot);assert.equal(bank.stock('elixir',0,1),0);cfg.merchant.partialBank=true;assert.equal(bank.stock('elixir',0,1),12);});
