import test from 'node:test';
import assert from 'node:assert/strict';
import {planProduction} from '../src/production/planner.mjs';
import {recipeGridIngredients,recipeIngredients,matchRecipeSlots} from '../src/production/recipes.mjs';
import {materialSources,exchangeSource} from '../src/production/materials.mjs';
import {estimateRoutes} from '../src/production/costs.mjs';
import {createProduction} from '../src/production/production.mjs';
import {gearScore,gearSuitability,createGear} from '../src/production/gear.mjs';
import {createMarket} from '../src/merchant/market.mjs';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';
import {accountRiskSnapshot,createAccount} from '../src/party/account.mjs';
import {chooseAura,auraRisk,createAura} from '../src/party/aura.mjs';
import {createProgression,supportedProgressionRows} from '../src/world/progression.mjs';
import {createPorts} from '../src/runtime/ports.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {createGoldLogistics} from '../src/items/gold.mjs';
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

test('U04 live buyer bids require reachability, exact variant, current price and limited quantity',()=>{
 const c={name:'M',map:'main',in:'main',x:0,y:0,speed:50};
 const bid=(name,level,price,q,extra={})=>({name,level,price,q,b:true,rid:'bid-'+price,...extra});
 const seller=(name,x,slots)=>({name,id:name,type:'character',stand:true,map:'main',in:'main',x,y:0,slots});
 const p={c,entities:{A:seller('A',100,{trade1:bid('ring',2,100,3)}),B:seller('B',100,{trade1:bid('ring',2,50,2)}),C:seller('C',100,{trade1:bid('ring',2,1000,10,{stat_type:'str'})}),D:seller('D',1000,{trade1:bid('ring',2,1000,10)})},read:()=>null};
 const market=createMarket({p,me:{name:'M'},cfg:{merchant:{marketHistory:false},production:{goldPerHour:3600}},economy:{value:()=>10},exec:{}});
 const item={name:'ring',level:2},result=market.bidValuation(item,10,10,{future:true});
 assert.equal(result.covered,5);
 assert.ok(result.unitValue>10&&result.unitValue<20); // 25% bid-premium haircut and travel cost
 assert.ok(market.bidValuation(item,10,10,{future:false}).unitValue>result.unitValue);
 assert.equal(market.bidValuation({...item,stat_type:'str'},1,10,{future:true}).covered,1);
 delete p.entities.A;delete p.entities.B;
 assert.equal(market.bidValuation(item,10,10,{future:true}).unitValue,10);
});
test('U04 market sell guard refuses a changed variant or disappearing bid',()=>{
 const item={name:'ring',level:2,q:4},c={name:'M',map:'main',in:'main',x:0,y:0,items:[item],gold:0,slots:{}};
 const buyer={id:'buyer',name:'Buyer',type:'character',stand:true,map:'main',in:'main',x:20,y:0,slots:{trade1:{name:'ring',level:2,price:100,q:3,b:true,rid:'offer'}}};
 let guarded=null;
 const p={c,entities:{buyer},has:()=>true,read:()=>null};
 const e={safe:()=>true,spare:()=>4,count:()=>4,perform:(kind,args)=>{guarded=args.guard;return true;}};
 const bot={p,me:{name:'M'},cfg:{merchant:{marketHistory:false},production:{}},economy:e,exec:{},entity:()=>buyer};
 const market=createMarket(bot);
 assert.equal(market.sellToBid(0,{minPrice:10}),true);
 assert.equal(guarded(),true);
 buyer.slots.trade1.q=1;assert.equal(guarded(),false);
 buyer.slots.trade1.q=3;buyer.slots.trade1.stat_type='int';assert.equal(guarded(),false);
 buyer.slots.trade1.stat_type=undefined;buyer.map='other';assert.equal(guarded(),false);
 buyer.map='main';delete buyer.slots.trade1;assert.equal(guarded(),false);
});
test('U04 production resale forecast conservatively uses only supported live-bid value',()=>{
 const p={G:{version:1,items:{ring:{upgrade:true},scroll0:{g:1}},upgrade:[[null,1]]},c:{items:[]},call:()=>0};
 const cfg={production:{autoGearMaxLevel:1,minChance:.65,minImprovement:0,helperMaxPrice:100,autoDisposition:true},merchant:{}};
 const economy={value:i=>i.level===1?20:10},bot={p,cfg,me:{role:'merchant'},economy,market:{bidValuation:()=>null}};
 const item={name:'ring',level:0};
 const npc=createEconomicIntelligence(bot).mutationEconomics(item);
 bot.market.bidValuation=(i,q,npcUnit,{future})=>({unitValue:future?40:npcUnit});
 const offered=createEconomicIntelligence(bot).mutationEconomics(item);
 assert.equal(npc.action,'upgrade');
 assert.equal(offered.action,'upgrade');
 assert.ok(offered.ev>npc.ev);
 bot.market.bidValuation=()=>({unitValue:5});
 assert.equal(createEconomicIntelligence(bot).mutationEconomics(item).ev,npc.ev);
});

test('U05 account risk uses each fresh balance once and refuses missing bank/peer evidence',()=>{
 const unknown=accountRiskSnapshot([1000,null],null,100,'normal');
 assert.equal(unknown.complete,false);assert.equal(unknown.mode,'conservative');assert.equal(unknown.riskLimit,10);assert.equal(unknown.liquidFloor,1000);
 const full=accountRiskSnapshot([2000,1000],2000,100,'conservative');
 assert.equal(full.wealth,5000);assert.equal(full.riskLimit,100);
 assert.equal(full.mode,'normal');
 assert.equal(accountRiskSnapshot([400,200],300,100,'normal').mode,'normal');
 assert.equal(accountRiskSnapshot([300,100],200,100,'normal').mode,'conservative');
 assert.equal(accountRiskSnapshot([300,100],200,100,'conservative').riskLimit,6);
});
test('U05 account guard is additive and cannot erase a preexisting budget',()=>{
 const me={name:'M',role:'merchant',goldReserve:10,group:'team'},cfg={party:{merchant:'M',leader:'A',selection:'fixed'},characters:[{name:'A',role:'farmer',enabled:true,group:'team'},{...me,enabled:true}],production:{lossBudget:100}},peers={A:{running:true,realm:'EU1',goldBalance:1000}};
 const bot={me,cfg,p:{c:{gold:2000,bank:{gold:2000}},realm:()=> 'EU1',read:()=>null},transport:{fresh:n=>peers[n]},farmers:['A'],leader:'A',exec:{pending:new Map()},running:true,report(){}};
 const account=createAccount(bot);
 assert.equal(account.risk().wealth,5000);
 assert.equal(account.spendAllowed(50,0),true);
 assert.equal(account.spendAllowed(101,0),false);
 delete peers.A.goldBalance;
 assert.equal(account.risk().complete,false);assert.equal(account.spendAllowed(1,0),true);assert.equal(account.spendAllowed(41,0),false);
});
test('U06 aura anticipates severe damage, magical danger and missing threat stats',()=>{
 assert.equal(chooseAura({hpRatio:1,mpRatio:1}),'zeal');
 assert.equal(chooseAura({hpRatio:1,mpRatio:1,dangerRatio:.5}),'bulwark');
 assert.equal(chooseAura({hpRatio:1,mpRatio:1,dangerRatio:.5,damageType:'magical'}),'sanctuary');
 assert.equal(chooseAura({hpRatio:1,unknownThreat:true}),'bulwark');
 const allies=[{name:'A',hp:100,max_hp:100}];
 const threat=auraRisk([{target:'A',mtype:'mage',hp:100}],allies,{monsters:{mage:{attack:20,frequency:1,damage_type:'magical'}}});
 assert.equal(threat.damageType,'magical');assert.equal(threat.dangerRatio,.6);
 assert.equal(auraRisk([{target:'A',mtype:'mystery',hp:100}],allies,{monsters:{}}).unknownThreat,true);
 assert.equal(auraRisk([],allies,{monsters:{}}).unknownThreat,false);
});
test('U06 defensive aura can bypass hold; recovered team remains held and stale combat proposal is rejected',()=>{
 let now=100000,threats=[],guard=null,casts=[];
 const real=Date.now;Date.now=()=>now;
 try{
  const c={name:'A',ctype:'paladin',level:80,hp:100,max_hp:100,mp:100,max_mp:100,p:{paladin_aura:'warding'},s:{}};
  const bot={running:true,journal:null,p:{c,G:{skills:{paladin_aura:{level:60,states:{zeal:{},bulwark:{},sanctuary:{},warding:{}}}},monsters:{ogre:{attack:30,frequency:1}}},call:(name,...args)=>{if(name==='is_on_cooldown')return false;if(name==='use_skill')casts.push(args);}},cfg:{party:{buffs:true,aura:'auto',auraHoldMs:60000}},allies:()=>[],monsters:()=>threats,exec:{run:(key,res,valid,fn)=>{guard=valid;return valid();}}};
  const a=createAura(bot);
  assert.equal(a.tick(),true);
  threats=[{mtype:'ogre',target:'A',hp:100}];now+=100;
  assert.equal(a.tick(),true);assert.equal(guard(),true);
  threats=[];assert.equal(guard(),false);
  assert.equal(a.tick(),false);
 }finally{Date.now=real;}
});

