import test from 'node:test';
import assert from 'node:assert/strict';
import {planProduction} from '../src/production/planner.mjs';
import {materialSources,exchangeSource} from '../src/production/materials.mjs';
import {estimateRoutes} from '../src/production/costs.mjs';
import {createProduction} from '../src/production/production.mjs';
import {gearScore,gearSuitability,createGear} from '../src/production/gear.mjs';
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

test('U01 P90 ranks reliable material source ahead of lower mean and exposes selected route hours',()=>{
 const G={monsters:{uncertain:{},steady:{}},drops:{monsters:{uncertain:[[.1,'material',1]],steady:[[1,'material',1]]}}};
 const rate=id=>({value:id==='uncertain'?10:.8,source:'observed-team'});
 const mean=materialSources(G,'material',1,['uncertain','steady'],10,rate,{confidence:'mean'});
 const p90=materialSources(G,'material',1,['uncertain','steady'],10,rate,{confidence:'p90'});
 assert.equal(mean[0].monster,'uncertain');assert.equal(p90[0].monster,'steady');
 assert.equal(p90[0].selectedHours,p90[0].p90Hours);
 const routes=estimateRoutes({G,item:'material',allowed:['farm'],npcPrice:()=>Infinity,marketPrice:()=>Infinity,farmHours:(name,q)=>materialSources(G,name,q,['uncertain','steady'],10,rate,{confidence:'p90'})[0].selectedHours,confidence:'p90'});
 assert.equal(routes[0].hours,p90[0].p90Hours);
 assert.ok(routes[0].hours>mean[0].estimatedHours);
});
test('U02 quest exchange requires authoritative NPC location and preserves source proof',()=>{
 const G={items:{ticket:{e:2,quest:'quest1'},prize:{}},drops:{ticket:[[1,'prize']]}};
 const args={G,item:'prize',stock:()=>0,bank:()=>0,canBuy:()=>false,allowed:['exchange']};
 assert.equal(exchangeSource(G,'ticket').ready,false);
 assert.equal(exchangeSource(G,'ticket').reason,'QUEST_SOURCE_DESTINATION_UNVERIFIED');
 assert.throws(()=>planProduction(args),/Kein freigegebener Beschaffungsweg/);
 G.npcs={quest_npc:{quest:'quest1'}};G.maps={main:{npcs:[['quest_npc',100,200]]}};
 assert.deepEqual(exchangeSource(G,'ticket').destination,{map:'main',x:100,y:200});
 const plan=planProduction({...args,allowed:['exchange','farm']});
 assert.equal(plan.at(-1).kind,'exchange');
 assert.deepEqual(plan.at(-1).sourceProof,{quest:'quest1',npc:'quest_npc',destination:{map:'main',x:100,y:200},event:null});
 G.maps.main.npcs=[];
 assert.equal(exchangeSource(G,'ticket').ready,false);
});
test('U02 ordinary exchange remains available; inactive, unverifiable and expiring event exchanges are refused',()=>{
 const G={items:{token:{e:2},prize:{}},drops:{token:[[1,'prize']]}};
 assert.equal(exchangeSource(G,'token').ready,true);
 assert.equal(planProduction({G,item:'prize',stock:()=>0,bank:()=>0,canBuy:()=>false,allowed:['exchange','farm']}).at(-1).kind,'exchange');
 G.items.token.event='seasonal';G.events={seasonal:{}};
 assert.equal(exchangeSource(G,'token',{}).reason,'EVENT_SOURCE_INACTIVE');
 assert.equal(exchangeSource(G,'token',{seasonal:{active:true}}).ready,true);
 const expired={seasonal:{live:true,expires:Date.now()-2000}};
 assert.equal(exchangeSource(G,'token',expired).ready,false);
 const almostOver={seasonal:{live:true,expires:Date.now()+100}};
 const rows=estimateRoutes({G,item:'prize',allowed:['exchange','farm'],stock:()=>0,npcPrice:()=>Infinity,marketPrice:()=>Infinity,farmHours:()=>10,travelHours:()=>0,state:almostOver});
 assert.ok(!rows.some(row=>row.kind==='exchange'));
 G.items.token.event=true;
 assert.equal(exchangeSource(G,'token',{seasonal:{active:true}}).reason,'EVENT_SOURCE_UNVERIFIED');
});

