import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransitBlockObserver,verifiedTransitBlock,roadAggroTravelDecision} from '../src/combat/transit-defense.mjs';
import {assessLiveSquadMarch,createTeamPlan} from '../src/world/team-plan.mjs';
import {sharedFarmRejection} from '../src/world/strategy.mjs';
import {createCapabilities} from '../src/party/capabilities.mjs';
import {compactCombatSupport,fitHeartbeat} from '../src/party/transport.mjs';
import {farmHealer} from '../src/world/composition.mjs';
import {createServices} from '../src/merchant/services.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';
const realm='USIV',plan={id:'farm:1',kind:'farm',target:'bee',realm,map:'main',in:'main',x:2000,y:0};
const c={name:'P',ctype:'priest',map:'main',in:'main',x:0,y:0,hp:3000,max_hp:3000,mp:1000,max_mp:1000,moving:true};
const route={owner:'follow',dest:plan};
const attacker={id:'rat:1',mtype:'rat',target:'P',hp:200,map:'main',in:'main',x:30,y:0};

function farmFixture(){
 const requests=[],events=[],G={monsters:{goo:{hp:30,attack:1,frequency:1,xp:200,respawn:1},bee:{hp:30,attack:1,frequency:1,xp:20,respawn:1}},
  maps:{main:{monsters:[{type:'goo',boundaries:[['main',900,0,1100,100]]},{type:'bee',boundaries:[['main',1800,0,2000,100]]}]}}};
 const bot={p:{c:{...c,name:'L',ctype:'ranger',attack:50,frequency:1,level:80,items:[],xp:0,gold:0},G,root:{S:{}},parent:{S:{}},read:()=>null,write:()=>true,realm:()=>realm,entities:{}},
  cfg:{general:{testLogging:true,messageTtlMs:10000},farming:{pvp:false,maxAggro:1,planHoldMs:300000,switchImprovement:.45,deathWindowMs:600000},
   world:{excludedMaps:[],cacheTtlMs:10000},party:{enabled:true,merchant:'M'},production:{}},
  me:{name:'L',role:'farmer',farmTargets:[]},leader:'L',farmers:['L'],transport:{fresh:n=>n==='M'?{running:true,realm,materials:requests}:null},
  strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},monsters:()=>[],event:(type,data)=>events.push({type,data}),
  decisionEpoch:1,logistics:{reserved:false},movement:{order:null,stop(){this.order=null;}},gear:{snapshot:()=>({})},content:{approve:()=>true},progression:{bonus:()=>0}};
 return {bot,requests,events};
}
test('Merchant shell request cannot replace the committed destination before arrival or observation hold',()=>{
 const old=Date.now;let now=100000;Date.now=()=>now;
 try{const {bot,requests}=farmFixture(),team=createTeamPlan(bot);
  team.tick();const initial=team.heartbeat();assert.equal(initial.target,'goo');
  requests.push({objective:'shell-refill',item:'seashell',monster:'bee',quantity:400,priority:300,expires:1000000});
  now+=11000;bot.decisionEpoch++;team.tick();assert.equal(team.heartbeat().key,initial.key);
  Object.assign(bot.p.c,{x:initial.x,y:initial.y});
  now+=11000;bot.decisionEpoch++;team.tick();assert.equal(team.heartbeat().arrivedAt,now);
  now+=11000;bot.decisionEpoch++;team.tick();assert.equal(team.heartbeat().key,initial.key);
  assert.equal(team.status().switchAdvice.reason,'farm-arrival-observation-hold');
 }finally{Date.now=old;}
});
test('a follower elected leader retains the physical destination and arrival timestamp without cancelling its route',()=>{
 const old=Date.now;let now=100000;Date.now=()=>now;
 try{const {bot}=farmFixture(),original=createTeamPlan(bot);original.tick();
  const previous={...original.heartbeat(),arrivedAt:90000,expires:200000};
  bot.leader='Old';bot.farmers=['Old','L'];previous.leader='Old';
  bot.transport.fresh=n=>n==='Old'?{running:true,realm,farmPlan:previous}:null;
  const follower=createTeamPlan(bot);follower.tick();assert.equal(follower.heartbeat().key,previous.key);
  bot.movement.order={owner:'follow',dest:previous};bot.leader='L';now+=1000;bot.decisionEpoch++;
  follower.tick();assert.equal(follower.heartbeat().key,previous.key);
  assert.equal(follower.heartbeat().leader,'L');assert.equal(follower.heartbeat().arrivedAt,90000);
  assert.equal(bot.movement.order.owner,'follow');
 }finally{Date.now=old;}
});