test('U07 unavailable or throwing official API leaves farm planner unchanged',()=>{
 const root={character:{name:'A'},G:{monsters:{bee:{}},maps:{main:{}}},parent:{server_region:'EU',server_identifier:'1'}};
 const ports=createPorts(root);
 assert.equal(ports.hasProgression(),false);
 const cfg={production:{progressionAdvice:true,goals:[],lossBudget:1000},merchant:{goldReserve:0,maxSpendPerHour:1000},general:{planningTickMs:1},farming:{targets:['bee']},world:{excludedMaps:[]}};
 const bot={p:{...ports,c:{name:'A',gold:1000},G:root.G},cfg,me:{role:'farmer',goldReserve:0,farmTargets:[]},event:()=>{}};
 const guide=createProgression(bot);
 assert.equal(guide.bonus('bee','main'),0);assert.equal(guide.status().reason,'official-api-unavailable');
 bot.p.hasProgression=()=>true;bot.p.progression=()=>{throw Error('headless scripts missing');};
 guide.refresh(true);assert.equal(guide.status().reason,'read-error');assert.equal(guide.bonus('bee','main'),0);
});
test('U07 only safe explicitly allowed official farm route influences existing priorities',()=>{
 const G={monsters:{bee:{},goo:{}},maps:{main:{},pvp:{pvp:true}}};
 const advice={version:1,ready:true,at:Date.now(),rows:[
  {kind:'farm',action:{kind:'farm',route:{monster:'goo',map:'main',safe:true,reasons:[]}},priority:100},
  {kind:'farm',action:{kind:'farm',route:{monster:'bee',map:'pvp',safe:true,reasons:[]}},priority:99},
  {action:{kind:'buy',name:'sword'},priority:999},
  {kind:'farm',action:{kind:'farm',route:{monster:'bee',map:'main',safe:true,reasons:[]}},priority:10}]};
 assert.deepEqual(supportedProgressionRows(advice,G,['bee'],[],false).map(x=>x.monster),['bee']);
 assert.deepEqual(supportedProgressionRows({...advice,ready:false},G,['bee']),[]);
 assert.deepEqual(supportedProgressionRows({...advice,at:undefined},G,['bee']),[]);
 assert.deepEqual(supportedProgressionRows({version:2,ready:true,rows:advice.rows},G,['bee']),[]);
});
test('U07 bounded official advice cache never dispatches instructions or overrides user goals',()=>{
 const G={monsters:{bee:{},goo:{}},maps:{main:{}},items:{sword:{type:'weapon'}}},p={G,c:{gold:2000},hasProgression:()=>true},calls=[];
 p.progression=options=>{calls.push(options);return {version:1,ready:true,at:Date.now(),rows:[{kind:'farm',action:{kind:'farm',route:{monster:'bee',map:'main',safe:true,reasons:[]}},priority:50}],plans:[{tree:{next:{kind:'buy',name:'unsafe'}}}]};};
 const cfg={general:{planningTickMs:20000},production:{progressionAdvice:true,goals:[{enabled:true,item:'sword',quantity:1,level:1,budget:100}],lossBudget:1000},merchant:{goldReserve:200,maxSpendPerHour:1000},farming:{targets:['bee']},world:{excludedMaps:[]}};
 const bot={p,cfg,me:{name:'A',role:'farmer',farmTargets:[],goldReserve:10},event:()=>{}};
 const guide=createProgression(bot);
 assert.equal(guide.bonus('bee','main'),.06);assert.equal(guide.bonus('goo','main'),0);
 assert.equal(guide.goalPriority({item:'sword',level:1}),0);
 assert.equal(calls.length,1);assert.equal(calls[0].spendLimit,100);
 assert.equal(calls[0].allowPvp,false);
 assert.equal(guide.status().plansCount,1);
 p.progression=()=>({version:1,ready:true,at:Date.now(),rows:[{action:{kind:'buy',name:'unsafe'},priority:999}],plans:[]});
 guide.refresh(true);assert.equal(guide.bonus('bee','main'),0);
});
test('U07 official port reuses one runtime, detaches on changed game definitions and shutdown',()=>{
 const roots=[],factory={create:env=>{const state={reads:0,detached:false,read:()=>({version:1,ready:true,at:Date.now(),rows:[],plans:[]}),detach(){this.detached=true;}};roots.push(state);return state;}};
 const root={character:{name:'A'},G:{monsters:{}},parent:{ProgressionRuntime:factory,server_region:'EU',server_identifier:'1'}};
 const p=createPorts(root);
 assert.equal(p.hasProgression(),true);
 p.progression({});p.progression({});assert.equal(roots.length,1);
 root.G={monsters:{bee:{}}};p.progression({});assert.equal(roots[0].detached,true);assert.equal(roots.length,2);
 p.closeProgression();assert.equal(roots[1].detached,true);
});

test('U07 closing a guide port cannot detach the official wrapper singleton',()=>{
 let reads=0,detaches=0,changes=0;
 const shared={read:()=>({version:1,ready:true,at:Date.now(),rows:[],plans:[]}),detach(){detaches++;}};
 function get_progression(options){reads++;return get_progression.runtime.read(options);}
 get_progression.runtime=shared;
 const root={character:{name:'A'},G:{monsters:{}},get_progression,parent:{server_region:'EU',server_identifier:'1'}};
 const p=createPorts(root);
 assert.equal(p.hasProgression(),true);
 assert.equal(p.progression({}).ready,true);
 p.closeProgression();p.closeProgression();
 assert.equal(detaches,0,'Official wrapper is not owned by this bot');
 assert.equal(get_progression.runtime,shared);
 assert.equal(p.progression({}).ready,true,'Official wrapper remains reusable after bot restart');
 assert.equal(reads,2);
 assert.equal(detaches,0);
 root.G={monsters:{goo:{}}};
 assert.equal(p.progression({}).ready,true);
 assert.equal(detaches,0,'G changes belong to the official wrapper');
 assert.equal(changes,0);
});
test('U07 closing the optional parent progression_read adapter has no external side effects',()=>{
 let reads=0,detaches=0,factoryCalls=0;
 const shared={detach(){detaches++;}};
 const root={G:{},parent:{progression_read:()=>{reads++;return {ready:true};},ProgressionRuntime:{create:()=>{factoryCalls++;return shared;}}}};
 const p=createPorts(root);
 assert.equal(p.progression().ready,true);
 p.closeProgression();
 assert.equal(reads,1);
 assert.equal(detaches,0);
 assert.equal(factoryCalls,0);
});
test('U07 owned fallback runtime detaches only its own listeners, even on repeated close',()=>{
 let factoryCalls=0,detaches=0;
 const root={G:{},character:{name:'A'},parent:{ProgressionRuntime:{create:()=>{factoryCalls++;return {read:()=>({ready:true}),detach(){detaches++;}};}}}};
 const p=createPorts(root);
 assert.equal(p.progression().ready,true);
 p.closeProgression();p.closeProgression();
 assert.equal(detaches,1);
 assert.equal(p.progression().ready,true);
 assert.equal(factoryCalls,2);
 p.closeProgression();assert.equal(detaches,2);
});
test('U05 cumulative automatic risk limit cannot be bypassed by multiple spends',()=>{
 const ledger={hour:Date.now(),spent:20,loss:2,goals:{}},checked=[];
 const p={c:{gold:100000,slots:{}},read:()=>ledger};
 const bot={p,me:{name:'M',role:'merchant',goldReserve:0},cfg:{merchant:{goldReserve:0,maxSpendPerHour:1000},production:{lossBudget:1000,goals:[]}},account:{spendAllowed:(cost,loss)=>{checked.push([cost,loss]);return cost+loss<=25;}}};
 const economy=createEconomy(bot),auto={_autoProduction:true,goldBudget:1000,lossBudget:1000};
 assert.equal(economy.budget(3,0,auto),true);
 assert.equal(economy.budget(4,0,auto),false);
 assert.equal(economy.budget(4,0,{...auto,_autoProduction:false}),true);
 assert.deepEqual(checked,[[23,2],[24,2]]);
});

test('U05 valuable auto-mutation is banked rather than risked beyond configured loss budget',()=>{
 const cfg={production:{autoGearMaxLevel:1,lossBudget:100,minChance:.65,minImprovement:0,helperMaxPrice:1000,autoDisposition:true},merchant:{}};
 const p={G:{version:1,items:{rare:{upgrade:true},scroll0:{g:1}},upgrade:[[null,1]]},c:{items:[]},call:()=>0};
 const bot={p,cfg,me:{role:'merchant'},economy:{value:()=>200}};
 const row=createEconomicIntelligence(bot).mutationEconomics({name:'rare',level:0});
 assert.equal(row.action,'bank');assert.equal(row.reason,'auto-mutation-exposure');
});
test('U06 critical magical danger bypasses hold even from physical defensive aura',()=>{
 let now=100000;const original=Date.now;Date.now=()=>now;
 try{
  const c={name:'A',ctype:'paladin',level:80,hp:100,max_hp:100,mp:100,max_mp:100,p:{paladin_aura:'bulwark'},s:{}};
  const bot={running:true,journal:null,p:{c,G:{skills:{paladin_aura:{level:60,states:{bulwark:{},sanctuary:{}}}},monsters:{m:{attack:30,frequency:1,damage_type:'magical'}}},call:name=>name==='is_on_cooldown'?false:null},cfg:{party:{buffs:true,aura:'auto',auraHoldMs:60000}},allies:()=>[],monsters:()=>[{target:'A',mtype:'m',hp:100}],exec:{run:(key,res,guard)=>guard()}};
  const aura=createAura(bot);
  assert.equal(aura.tick(),true);
  assert.equal(aura.status().proposal.aura,'sanctuary');
 }finally{Date.now=original;}
});