test('U02 execution guard rechecks event and NPC mapping after planning, without dispatch',()=>{
 const G={items:{ticket:{e:2,quest:'quest1',event:'season'},prize:{}},drops:{ticket:[[1,'prize']]},events:{season:{}},npcs:{quest_npc:{quest:'quest1'}},maps:{main:{npcs:[['quest_npc',10,20]]}}};
 let guard=null,notes=[];const p={G,c:{items:[{name:'ticket',q:4}],slots:{},s:{}},root:{S:{season:{live:true}}},parent:{},read:()=>null};
 const e={remaining:()=>true,spare:()=>4,count:()=>4,explicit:()=>null,at:()=>true,destination:()=>({map:'main',x:10,y:20}),travel:()=>true,value:()=>2,note:x=>notes.push(x),perform:(kind,args)=>{guard=args.guard;return true;}};
 const bot={p,me:{name:'M',role:'merchant'},economy:e,cfg:{general:{testLogging:1},production:{enabled:true,exchange:true,goals:[]},merchant:{minFreeSlots:0},party:{}},exec:{pending:new Set()},free:()=>6,transport:{fresh:()=>null}};
 const production=createProduction(bot),rule={keep:0,teamReserve:0,targetCount:100,maxCount:100,recipe:''};
 assert.equal(production.exchange(0,rule),true);assert.equal(guard(),true);
 p.root.S.season={active:false};assert.equal(guard(),false);
 p.root.S.season={live:true};G.maps.main.npcs=[];assert.equal(guard(),false);
 guard=null;assert.equal(production.exchange(0,rule),false);assert.equal(guard,null);assert.match(notes.at(-1),/nicht verifiziert/);
});

test('U03 merchant mobility gate beats luck-weighted score and stationary policy is opt-in',()=>{
 const fast={speed:10,luck:0,armor:5},lucky={speed:0,luck:3,armor:5};
 assert.ok(gearScore(lucky,'economy')>gearScore(fast,'economy'));
 assert.equal(gearSuitability(fast,lucky,'economy','merchant','mobile').reason,'merchant-speed-loss');
 assert.equal(gearSuitability(fast,lucky,'economy','merchant','stationary').ok,true);
 assert.equal(gearSuitability(fast,{...lucky,speed:10},'economy','merchant').ok,true);
 assert.equal(gearSuitability(fast,null,'economy','merchant').ok,false);
});
test('U03 survival minimum applies before scoring to tank, healer and merchant',()=>{
 for(const role of ['tank','healer','economy']){
  assert.equal(gearSuitability({armor:100,hp:400},{armor:0,hp:0,luck:200},role,role==='economy'?'merchant':'paladin','stationary').reason,'survival-loss');
  assert.equal(gearSuitability({armor:100,hp:400},{armor:95,hp:400,attack:500},role,'paladin').ok,true);
 }
 assert.equal(gearSuitability(null,{attack:20},'dps','ranger').ok,true);
});
test('U03 merchant equip rechecks mobility when dispatch guard is evaluated',()=>{
 const slots={shoes:{name:'fast',level:0}},items=[{name:'lucky',level:0}],G={items:{fast:{type:'shoes'},lucky:{type:'shoes'}},classes:{merchant:{}}},stats={fast:{speed:10},lucky:{speed:0,luck:3}};
 let pending=null;
 const bot={cfg:{production:{gear:true,minImprovement:0},party:{}},me:{name:'M',gearRole:'economy',merchantMobility:'mobile'},
  p:{c:{name:'M',ctype:'merchant',level:50,slots,items},G,read:()=>null,call:(name,item)=>name==='item_properties'?stats[item.name]:null},
  teamNames:['M'],economy:{safe:()=>true,perform:(kind,opts)=>{pending=opts;return opts.guard();},note:()=>{}},allocation:{equipGuard:()=>true}};
 const gear=createGear(bot);
 assert.equal(gear.equip(0,{slot:'shoes'}),false);
 bot.me.merchantMobility='stationary';
 assert.equal(gear.equip(0,{slot:'shoes'}),true);
 assert.equal(pending.guard(),true);
 bot.me.merchantMobility='mobile';assert.equal(pending.guard(),false);
});