test('road aggro needs damage and failed progress; path search or a logic wait alone never claims a blocker',()=>{
 const observe=createTransitBlockObserver();
 assert.equal(observe(c,route,plan,[attacker],1000),null);
 assert.equal(observe(c,route,plan,[attacker],9000),null);
 assert.equal(observe({...c,hp:2800,moving:false},route,plan,[attacker],10000),null);
 const block=observe({...c,hp:2800},route,plan,[attacker],11000);
 assert.equal(block.reason,'damaged-route-stall');
 assert.equal(observe({...c,hp:2800},null,plan,[attacker],12000).monster,attacker.id);
 assert.equal(observe({...c,hp:2700},null,plan,[attacker],17000).at,17000);
 assert.equal(observe({...c,hp:2600},null,plan,[attacker],22000).at,22000);
 assert.equal(observe(c,route,plan,[],12001),null);
 const moving=createTransitBlockObserver();
 moving(c,route,plan,[attacker],1000);
 assert.equal(moving({...c,x:100,hp:2800},route,plan,[attacker],9000),null);
});
test('only a fresh same-plan blocker with a live attacker targeting that farmer starts team defense',()=>{
 const observe=createTransitBlockObserver();
 const b=observe({...c,s:{stunned:{ms:500}}},route,plan,[attacker],10000);
 const peer={...c,realm,running:true,received:10000,travelBlock:b};
 assert.equal(verifiedTransitBlock(c,plan,[attacker],[peer],11000),attacker);
 for(const bad of [{...peer,realm:'EUI'},{...peer,received:1000},
  {...peer,travelBlock:{...b,plan:'other'}},{...peer,travelBlock:{...b,at:12000}}])
  assert.equal(verifiedTransitBlock(c,plan,[attacker],[bad],11000),null);
 assert.equal(verifiedTransitBlock(c,plan,[{...attacker,target:'Other'}],[peer],11000),null);
 assert.equal(roadAggroTravelDecision(c,route,plan,[attacker],['P'],true).continueRoute,false);
 assert.equal(roadAggroTravelDecision(c,route,plan,[attacker],['P']).continueRoute,true);
});
test('native movement flag cannot bypass physical team leash and portal separation has a deadline',()=>{
 const peer={...c,name:'R',x:-500,realm,running:true,received:10000,march:{plan:plan.id,realm,moving:true},threats:1};
 assert.equal(assessLiveSquadMarch(c,[peer],{realm,plan,now:10000}).reason,'teammate-behind');
 assert.equal(assessLiveSquadMarch(c,[{...peer,x:50}],{realm,plan,now:10000}).ready,true);
 assert.equal(assessLiveSquadMarch(c,[{...peer,x:700,march:{...peer.march,moving:false}}],{realm,plan,now:10000}).ready,true);
 const crossMapSince=new Map(),other={...peer,map:'tunnel',in:'tunnel'};
 assert.equal(assessLiveSquadMarch(c,[other],{realm,plan,now:10000,crossMapSince}).ready,true);
 assert.equal(assessLiveSquadMarch(c,[{...other,received:22000}],{realm,plan,now:22000,crossMapSince}).reason,'teammate-portal-checkpoint');
 assert.equal(assessLiveSquadMarch(c,[{...peer,x:50,received:22001}],{realm,plan,now:22001,crossMapSince}).ready,true);
});
test('a newly elected leader observes the old farmer rejection, but stale, foreign or changed definitions do not quarantine',()=>{
 const h={name:'Old',running:true,realm,received:10000,farmRejections:[{monster:'frog',definition:'v1',until:50000}]};
 assert.equal(sharedFarmRejection('frog',[h],realm,'v1',11000),true);
 assert.equal(sharedFarmRejection('frog',[h],realm,'v2',11000),false);
 assert.equal(sharedFarmRejection('frog',[h],'EUI','v1',11000),false);
 assert.equal(sharedFarmRejection('frog',[h],realm,'v1',15000),false);
 assert.equal(sharedFarmRejection('frog',[{...h,farmRejections:{}}],realm,'v1',11000),false);
});
test('leader catches up to a follower waiting one portal ahead instead of both waiting forever',()=>{
 const remote={...c,map:'tunnel',in:'tunnel',name:'R',running:true,realm,received:20000,
  march:{plan:plan.id,realm,moving:false}};
 const destination={...plan,map:'cave',in:'cave'};
 const result=assessLiveSquadMarch(c,[remote],{realm,plan:destination,now:20000,
  mapDistance:map=>({main:2,tunnel:1,cave:0})[map]??Infinity});
 assert.equal(result.ready,true);
});
test('NPC skill catalog cannot crowd out healing and trimmed heartbeat still proves sustainable healing',()=>{
 const now=Date.now(),G={skills:{...Object.fromEntries(Array.from({length:70},(_,i)=>['npc'+i,{}])),heal:{class:['priest'],mp:10,range:500}}};
 const priest={...c,level:80,frequency:1,attack:100,heal:100,range:500,items:[]};
 const cap=createCapabilities({p:{c:priest,G},cfg:{skills:[{skill:'heal',class:'auto',enabled:true,minMp:.2}],party:{}},skills:{ready:()=>true}}).snapshot();
 assert.deepEqual(cap.sustainable,['heal']);assert.deepEqual(cap.present,['heal']);
 const support=compactCombatSupport(priest,G,cap);
 const trimmed=fitHeartbeat({name:'P',combatSupport:support,capabilities:cap,stock:'x'.repeat(900),items:[],materials:[]},350);
 const remote={...priest,capabilities:trimmed.capabilities,combatSupport:trimmed.combatSupport,received:now};
 assert.equal(farmHealer([remote,{...priest,name:'R',ctype:'ranger'}],{G,healing:true,planned:true})?.name,'P');
 assert.equal(farmHealer([{...remote,received:now-20000},{...priest,name:'R',ctype:'ranger'}],{G,healing:true,planned:true}),null);
});
test('Merchant services do not spend massproduction mana on idle or market wait',()=>{
 let kind=null;const calls=[];
 const bot={running:true,me:{name:'M'},cfg:{production:{enabled:true},merchant:{massBuffs:true},general:{},world:{}},
  p:{read:()=>null,c:{name:'M',ctype:'merchant',level:80,mp:1000,max_mp:1000,s:{},items:[],slots:{}},
   G:{skills:{massproduction:{mp:20}},maps:{}},call:()=>false},
  economy:{},monsters:()=>[],movement:{order:null},production:{status:()=>({steps:kind?[{kind}]:[]})},
  exec:{run:id=>{calls.push(id);return true;}},strategy:{status:()=>({})}};
 const service=createServices(bot);
 assert.equal(service.tick(),false);kind='marketBuy';assert.equal(service.tick(),false);
 assert.equal(calls.length,0);kind='upgrade';assert.equal(service.tick(),false);
 assert.equal(service.productionBuff('marketBuy'),false);assert.equal(service.productionBuff('upgrade'),true);
 assert.deepEqual(calls,['service:massproduction']);
});
test('healthy Priest keeps shared road route despite remote support-range emergency',()=>{
 const movement={order:route,stop(){throw Error('healthy road route stopped');}};let healed=0;
 const bot={running:true,p:{c:{...c,items:[],slots:{}},G:{},realm:()=>realm,call:()=>false},
  cfg:{farming:{potions:false,hpBelow:.4,restBelow:.4,mpBelow:.2,resumeAbove:.8},party:{enabled:true}},
  me:{name:'P',role:'farmer'},leader:'R',farmers:['P','R'],teamNames:['P','R'],
  teamPlan:{heartbeat:()=>plan},transport:{fresh:()=>null},movement,
  monsters:()=>[{...attacker,target:'R'}],logistics:{},gold:{},
  combatAssessment:{emergency:()=>({active:true,critical:[],reason:'party-not-in-combat-support-range'})},
  skills:{rotation:()=>healed++},event:()=>{}};
 createFarmer(bot).tick();assert.equal(movement.order,route);assert.equal(healed,1);
});