test('U07 refuses unproven, blocked and stale official advice, even if a route is allowlisted',()=>{
 const G={monsters:{bee:{}},maps:{main:{}}};
 const row=route=>({kind:'farm',priority:100,action:{kind:'farm',route:{monster:'bee',map:'main',...route}}});
 const advice={version:1,ready:true,at:Date.now(),rows:[row({}),row({safe:false}),row({safe:true,reasons:['unsafe']}),row({safe:true,reasons:[]})]};
 assert.equal(supportedProgressionRows(advice,G,['bee']).length,1);
 assert.deepEqual(supportedProgressionRows({...advice,at:Date.now()-125000},G,['bee']),[]);
 assert.deepEqual(supportedProgressionRows({...advice,at:Date.now()+125000},G,['bee']),[]);
});
test('U07 official farm advice fails closed for missing or malformed safety reasons',()=>{
 const G={monsters:{bee:{}},maps:{main:{}}};
 const row=route=>({kind:'farm',priority:30,action:{kind:'farm',route:{monster:'bee',map:'main',safe:true,...route}}});
 const advice={version:1,ready:true,at:Date.now(),rows:[row({}),row({reasons:'safe'}),row({reasons:null}),row({reasons:{length:0}}),row({reasons:['mechanics']}),row({reasons:[]})]};
 const supported=supportedProgressionRows(advice,G,['bee']);
 assert.equal(supported.length,1);
 assert.equal(supported[0].monster,'bee');
 assert.equal(supported[0].source,'official-get_progression');
});
test('U07 auto-target hints remain bounded by actual safe targets and restart rereads after close',()=>{
 const G={monsters:{goo:{},bee:{}},maps:{main:{}},items:{}},calls=[];
 const p={G,c:{gold:1000},hasProgression:()=>true,progression:options=>{calls.push(options);return {version:1,ready:true,at:Date.now(),goal:{kind:'farm',monster:'goo'},rows:[{kind:'farm',priority:90,action:{kind:'farm',route:{monster:'bee',map:'main',safe:true,reasons:[]}}}],plans:[]};},closeProgression:()=>{}};
 const bot={p,cfg:{production:{progressionAdvice:true,goals:[],lossBudget:100},merchant:{goldReserve:0,maxSpendPerHour:100},general:{planningTickMs:20000},farming:{targets:['goo'],autoTargets:true},world:{excludedMaps:[]}},me:{role:'farmer',farmTargets:[]},teamPlan:{candidates:()=>['goo','bee']},strategy:{safeTarget:id=>id!=='goo'},event(){}};
 const guide=createProgression(bot);
 assert.equal(guide.bonus('bee','main'),.06);
 assert.equal(calls.length,1);
 assert.equal(guide.bonus('goo','main'),0);
 guide.close();
 assert.equal(guide.status().lastRead,0);
 assert.equal(guide.bonus('bee','main'),.06);
 assert.equal(calls.length,2);
});
test('U07 item-goal priority requires an actual matching official acquisition plan',()=>{
 const G={monsters:{},maps:{},items:{helmet:{}}};
 const p={G,c:{gold:10000},hasProgression:()=>true,progression:()=>({version:1,ready:true,at:Date.now(),goal:{kind:'item',name:'helmet',level:1,quantity:1},rows:[],plans:[{tree:{name:'helmet',level:1,next:{kind:'upgrade',name:'helmet'}}}]})};
 const cfg={production:{progressionAdvice:true,lossBudget:10000,goals:[{enabled:true,item:'helmet',level:1,quantity:1,budget:1000}]},merchant:{goldReserve:0,maxSpendPerHour:10000},general:{planningTickMs:20000},farming:{targets:[]},world:{excludedMaps:[]}};
 const guide=createProgression({p,cfg,me:{role:'merchant',goldReserve:0,farmTargets:[]},event(){}});
 assert.equal(guide.goalPriority({item:'helmet',level:1}),.1);
 assert.equal(guide.goalPriority({item:'helmet',level:2}),0);
 p.progression=()=>({version:1,ready:true,at:Date.now(),goal:{kind:'item',name:'helmet',level:1},rows:[],plans:[{tree:{name:'other',level:1,next:{kind:'upgrade'}}}]});
 guide.refresh(true);
 assert.equal(guide.goalPriority({item:'helmet',level:1}),0);
});

test('U07 rejects official advice from a different realm or missing timestamp before plan bonus',()=>{
 const G={monsters:{bee:{}},maps:{main:{}},items:{}},calls=[];
 let response={version:1,ready:true,at:Date.now(),realm:'US I',rows:[{kind:'farm',priority:80,action:{kind:'farm',route:{monster:'bee',map:'main',safe:true,reasons:[]}}}],plans:[]};
 const p={G,c:{gold:1200},realm:()=> 'EUII',hasProgression:()=>true,progression:()=>{calls.push(response);return response;}};
 const cfg={production:{progressionAdvice:true,goals:[],lossBudget:100},merchant:{goldReserve:0,maxSpendPerHour:100},general:{planningTickMs:15000},farming:{targets:['bee']},world:{excludedMaps:[]}};
 const guide=createProgression({p,cfg,me:{role:'farmer',farmTargets:[]},event(){}});
 assert.equal(guide.bonus('bee','main'),0);assert.equal(guide.status().reason,'realm-mismatch');
 response={...response,realm:'EU II',at:null};
 guide.refresh(true);assert.equal(guide.bonus('bee','main'),0);assert.equal(guide.status().reason,'unsupported-advice-shape');
 response={...response,at:Date.now()};
 guide.refresh(true);assert.equal(guide.bonus('bee','main'),.06);
 assert.equal(calls.length,3);
});

test('U05 account guard never double counts unsettled or recent gold handoffs',()=>{
 const t=Date.now(),me={name:'M',role:'merchant',goldReserve:10,group:'g'};
 const cfg={general:{messageTtlMs:30000},party:{merchant:'M',leader:'A',selection:'fixed'},characters:[{name:'A',role:'farmer',enabled:true,group:'g'},{...me,enabled:true}],production:{lossBudget:100}};
 const peer={running:true,realm:'EU1',goldBalance:2000,goldTransferPending:false,goldTransferAt:0};
 const gold={reserved:false,transferAt:0};
 const bot={me,cfg,gold,p:{c:{gold:3000,bank:{gold:1000}},realm:()=> 'EU1',read:()=>null},transport:{fresh:()=>peer},farmers:['A'],leader:'A',exec:{pending:new Map()},running:true,report(){}};
 const account=createAccount(bot);
 assert.equal(account.risk().wealth,6000);
 peer.goldTransferPending=true;
 assert.equal(account.risk().complete,false);assert.equal(account.risk().liquidFloor,4000);
 peer.goldTransferPending=false;peer.goldTransferAt=t;
 assert.equal(account.risk().complete,false);assert.equal(account.risk().liquidFloor,4000);
 peer.goldTransferAt=t-61000;
 assert.equal(account.risk().complete,true);
 gold.reserved=true;
 assert.equal(account.risk().complete,false);assert.equal(account.risk().liquidFloor,2000);
 gold.reserved=false;gold.transferAt=t;
 assert.equal(account.risk().complete,false);assert.equal(account.risk().liquidFloor,2000);
 gold.transferAt=t-61000;
 assert.equal(account.risk().complete,true);
});
test('U05 account risk rejects both sides of a recently settled transfer during heartbeat skew',()=>{
 const t=Date.now(),cfg={general:{messageTtlMs:20000},party:{merchant:'M',leader:'A',selection:'fixed'},characters:[{name:'A',role:'farmer',enabled:true,group:'g'},{name:'M',role:'merchant',enabled:true,group:'g'}],production:{lossBudget:1000}};
 const h={running:true,realm:'EU1',goldBalance:5000,goldTransferPending:false,goldTransferAt:t};
 const bot={me:{name:'M',role:'merchant',group:'g'},cfg,p:{c:{gold:5000,bank:{gold:1000}},realm:()=> 'EU1',read:()=>null},gold:{reserved:false,transferAt:t},transport:{fresh:()=>h},farmers:['A'],leader:'A',exec:{pending:new Map()},running:true,report(){}};
 const account=createAccount(bot);
 assert.equal(account.risk().complete,false);
 assert.equal(account.risk().liquidFloor,0);
 assert.equal(account.spendAllowed(1,0),false);
});

test('U04 trade_sell rejects a server-selectable stack with smaller quantity or an explicit keep rule',()=>{
 const first={name:'ring',level:2,q:3},second={name:'ring',level:2,q:1};
 const c={name:'M',map:'main',in:'main',x:0,y:0,items:[first,second],gold:0,slots:{}};
 const buyer={id:'buyer',name:'Buyer',type:'character',stand:true,map:'main',in:'main',x:20,y:0,slots:{trade1:{name:'ring',level:2,price:100,q:3,b:true,rid:'offer'}}};
 let guard=null,performed=0;
 const p={c,entities:{buyer},has:()=>true,read:()=>null};
 const e={safe:i=>!!i&&!i.l,spare:(slot,r)=>c.items[slot]?.q??0,count:()=>c.items.reduce((sum,i)=>sum+(i?.q??0),0),rules:i=>({action:i?.keep?'keep':'sell'}),perform:(kind,args)=>{performed++;guard=args.guard;return true;}};
 const market=createMarket({p,me:{name:'M'},cfg:{merchant:{marketHistory:false},production:{}},economy:e,exec:{},entity:()=>buyer});
 assert.equal(market.sellToBid(0,{action:'sell',minPrice:10}),false);
 assert.equal(performed,0);
 second.q=3;second.keep=true;
 assert.equal(market.sellToBid(0,{action:'sell',minPrice:10}),false);
 second.keep=false;
 assert.equal(market.sellToBid(0,{action:'sell',minPrice:10}),true);
 assert.equal(guard(),true);
 second.l=true;
 assert.equal(guard(),false,'Reevaluate every server-pickable stack before dispatch');
 second.l=false;second.q=1;
 assert.equal(guard(),false,'New inventory split cannot use an old bid authorization');
});
test('U04 live bid sale rejects non-finite prices and nonstandard trade slots',()=>{
 const i={name:'ring',level:0,q:3},c={name:'M',map:'main',in:'main',x:0,y:0,items:[i],gold:0,slots:{}};
 const offer={name:'ring',level:0,b:true,q:3,rid:'id',price:Infinity};
 const buyer={id:'B',name:'B',type:'character',stand:true,map:'main',in:'main',x:10,y:0,slots:{trade1:offer}};
 let performed=0;
 const p={c,entities:{B:buyer},has:()=>true,read:()=>null};
 const economy={safe:()=>true,spare:()=>3,count:()=>3,perform:()=>{performed++;return true;}};
 const market=createMarket({p,me:{name:'M'},cfg:{merchant:{marketHistory:false},production:{}},economy,exec:{},entity:()=>buyer});
 assert.equal(market.sellToBid(0,{minPrice:1}),false);
 offer.price=100;buyer.slots.trade17=offer;delete buyer.slots.trade1;
 assert.equal(market.sellToBid(0,{minPrice:1}),false);
 assert.equal(performed,0);
});

test('U04 market purchase requires same map and instance even for a nearby visible seller',()=>{
 const item={name:'ring',level:0},c={name:'M',map:'main',in:'main',x:0,y:0,items:[]};
 const offer={name:'ring',level:0,price:100,q:2,rid:'offer-1'},seller={id:'S',name:'S',type:'character',stand:true,map:'main',in:'main.2',x:20,y:0,slots:{trade1:offer}};
 let orders=0;
 const p={c,entities:{S:seller},read:()=>null};
 const econ={count:()=>0,destination:()=>null,perform:()=>{orders++;return true;}};
 const bot={p,me:{name:'M'},cfg:{general:{testLogging:true},merchant:{minFreeSlots:0,marketHistory:false,position:{enabled:false}}},economy:econ,exec:{},free:()=>5,entity:()=>seller};
 const market=createMarket(bot),r={action:'marketBuy',priceSource:'fixed',maxPrice:200,batch:2,targetCount:5,maxCount:5};
 assert.equal(market.buy(item,r),false);
 assert.equal(orders,0);
 seller.in='main';assert.equal(market.buy(item,r),true);
 assert.equal(orders,1);
});
test('U04 market buy dispatch rechecks live stand, instance, offer flags and price ceiling',()=>{
 const item={name:'ring',level:0},c={name:'M',map:'main',in:'main',x:0,y:0,items:[]};
 const offer={name:'ring',level:0,price:100,q:2,rid:'offer-1'},seller={id:'S',name:'S',type:'character',stand:true,map:'main',in:'main',x:20,y:0,slots:{trade1:offer}};
 let guard=null;
 const p={c,entities:{S:seller},read:()=>null};
 const econ={count:()=>0,perform:(kind,opts)=>{assert.equal(kind,'market.buy');guard=opts.guard;return true;}};
 const bot={p,me:{name:'M'},cfg:{general:{testLogging:true},merchant:{minFreeSlots:0,marketHistory:false,position:{enabled:false}}},economy:econ,exec:{},free:()=>5,entity:()=>p.entities.S};
 const market=createMarket(bot),r={action:'marketBuy',priceSource:'fixed',maxPrice:200,batch:2,targetCount:5,maxCount:5};
 assert.equal(market.buy(item,r),true);
 assert.equal(guard(),true);
 seller.stand=false;assert.equal(guard(),false);seller.stand=true;
 seller.in='other-instance';assert.equal(guard(),false);seller.in='main';
 seller.map='other';assert.equal(guard(),false);seller.map='main';
 offer.buy=true;assert.equal(guard(),false);offer.buy=false;
 offer.giveaway=true;assert.equal(guard(),false);offer.giveaway=false;
 offer.price=300;assert.equal(guard(),false);offer.price=100;
 r.maxPrice=90;assert.equal(guard(),false);r.maxPrice=200;
 offer.q=1;assert.equal(guard(),false);offer.q=2;
 offer.rid='swapped';assert.equal(guard(),false);offer.rid='offer-1';
 assert.equal(guard(),true);
});

test('U05 independent sessions cannot each exhaust the same account risk ceiling',()=>{
 const meMerchant={name:'M',role:'merchant',enabled:true,group:'team'};
 const meFarmer={name:'F',role:'farmer',enabled:true,group:'team'};
 const cfg={general:{messageTtlMs:30000},party:{merchant:'M',leader:'F',selection:'fixed'},characters:[meMerchant,meFarmer],production:{lossBudget:100}};
 const mk=(me,gold,bankGold,peerGold)=>{
  const bot={me,cfg,p:{c:{gold,...(bankGold===null?{}:{bank:{gold:bankGold}})},realm:()=> 'EUII',read:()=>null},
   transport:{fresh:()=>({running:true,realm:'EUII',goldBalance:peerGold,...(me.role==='farmer'?{bankGoldBalance:5000}:{})})},
   farmers:['F'],leader:'F',exec:{pending:new Map()},running:true,report(){}};
  return createAccount(bot);
 };
 const merchant=mk(meMerchant,5000,5000,5000),farmer=mk(meFarmer,5000,null,5000);
 for(const account of [merchant,farmer]){
  assert.equal(account.risk().riskLimit,100);
  assert.equal(account.risk().memberCount,2);
  assert.equal(account.risk().sessionRiskLimit,50);
  assert.equal(account.spendAllowed(50,0),true);
  assert.equal(account.spendAllowed(51,0),false);
 }
 assert.equal(merchant.risk().sessionRiskLimit+farmer.risk().sessionRiskLimit,100);
});
test('U05 partial account evidence still partitions the known liquid floor across configured members',()=>{
 const me={name:'M',role:'merchant',enabled:true,group:'team'};
 const cfg={party:{merchant:'M',leader:'F',selection:'fixed'},characters:[me,{name:'F',enabled:true,role:'farmer',group:'team'},{name:'B',enabled:true,role:'farmer',group:'team'}],production:{lossBudget:1000}};
 const account=createAccount({me,cfg,p:{c:{gold:1000,bank:{gold:0}},realm:()=> 'EUII',read:()=>null},transport:{fresh:()=>null},farmers:['F'],leader:'F',exec:{pending:new Map()},running:true,report(){}});
 const snap=account.risk();
 assert.equal(snap.complete,false);assert.equal(snap.liquidFloor,1000);
 assert.equal(snap.riskLimit,10);assert.equal(snap.memberCount,3);
 assert.equal(snap.sessionRiskLimit,3);
 assert.equal(account.spendAllowed(3,0),true);
 assert.equal(account.spendAllowed(4,0),false);
 assert.equal(account.spendAllowed(2.5,0),false);
});
test('U05 overflowed account balances or unsafe exposure cannot grant automatic budget',()=>{
 const max=Number.MAX_SAFE_INTEGER;
 const overflowing=accountRiskSnapshot([max,1],0,1000);
 assert.equal(overflowing.complete,false);
 assert.equal(overflowing.wealth,null);
 assert.equal(overflowing.liquidFloor,0);
 assert.equal(overflowing.riskLimit,0);
 assert.equal(accountRiskSnapshot([max],1,1000).riskLimit,0);
 const me={name:'M',role:'merchant',enabled:true,group:'team'};
 const cfg={party:{merchant:'M',leader:'M',selection:'fixed'},characters:[me],production:{lossBudget:1000}};
 const account=createAccount({me,cfg,p:{c:{gold:10000,bank:{gold:10000}},realm:()=> 'EUII',read:()=>null},transport:{fresh:()=>null},farmers:[],leader:'M',exec:{pending:new Map()},running:true,report(){}});
 assert.equal(account.spendAllowed(Number.MAX_SAFE_INTEGER,1),false);
 assert.equal(account.spendAllowed(Infinity,0),false);
 assert.equal(account.spendAllowed(0,0),true);
});