test('accepted material work keeps the physical spawn while travelling despite same-monster reranking',()=>{
 const old=Date.now;let now=100000;Date.now=()=>now;
 try{const {bot,requests}=farmFixture();bot.p.G.maps.main.monsters.push({type:'bee',boundaries:[['main',3500,0,3700,100]]});
 requests.push({objective:'craft-work',item:'mat',monster:'bee',quantity:3,priority:10,expires:1000000});
 const team=createTeamPlan(bot);team.tick();const initial=team.heartbeat();assert.equal(initial.kind,'material');
 Object.assign(bot.p.c,{x:3600,y:0});now+=11000;bot.decisionEpoch++;team.tick();
 assert.equal(team.heartbeat().key,initial.key);assert.equal(team.heartbeat().objective,'craft-work');
 assert.equal(team.status().switchAdvice.reason,'committed-farm-trip');
 }finally{Date.now=old;}
});

test('failed committed travel is quarantined and replanned without recording a death',()=>{
 const {bot,events}=farmFixture(),team=createTeamPlan(bot);team.tick();const first=team.heartbeat();
 assert.ok(first);team.travelFailed(first,'no-certified-world-route');assert.equal(team.heartbeat(),null);
 bot.decisionEpoch++;team.tick();assert.ok(team.heartbeat());assert.notEqual(team.heartbeat().key,first.key);
 assert.ok(events.some(e=>e.type==='plan.travelFailed'&&e.data.death===false));
});