test('U04 buyer ignores out-of-range trade slot names even if the offer otherwise matches',()=>{
 const item={name:'ring',level:0},c={name:'M',map:'main',in:'main',x:0,y:0,items:[]};
 const offer={name:'ring',level:0,q:2,rid:'offer',price:100};
 const seller={id:'S',name:'S',type:'character',stand:true,map:'main',in:'main',x:10,y:0,slots:{trade17:offer}};
 let purchases=0;
 const econ={count:()=>0,destination:()=>null,perform:()=>{purchases++;return true;}};
 const bot={p:{c,entities:{S:seller}},cfg:{merchant:{minFreeSlots:0,marketHistory:false,position:{enabled:false}},general:{testLogging:true}},me:{name:'M'},economy:econ,exec:{},free:()=>5,entity:()=>seller};
 const market=createMarket(bot),rule={action:'marketBuy',priceSource:'fixed',maxPrice:200,batch:2,targetCount:4,maxCount:4};
 assert.equal(market.buy(item,rule),false);
 assert.equal(purchases,0);
 delete seller.slots.trade17;seller.slots.trade1=offer;
 assert.equal(market.buy(item,rule),true);
 assert.equal(purchases,1);
});
test('U04 player market-buy dispatch rechecks target stock and available inventory slots',()=>{
 const item={name:'ring',level:0},c={name:'M',map:'main',in:'main',x:0,y:0,items:[]};
 const offer={name:'ring',level:0,q:2,rid:'offer',price:100};
 const seller={id:'S',name:'S',type:'character',stand:true,map:'main',in:'main',x:10,y:0,slots:{trade1:offer}};
 let amount=0,free=2,guard=null;
 const econ={count:()=>amount,perform:(kind,args)=>{guard=args.guard;return true;}};
 const bot={p:{c,entities:{S:seller}},cfg:{merchant:{minFreeSlots:0,marketHistory:false,position:{enabled:false}},general:{testLogging:true}},me:{name:'M'},economy:econ,exec:{},free:()=>free,entity:()=>seller};
 const market=createMarket(bot),rule={action:'marketBuy',priceSource:'fixed',maxPrice:200,batch:2,targetCount:3,maxCount:3};
 assert.equal(market.buy(item,rule),true);
 assert.equal(guard(),true);
 amount=2;assert.equal(guard(),false,'Loot or another action has already filled the target');
 amount=0;free=0;assert.equal(guard(),false,'No remaining inventory workspace');
 free=2;rule.maxCount=1;assert.equal(guard(),false,'A changed rule cannot overbuy');
 rule.maxCount=3;assert.equal(guard(),true);
});
test('U04 passive market wishlist verifies target demand and live price before publication',()=>{
 const item={name:'ring',level:0},c={name:'M',map:'main',in:'main',x:0,y:0,items:[],stand:true,slots:{}};
 let amount=0,guard=null;
 const econ={count:()=>amount,perform:(kind,args)=>{assert.equal(kind,'market.wishlist');guard=args.guard;return true;}};
 const bot={p:{c,entities:{}},cfg:{merchant:{marketHistory:false},general:{testLogging:true}},me:{name:'M'},economy:econ,exec:{}};
 const market=createMarket(bot),rule={action:'wishlist',priceSource:'fixed',maxPrice:200,batch:2,targetCount:3,maxCount:3,slot:'trade1'};
 assert.equal(market.wishlist(item,rule),true);
 assert.equal(guard(),true);
 amount=2;assert.equal(guard(),false);
 amount=0;rule.maxPrice=100;assert.equal(guard(),false);
 rule.maxPrice=200;rule.maxCount=1;assert.equal(guard(),false);
 rule.maxCount=3;c.slots.trade1={name:'other'};assert.equal(guard(),false);
 delete c.slots.trade1;assert.equal(guard(),true);
 rule.slot='trade2';assert.equal(guard(),false,'Changed trade slot cannot redirect an existing order');
 rule.slot='trade1';assert.equal(guard(),true);
});

test('U05 craft dispatch rejects changed recipe, ingredient quantity, and protected stock',()=>{
 const recipe={cost:5,q:1,items:[[2,'ore']]};
 const c={name:'M',items:[{name:'ore',q:4},...Array(41).fill(null)]};
 const p={c,G:{items:{ore:{s:9999},ingot:{}},craft:{ingot:recipe}},read:()=>null};
 const cfg={production:{enabled:true,craft:true,autonomy:false,goals:[]},merchant:{minFreeSlots:0},general:{testLogging:undefined}};
 let guard=null,policy={action:'craft',keep:0,teamReserve:0};
 const e={remaining:()=>true,rules:()=>policy,explicit:()=>null,safe:i=>!!i&&!i.l,count:i=>c.items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
  destination:()=>({map:'main',in:'main',x:0,y:0}),perform:(kind,opts)=>{assert.equal(kind,'craft');guard=opts.guard;return true;},travel:()=>true,at:()=>true,note:()=>{}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},economy:e,free:()=>c.items.filter(x=>!x).length};
 const production=createProduction(bot),rule={item:'ingot',action:'craft',recipe:'ingot',targetCount:2,maxCount:2};
 assert.equal(production.craft('ingot',rule),true);
 assert.equal(guard(),true);
 recipe.cost=200;assert.equal(guard(),false,'Recipe price changed before dispatch');recipe.cost=5;
 recipe.items[0][0]=3;assert.equal(guard(),false,'Live ingredients changed');recipe.items[0][0]=2;
 c.items[0].q=1;assert.equal(guard(),false,'Ingredient amount no longer sufficient');c.items[0].q=4;
 policy={action:'keep',keep:0,teamReserve:0};assert.equal(guard(),false,'Explicit keep protects ingredients');
 policy={action:'craft',keep:3,teamReserve:0};assert.equal(guard(),false,'New stock reserve protects materials');
 policy={action:'craft',keep:0,teamReserve:0};
 cfg.production.craft=false;assert.equal(guard(),false,'Production disabled before dispatch');cfg.production.craft=true;
 rule.targetCount=0;assert.equal(guard(),false,'Output cap decreased');rule.targetCount=2;
 c.items[1]={name:'ingot',level:0,q:2};assert.equal(guard(),false,'Goal was fulfilled by another action');c.items[1]=null;
 assert.equal(guard(),true);
});
test('U05 craft dispatch rejects reselected alias and recipe-output drift',()=>{
 const original={cost:1,items:[[1,'ore']],output:{name:'ingot'}};
 const c={items:[{name:'ore',q:3},...Array(41).fill(null)]};
 const G={items:{ore:{s:99},ingot:{}},craft:{alias:original}};
 const p={c,G,read:()=>null},cfg={production:{enabled:true,craft:true,autonomy:false,goals:[]},merchant:{minFreeSlots:0},general:{}};
 let guard=null;
 const e={remaining:()=>true,rules:()=>null,explicit:()=>null,safe:i=>!!i,count:i=>c.items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
  destination:()=>({map:'main',in:'main',x:0,y:0}),perform:(kind,opts)=>{guard=opts.guard;return true;},travel:()=>true,at:()=>true,note:()=>{}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},economy:e,free:()=>40},rule={item:'ingot',action:'craft',recipe:'alias',targetCount:3,maxCount:3};
 const production=createProduction(bot);
 assert.equal(production.craft('ingot',rule),true);assert.equal(guard(),true);
 G.craft.alias={cost:1,items:[[1,'ore']],output:{name:'other'}};
 assert.equal(guard(),false,'A replaced recipe must not be dispatched');
 G.craft.alias={...original};
 assert.equal(guard(),true);
 rule.recipe='other';assert.equal(guard(),false,'A changed explicit recipe selection invalidates authorization');
});

test('U05 upgrade preview cannot dispatch after changed chance limits, goals or game definitions',async()=>{
 const c={items:[{name:'helmet',level:0},{name:'scroll0',q:2},...Array(40).fill(null)]};
 const G={items:{helmet:{upgrade:true},scroll0:{g:5}},craft:{}},p={c,G,read:()=>null,call:(name,...args)=>{
  if(name==='item_grade')return 0;
  if(name==='upgrade'&&args.at(-1)===true)return Promise.resolve({chance:.9,cost:5});
  throw Error('Unexpected game call: '+name);
 }};
 const cfg={production:{enabled:true,upgrade:true,autonomy:false,goals:[],minChance:.5},merchant:{minFreeSlots:0},general:{}};
 const rule={action:'upgrade',item:'helmet',targetLevel:1,minChance:.5,keep:0,teamReserve:0};
 const count=i=>c.items.reduce((n,x)=>n+(x?.name===i?.name&&(x.level??0)===(i.level??0)?(x.q??1):0),0);
 let guard=null;
 const econ={remaining:()=>true,safe:i=>!!i&&!i.l,count,rules:()=>({action:'upgrade',keep:0,teamReserve:0}),value:()=>2,
  destination:()=>({map:'main',in:'main',x:0,y:0}),travel:()=>true,at:()=>true,note:()=>{},
  perform:(kind,opts)=>{guard=opts.guard;return true;}};
 const exec={busy:()=>false,run:(name,locks,canRun,call)=>{assert.equal(name,'production.preview');void call();return true;}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},running:true,economy:econ,exec,free:()=>40};
 const production=createProduction(bot);
 assert.equal(production.mutate(0,rule),true);await Promise.resolve();
 assert.equal(production.mutate(0,rule),true);
 assert.equal(guard(),true);
 cfg.production.upgrade=false;assert.equal(guard(),false);cfg.production.upgrade=true;
 rule.targetLevel=0;assert.equal(guard(),false);rule.targetLevel=1;
 rule.minChance=.95;assert.equal(guard(),false);rule.minChance=.5;
 cfg.production.minChance=.95;assert.equal(guard(),false);cfg.production.minChance=.5;
 rule.keep=1;assert.equal(guard(),false);rule.keep=0;
 G.items.helmet.upgrade=false;assert.equal(guard(),false);G.items.helmet.upgrade=true;
 G.items.scroll0.g=500;assert.equal(guard(),false);G.items.scroll0.g=5;
 c.items[1].l=true;assert.equal(guard(),false);c.items[1].l=false;
 assert.equal(guard(),true);
});
test('U05 compound preview rejects a changed input group or newly reserved scroll',async()=>{
 const c={items:[{name:'ring',level:0},{name:'ring',level:0},{name:'ring',level:0},{name:'cscroll0',q:2},...Array(38).fill(null)]};
 const G={items:{ring:{compound:true},cscroll0:{g:5}},craft:{}},p={c,G,read:()=>null,call:(name,...args)=>{
  if(name==='item_grade')return 0;
  if(name==='compound'&&args.at(-1)===true)return Promise.resolve({chance:1,cost:5});
  throw Error('Unexpected game call: '+name);
 }};
 const cfg={production:{enabled:true,compound:true,autonomy:false,goals:[],minChance:.5},merchant:{minFreeSlots:0},general:{}};
 const rule={action:'compound',item:'ring',targetLevel:1,minChance:.5,keep:0,teamReserve:0};
 const count=i=>c.items.reduce((n,x)=>n+(x?.name===i?.name&&(x.level??0)===(i.level??0)?(x.q??1):0),0);
 let guard=null,scrollKeep=0;
 const econ={remaining:()=>true,safe:i=>!!i&&!i.l,count,rules:i=>({action:'compound',keep:i.name==='cscroll0'?scrollKeep:0,teamReserve:0}),value:()=>2,
  destination:()=>({map:'main',in:'main',x:0,y:0}),travel:()=>true,at:()=>true,note:()=>{},
  perform:(kind,opts)=>{guard=opts.guard;return true;}};
 const exec={busy:()=>false,run:(name,locks,canRun,call)=>{assert.equal(name,'production.preview');void call();return true;}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},running:true,economy:econ,exec,free:()=>40};
 const production=createProduction(bot);
 assert.equal(production.mutate(0,rule),true);await Promise.resolve();
 assert.equal(production.mutate(0,rule),true);assert.equal(guard(),true);
 c.items[2]={name:'different',level:0};assert.equal(guard(),false);
 c.items[2]={name:'ring',level:0};scrollKeep=2;assert.equal(guard(),false);
 scrollKeep=0;assert.equal(guard(),true);
});

test('U05 merchant gold-transfer cooldown survives a module restart and excludes its new balance',()=>{
 const store=new Map(),now=Date.now();
 const me={name:'M',role:'merchant',group:'g',goldReserve:0};
 const cfg={merchant:{collectGold:true,enabled:true,goldTransferMax:5000,goldReserve:0},general:{messageTtlMs:15000},party:{merchant:'M',leader:'F',selection:'fixed'},characters:[{name:'M',enabled:true,group:'g',role:'merchant'},{name:'F',enabled:true,group:'g',role:'farmer'}],production:{lossBudget:1000}};
 const c={name:'M',map:'main',in:'main',x:0,y:0,gold:20000,bank:{gold:0}},h={name:'F',map:'main',in:'main',x:0,y:0,running:true,realm:'EUII',session:'sender-session',goldBalance:10000};
 let accepted=0;
 const p={c,realm:()=> 'EUII',read:k=>store.get(k)??null,write:(k,v)=>{store.set(k,v);return true;}};
 const bot={p,cfg,me,running:true,journal:null,inventoryBlocked:false,checkpoint:{durable:true},logistics:{reserved:false},exec:{busy:()=>false,pending:new Map()},transport:{fresh:()=>h,send:()=>{accepted++;return Promise.resolve(true);}},entity:()=>h,report(){},event(){},movement:{stop(){}},farmers:['F'],leader:'F',beginValue(v){this.journal=v;},endValue(){this.journal=null;}};
 bot.gold=createGoldLogistics(bot);
 assert.equal(bot.gold.transferAt,0);
 bot.gold.receive('F',{type:'goldOffer',id:'offer1',session:h.session,data:{quantity:1000}});
 assert.equal(accepted,1);assert.equal(bot.gold.reserved,true);
 const stamp=store.get('albot:gold:M:recent-transfer');
 assert.ok(Number.isSafeInteger(stamp)&&stamp>=now);
 bot.gold=createGoldLogistics(bot);
 assert.equal(bot.gold.reserved,false,'New module has no in-memory active transfer');
 assert.equal(bot.gold.transferAt,stamp,'Persisted transfer grace period is restored');
 const account=createAccount(bot),snapshot=account.risk();
 assert.equal(snapshot.liquidFloor,10000,'Do not count the receiver while the sender heartbeat can be stale');
 assert.equal(snapshot.complete,false);
});
test('U05 a receiver never accepts a gold handoff without durable cooldown protection',()=>{
 const me={name:'M',role:'merchant',group:'g'};
 const cfg={merchant:{collectGold:true,enabled:true,goldTransferMax:5000,goldReserve:0},general:{messageTtlMs:15000},party:{merchant:'M'},characters:[{name:'F',enabled:true,role:'farmer',group:'g'}]};
 const c={name:'M',map:'main',in:'main',x:0,y:0,gold:2000};
 const peer={name:'F',map:'main',in:'main',x:1,y:0,realm:'EUII',running:true,session:'f1'};
 let accepted=0,journal=0;
 const bot={p:{c,read:()=>null,write:()=>false,realm:()=> 'EUII'},cfg,me,running:true,journal:null,inventoryBlocked:false,checkpoint:{durable:true},logistics:{reserved:false},exec:{busy:()=>false},transport:{fresh:()=>peer,send:()=>{accepted++;return Promise.resolve(true);}},entity:()=>peer,movement:{stop(){}},report(){},event(){},beginValue(){journal++;}};
 const gold=createGoldLogistics(bot);
 gold.receive('F',{type:'goldOffer',id:'offer2',session:'f1',data:{quantity:500}});
 assert.equal(gold.reserved,false);
 assert.equal(accepted,0,'No goldAccept was emitted');
 assert.equal(journal,0,'No value intent was entered');
});
test('U05 gold-transfer timestamps reject stale or invalid saved values on new sessions',()=>{
 const now=Date.now(),key='albot:gold:F:recent-transfer';
 const me={name:'F',role:'farmer'},cfg={general:{messageTtlMs:15000},merchant:{goldReserve:0}},store=new Map();
 const bot={p:{read:k=>store.get(k),write:(k,v)=>{store.set(k,v);return true;}},me,cfg};
 store.set(key,now-200000);assert.equal(createGoldLogistics(bot).transferAt,0);
 store.set(key,'nonsense');assert.equal(createGoldLogistics(bot).transferAt,0);
 store.set(key,now-1000);assert.ok(createGoldLogistics(bot).transferAt>=now-1000);
});

test('U05 failed durable sender stamp cancels before executor and never leaves a value journal',()=>{
 const me={name:'F',role:'farmer',group:'team',goldReserve:0};
 const cfg={merchant:{collectGold:true,enabled:true,goldTransferMax:500,goldCollectBelow:100,goldReserve:0},party:{merchant:'M'},general:{messageTtlMs:15000}};
 const c={name:'F',map:'main',in:'main',x:0,y:0,gold:1000};
 const peer={name:'M',map:'main',in:'main',x:1,y:0,session:'merchant-1',realm:'EUII',running:true};
 const sent=[];let queued=0,logs=0;
 const bot={me,cfg,p:{c,read:()=>null,write:()=>false,realm:()=> 'EUII'},running:true,journal:null,inventoryBlocked:false,
  checkpoint:{durable:true},logistics:{reserved:false,itemReserved:false},bank:{pending:false},exec:{busy:()=>false,run:()=>{queued++;return true;}},
  transport:{fresh:()=>peer,send:(to,type,data,id)=>{sent.push({to,type,data,id});return Promise.resolve(true);}},
  entity:()=>peer,session:'f1',event(){},report(){logs++;},beginValue(){assert.fail('Failed stamp cannot create value journal');},endValue(){assert.fail('No value action dispatched');}};
 const gold=createGoldLogistics(bot);bot.gold=gold;
 gold.poll(true);
 assert.equal(gold.status().state,'offered');
 assert.deepEqual(sent.map(x=>x.type),['goldOffer']);
 const offer=sent[0];
 gold.receive('M',{type:'goldAccept',id:offer.id,session:peer.session,data:{quantity:500}});
 assert.equal(gold.status().state,'accepted');
 gold.poll();
 assert.equal(queued,0,'Executor never sees a non-durable gold send');
 assert.equal(gold.reserved,false);
 assert.equal(bot.journal,null);
 assert.equal(bot.inventoryBlocked,false);
 assert.equal(c.gold,1000);
 assert.deepEqual(sent.map(x=>x.type),['goldOffer','goldCancel']);
 assert.equal(sent[1].data.notDispatched,true);
 assert.ok(logs>0);
});

test('U04 mutable bid price cannot silently change the agreed sale at dispatch',()=>{
 const item={name:'ring',level:1,q:3},c={name:'M',map:'main',in:'main',x:0,y:0,items:[item],gold:500,slots:{}};
 const bid={name:'ring',level:1,price:150,q:3,b:true,rid:'buyer-bid'};
 const buyer={id:'B',name:'B',type:'character',stand:true,map:'main',in:'main',x:10,y:0,slots:{trade1:bid}};
 const p={c,entities:{B:buyer},has:()=>true,read:()=>null};
 let action=null;
 const economy={safe:()=>true,spare:()=>3,count:()=>c.items[0]?.q??0,rules:()=>({action:'sell'}),perform:(kind,args)=>{assert.equal(kind,'market.sell');action=args;return true;}};
 const bot={p,me:{name:'M'},cfg:{merchant:{marketHistory:false},production:{}},economy,exec:{},entity:()=>buyer};
 const rule={action:'sell',minPrice:100};
 assert.equal(createMarket(bot).sellToBid(0,rule),true);
 assert.equal(action.details.expectedGold,450);
 assert.equal(action.guard(),true);
 bid.price=20;assert.equal(action.guard(),false,'A lower live price is not the originally approved bid');
 bid.price=200;assert.equal(action.guard(),false,'Even a changed higher bid needs a new value decision');
 bid.price=150;rule.minPrice=160;assert.equal(action.guard(),false,'Raised explicit minimum price invalidates pending sale');
 rule.minPrice=100;assert.equal(action.guard(),true);
 bid.q=2;assert.equal(action.guard(),false,'Reduced buyer quantity invalidates original trade');
 bid.q=3;bid.b=false;assert.equal(action.guard(),false,'Removed buy side cannot execute');
 bid.b=true;assert.equal(action.guard(),true);
});
test('U04 market listing cannot publish an old ask after changed minimum, slot or spare quantity',()=>{
 const item={name:'ring',q:4,level:0},c={name:'M',stand:true,slots:{},items:[item]};
 let quantity=4,action=null;
 const p={c,read:()=>null},economy={count:()=>4,spare:()=>quantity,perform:(kind,args)=>{assert.equal(kind,'market.list');action=args;return true;}};
 const bot={p,me:{name:'M'},cfg:{merchant:{marketHistory:false},general:{}},economy,exec:{}};
 const market=createMarket(bot),rule={action:'list',minPrice:100,priceSource:'fixed',slot:'trade1'};
 assert.equal(market.listing(0,rule),true);
 assert.equal(action.guard(),true);
 rule.minPrice=120;assert.equal(action.guard(),false);
 rule.minPrice=100;rule.slot='trade2';assert.equal(action.guard(),false,'Cannot silently switch to a different trade slot');
 rule.slot='trade1';quantity=3;assert.equal(action.guard(),false,'No longer have sufficient released inventory');
 quantity=4;c.slots.trade1={name:'other'};assert.equal(action.guard(),false);
 delete c.slots.trade1;c.stand=false;assert.equal(action.guard(),false);
 c.stand=true;assert.equal(action.guard(),true);
});
test('U04 sale refuses a live buyer bid whose total payout overflows safe integer money',()=>{
 const item={name:'ring',level:0,q:3},c={name:'M',map:'main',in:'main',x:0,y:0,items:[item],gold:0};
 const bid={name:'ring',level:0,price:Number.MAX_SAFE_INTEGER,q:3,b:true,rid:'big-bid'};
 const buyer={id:'B',name:'B',type:'character',stand:true,map:'main',in:'main',x:5,y:0,slots:{trade1:bid}};
 let queued=0;
 const market=createMarket({p:{c,entities:{B:buyer},has:()=>true,read:()=>null},me:{name:'M'},cfg:{merchant:{marketHistory:false},production:{}},economy:{safe:()=>true,spare:()=>3,count:()=>3,perform:()=>{queued++;return true;}},exec:{},entity:()=>buyer});
 assert.equal(market.sellToBid(0,{action:'sell',minPrice:1}),false);
 assert.equal(queued,0);
});

test('U04 passive wishlist refuses an unsafe maximum escrow value',()=>{
 const item={name:'ring',level:0};
 const c={name:'M',items:[],stand:true,slots:{}};
 let queued=0;
 const bot={p:{c,entities:{}},cfg:{merchant:{marketHistory:false},general:{}},me:{name:'M'},
  economy:{count:()=>0,perform:()=>{queued++;return true;}},exec:{}};
 const r={action:'wishlist',priceSource:'fixed',maxPrice:Number.MAX_SAFE_INTEGER,batch:2,targetCount:2,maxCount:2,slot:'trade1'};
 assert.equal(createMarket(bot).wishlist(item,r),false);
 assert.equal(queued,0,'No buy-order escrow can be reserved with unsafe money arithmetic');
 r.maxPrice=150;
 assert.equal(createMarket(bot).wishlist(item,r),true);
 assert.equal(queued,1);
});

test('U05 official craft grid preserves duplicate recipe positions while material planning totals them',()=>{
 const recipe={items:[[2,'herb'],[1,'stone'],[3,'herb']]};
 assert.deepEqual(recipeGridIngredients(recipe),[
  {quantity:2,item:'herb',level:0},{quantity:1,item:'stone',level:0},{quantity:3,item:'herb',level:0}
 ]);
 assert.deepEqual(recipeIngredients(recipe),[
  {quantity:5,item:'herb',level:0},{quantity:1,item:'stone',level:0}
 ]);
 assert.throws(()=>recipeIngredients({items:[[Number.MAX_SAFE_INTEGER,'herb'],[1,'herb']]}),/sichere Ganzzahl/);
 assert.throws(()=>recipeGridIngredients({items:Array.from({length:10},()=>[1,'herb'])}),/Rezeptgitter/);
 assert.throws(()=>recipeGridIngredients({items:[[1,'herb',-1]]}),/Rezeptzutat/);
});
test('U05 craft uses three correctly ordered grid positions and confirms total repeated input loss',()=>{
 const recipe={cost:10,output:{name:'result'},items:[[2,'herb'],[1,'stone'],[3,'herb']]};
 const c={name:'M',items:[{name:'herb',q:2},null,{name:'herb',q:3},null,null,{name:'stone',q:1},...Array(36).fill(null)]};
 const G={items:{herb:{s:9999},stone:{s:9999},result:{}},craft:{alias:recipe}};
 const p={c,G,read:()=>null,call:(name,...args)=>{assert.equal(name,'craft');assert.deepEqual(args,[0,5,2]);return Promise.resolve();}};
 const cfg={production:{enabled:true,craft:true,autonomy:false,goals:[]},merchant:{minFreeSlots:0},general:{}};
 let action=null;
 const count=i=>c.items.reduce((n,x)=>n+(x?.name===i?.name&&(x.level??0)===(i.level??0)?(x.q??1):0),0);
 const economy={remaining:()=>true,rules:()=>null,safe:i=>!!i&&!i.l&&!i.b,count,explicit:()=>null,
  destination:()=>({map:'main',in:'main',x:0,y:0}),travel:()=>true,at:()=>true,note:()=>{},
  perform:(kind,args)=>{assert.equal(kind,'craft');action=args;return true;}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},economy,free:()=>c.items.filter(i=>!i).length};
 const production=createProduction(bot);
 const rule={item:'result',action:'craft',recipe:'alias',targetCount:2,maxCount:2};
 assert.equal(production.craft('result',rule),true);
 assert.deepEqual(action.slots,[0,5,2]);
 assert.equal(action.guard(),true);
 action.call();
 c.items[0]=null;c.items[5]=null;c.items[1]={name:'result',q:1};
 assert.equal(action.observe(),false,'One of two herb stacks was not consumed');
 c.items[2]=null;
 assert.equal(action.observe(),true,'Total consumption of five herbs is confirmed');
});
test('U05 craft duplicate inputs never consume protected aggregate reserves or silently collapse grid positions',()=>{
 const c={name:'M',items:[{name:'herb',q:2},{name:'herb',q:3},...Array(40).fill(null)]};
 const p={c,G:{items:{herb:{s:9999},result:{}},craft:{result:{cost:1,items:[[2,'herb'],[3,'herb']]} }},read:()=>null};
 const cfg={production:{enabled:true,craft:true,autonomy:false,goals:[]},merchant:{minFreeSlots:0},general:{}};
 let attempted=0,keep=1;
 const count=i=>c.items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0);
 const economy={remaining:()=>true,rules:()=>({action:'craft',keep,teamReserve:0}),safe:i=>!!i,count,explicit:()=>null,
  destination:()=>({map:'main',in:'main',x:0,y:0}),travel:()=>true,at:()=>true,note:()=>{},
  perform:()=>{attempted++;return true;}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},economy,free:()=>40};
 const production=createProduction(bot),rule={item:'result',action:'craft',recipe:'result',targetCount:1,maxCount:1};
 assert.equal(production.craft('result',rule),false,'5 total needed, 1 must remain protected');
 assert.equal(attempted,0,'No invalid merge or craft was dispatched');
 keep=0;
 assert.equal(production.craft('result',rule),true);
 assert.equal(attempted,1);
 c.items[1]=null;c.items[0].q=5;
 assert.equal(production.craft('result',rule),false,'One merged stack cannot fill two recipe grid positions');
 assert.equal(attempted,1);
});

test('U05 recipe material totals preserve separate levels of the same ingredient',()=>{
 const recipe={cost:7,items:[[1,'ring',0],[1,'ring',2],[2,'ring',0]]};
 assert.deepEqual(recipeGridIngredients(recipe),[
  {item:'ring',level:0,quantity:1},{item:'ring',level:2,quantity:1},{item:'ring',level:0,quantity:2}
 ]);
 assert.deepEqual(recipeIngredients(recipe),[
  {item:'ring',level:0,quantity:3},{item:'ring',level:2,quantity:1}
 ]);
 const G={items:{ring:{upgrade:true},bundle:{}},craft:{bundle:recipe}};
 const steps=planProduction({G,item:'bundle',stock:(name,level)=>name==='ring'?(level===0?3:level===2?1:0):0,bank:()=>0,canBuy:()=>false,allowed:['craft']});
 assert.deepEqual(steps.map(x=>x.kind),['craft']);
 assert.deepEqual(steps.reservations,[{item:'ring',level:0,quantity:3},{item:'ring',level:2,quantity:1}]);
});
test('U05 crafting selects mixed upgrade levels in original recipe order and keeps level-specific reserves',()=>{
 const recipe={cost:7,items:[[1,'ring',0],[1,'ring',2],[2,'ring',0]]};
 const c={name:'M',items:[{name:'ring',level:0,q:1},{name:'ring',level:2},{name:'ring',level:0,q:2},...Array(38).fill(null)]};
 const G={items:{ring:{s:9999},bundle:{}},craft:{bundle:recipe}},p={c,G,read:()=>null,call:()=>{}};
 const cfg={production:{enabled:true,craft:true,goals:[],autonomy:false},merchant:{minFreeSlots:0},general:{}};
 let posted=null,level2Keep=0;
 const economy={remaining:()=>true,rules:i=>({action:'craft',keep:(i?.level??0)===2?level2Keep:0,teamReserve:0}),safe:i=>!!i&&!i.l,
  count:i=>c.items.reduce((sum,x)=>sum+(x?.name===i?.name&&(x.level??0)===(i.level??0)?(x.q??1):0),0),
  explicit:()=>null,destination:()=>({map:'main',in:'main',x:0,y:0}),travel:()=>true,at:()=>true,note:()=>{},
  perform:(kind,details)=>{assert.equal(kind,'craft');posted=details;return true;}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},economy,free:()=>38},production=createProduction(bot);
 const rule={item:'bundle',action:'craft',targetCount:1,maxCount:1,recipe:'bundle'};
 level2Keep=1;assert.equal(production.craft('bundle',rule),false,'The upgraded ring is protected');
 level2Keep=0;assert.equal(production.craft('bundle',rule),true);
 assert.deepEqual(posted.slots,[0,1,2]);
 assert.equal(posted.guard(),true);
 level2Keep=1;assert.equal(posted.guard(),false,'Level-specific reserve changed before dispatch');
 level2Keep=0;assert.equal(posted.guard(),true);
});
test('U05 malformed crafting definitions fail closed without throwing from production tick',()=>{
 const recipes=[
  {cost:1,items:Array.from({length:10},()=>[1,'ore'])},
  {cost:1,items:[[0,'ore']]},
  {cost:1,items:[[2,'ore',-1]]},
  {cost:1,items:[[Number.MAX_SAFE_INTEGER,'ore'],[1,'ore']]}
 ];
 const c={name:'M',items:[{name:'ore',q:5},...Array(40).fill(null)]};
 const G={items:{ore:{},result:{}},craft:{result:recipes[0]}};
 let queued=0,errors=0;
 const bot={p:{c,G,read:()=>null},cfg:{production:{enabled:true,craft:true},general:{}},
  me:{name:'M',role:'merchant'},event:(name)=>{if(name==='production.craft-unavailable')errors++;},
  economy:{remaining:()=>true,perform:()=>{queued++;return true;}},free:()=>40};
 const production=createProduction(bot),rule={action:'craft',item:'result',recipe:'result',targetCount:1,maxCount:1};
 for(const recipe of recipes){G.craft.result=recipe;assert.doesNotThrow(()=>production.craft('result',rule));assert.equal(production.craft('result',rule),false);}
 assert.equal(queued,0);
 assert.equal(errors,recipes.length*2);
});

test('U05 positional craft matcher reassigns already chosen slots through augmenting paths',()=>{
 assert.deepEqual(matchRecipeSlots([[0,1],[1,2],[0,2]]),[1,2,0]);
 assert.deepEqual(matchRecipeSlots([[0,1],[0]]),[1,0]);
 assert.equal(matchRecipeSlots([[0],[0]]),null);
 assert.equal(matchRecipeSlots([[],[1]]),null);
 assert.equal(matchRecipeSlots(Array.from({length:10},()=>[0])),null);
});
test('U05 crafting assigns a small stack to the small recipe row despite inventory order',()=>{
 const recipe={cost:4,items:[[1,'herb'],[3,'herb']]};
 const c={name:'M',items:[{name:'herb',q:3},{name:'herb',q:1},...Array(40).fill(null)]};
 const G={items:{herb:{s:9999},result:{}},craft:{result:recipe}},p={c,G,read:()=>null};
 const cfg={production:{enabled:true,craft:true,autonomy:false,goals:[]},merchant:{minFreeSlots:0},general:{}};
 let action=null;
 const economy={remaining:()=>true,rules:()=>null,safe:i=>!!i&&!i.l,count:i=>c.items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
  explicit:()=>null,destination:()=>({map:'main',in:'main',x:0,y:0}),travel:()=>true,at:()=>true,note:()=>{},
  perform:(kind,args)=>{assert.equal(kind,'craft');action=args;return true;}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},economy,free:()=>40};
 const production=createProduction(bot),rule={item:'result',action:'craft',recipe:'result',targetCount:1,maxCount:1};
 assert.equal(production.craft('result',rule),true,'Perfect matching exists, so first-fit must not reject it');
 assert.deepEqual(action.slots,[1,0],'The second recipe row receives the only three-unit stack');
 assert.equal(action.guard(),true);
 c.items[1].l=true;
 assert.equal(action.guard(),false,'Locked selected stack invalidates authorization');
 c.items[1].l=false;
 assert.equal(action.guard(),true);
});
test('U05 craft matching restores correct three-position order and never reuses an inventory slot',()=>{
 const recipe={cost:3,items:[[2,'herb'],[1,'herb'],[3,'herb']]};
 const c={name:'M',items:[{name:'herb',q:3},{name:'herb',q:2},{name:'herb',q:1},...Array(39).fill(null)]};
 const p={c,G:{items:{herb:{s:9999},result:{}},craft:{result:recipe}},read:()=>null};
 const cfg={production:{enabled:true,craft:true,autonomy:false,goals:[]},merchant:{minFreeSlots:0},general:{}};
 let action=null;
 const economy={remaining:()=>true,rules:()=>null,safe:i=>!!i,count:i=>c.items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
  explicit:()=>null,destination:()=>({map:'main',in:'main',x:0,y:0}),travel:()=>true,at:()=>true,note:()=>{},
  perform:(kind,args)=>{action=args;return true;}};
 const bot={p,cfg,me:{name:'M',role:'merchant'},economy,free:()=>40};
 const production=createProduction(bot),rule={item:'result',action:'craft',recipe:'result',targetCount:1,maxCount:1};
 assert.equal(production.craft('result',rule),true);
 assert.deepEqual(action.slots,[1,2,0]);
 assert.equal(new Set(action.slots).size,3);
 c.items[2]=null;
 assert.equal(action.guard(),false,'Losing a required grid stack blocks delayed craft');
});

test('U05 craft preparation refuses merging a stack protected by an effective keep rule',()=>{
 const c={name:'M',items:[{name:'herb',q:2,protectedByGoal:true},{name:'herb',q:3},...Array(40).fill(null)]};
 const G={items:{herb:{s:9999},result:{}},craft:{result:{cost:1,items:[[5,'herb']]}}};
 let calls=0;
 const e={remaining:()=>true,rules:i=>i.protectedByGoal?{action:'keep',keep:0,teamReserve:0}:{action:'craft',keep:0,teamReserve:0},
  explicit:()=>null,safe:i=>!!i&&!i.l,count:i=>c.items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
  perform:()=>{calls++;return true;}};
 const bot={p:{c,G,read:()=>null},cfg:{production:{enabled:true,craft:true},general:{}},me:{name:'M',role:'merchant'},economy:e,free:()=>40};
 const production=createProduction(bot),r={item:'result',action:'craft',recipe:'result',targetCount:1,maxCount:1};
 assert.equal(production.craft('result',r),false);
 assert.equal(calls,0,'A derived keep rule prevents inventory merges');
 delete c.items[0].protectedByGoal;
 assert.equal(production.craft('result',r),true);
 assert.equal(calls,1,'An unprotected pair can still be merged to satisfy the recipe');
});
test('U05 deferred crafting merges recheck effective rules, production, limits and reserves',()=>{
 const c={name:'M',items:[{name:'herb',q:2},{name:'herb',q:3},...Array(40).fill(null)]};
 const G={items:{herb:{s:9999},result:{}},craft:{result:{cost:1,items:[[5,'herb']]}}};
 const cfg={production:{enabled:true,craft:true},general:{}};
 let dispatch=null,materialKeep=0,active=true;
 const e={remaining:()=>active,rules:()=>({action:'craft',keep:materialKeep,teamReserve:0}),explicit:()=>null,
  safe:i=>!!i&&!i.l,count:i=>c.items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
  perform:(kind,opts)=>{assert.equal(kind,'inventory.merge');dispatch=opts;return true;}};
 const bot={p:{c,G,read:()=>null},cfg,me:{name:'M',role:'merchant'},economy:e,free:()=>40};
 const production=createProduction(bot),rule={item:'result',action:'craft',recipe:'result',targetCount:1,maxCount:1};
 assert.equal(production.craft('result',rule),true);
 assert.deepEqual(dispatch.slots,[0,1]);
 assert.equal(dispatch.guard(),true);
 materialKeep=1;assert.equal(dispatch.guard(),false,'A newly reserved ingredient blocks pending merge');
 materialKeep=0;cfg.production.craft=false;assert.equal(dispatch.guard(),false,'Disabled crafting rejects pending preparation');
 cfg.production.craft=true;G.items.herb.s=4;assert.equal(dispatch.guard(),false,'A changed stack capacity rejects unsafe merge');
 G.items.herb.s=9999;active=false;assert.equal(dispatch.guard(),false,'Exhausted production rule invalidates preparation');
 active=true;c.items[0].l=true;assert.equal(dispatch.guard(),false,'Locked material rejects deferred merge');
 c.items[0].l=false;assert.equal(dispatch.guard(),true);
});
test('U05 crafting merge selects only safe integer stacks within live stack capacity',()=>{
 const c={name:'M',items:[{name:'herb',q:2},{name:'herb',q:3},...Array(40).fill(null)]};
 const G={items:{herb:{s:4},result:{}},craft:{result:{cost:1,items:[[5,'herb']]}}};
 let queued=0;
 const e={remaining:()=>true,rules:()=>null,explicit:()=>null,safe:i=>!!i,
  count:i=>c.items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),perform:()=>{queued++;return true;}};
 const bot={p:{c,G,read:()=>null},cfg:{production:{enabled:true,craft:true},general:{}},me:{name:'M',role:'merchant'},economy:e,free:()=>40};
 const production=createProduction(bot),rule={item:'result',action:'craft',recipe:'result',targetCount:1,maxCount:1};
 assert.equal(production.craft('result',rule),false);
 assert.equal(queued,0);
 G.items.herb.s=5;
 assert.equal(production.craft('result',rule),true);
 assert.equal(queued,1);
});
