import test from 'node:test';
import assert from 'node:assert/strict';
import {farmTransitAdmission,mapGraph} from '../src/world/knowledge.mjs';
import {createTeamPlan} from '../src/world/team-plan.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';

const map=(monsters=[],doors=[])=>({monsters,doors});
const hostileFixture=()=>({
 monsters:{
  bee:{hp:100,attack:25,frequency:1,xp:25,respawn:1},
  cgoo:{hp:150,attack:25,frequency:1,xp:2000,respawn:1},
  prat:{hp:1000,attack:400,frequency:2,xp:100,respawn:1,aggro:1}
 },
 maps:{
  main:map([{type:'bee',count:2,boundaries:[['main',100,0,160,60]]}],
   [[0,0,0,0,'level1',0]]),
  level1:map([{type:'prat',count:2,boundaries:[['level1',-100,600,-20,700]]}],
   [[0,0,0,0,'level2s',0],[0,0,0,0,'main',0]]),
  level2s:map([{type:'cgoo',count:2,boundaries:[['level2s',10,10,60,60]]}],
   [[0,0,0,0,'level1',0]])
 }
});

test('17:32 UTC prat corridor is never an approved autonomous farm passage',()=>{
 const G=hostileFixture(),graph=mapGraph(G);
 assert.deepEqual(farmTransitAdmission(G,graph,'main','main'),
  {allowed:true,reason:'same-map'});
 const result=farmTransitAdmission(G,graph,'main','level2s');
 assert.equal(result.allowed,false);
 assert.equal(result.hazard,'level1');
 assert.equal(result.reason,'no-verified-nonaggressive-portal-route');
});

test('known safe direct portal can be approved without accepting a dangerous parallel shortest route',()=>{
 const G=hostileFixture();
 G.maps.main.doors.push([0,0,0,0,'level2s',0]);
 assert.equal(farmTransitAdmission(G,mapGraph(G),'main','level2s').allowed,true);
 G.maps.main.doors.pop();
 G.maps.main.doors.push([0,0,0,0,'safe',0]);
 G.maps.safe=map([],[[0,0,0,0,'level2s',0]]);
 const result=farmTransitAdmission(G,mapGraph(G),'main','level2s');
 assert.equal(result.allowed,false,'equally short dangerous route must not be trusted to native navigator');
 assert.equal(result.reason,'shortest-route-may-enter-hostile-map');
});

test('unknown intermediate species, missing maps and excluded transit maps fail closed',()=>{
 const G=hostileFixture();
 G.maps.level1.monsters=[{type:'unknown'}];
 assert.equal(farmTransitAdmission(G,mapGraph(G),'main','level2s').allowed,false);
 G.maps.level1.monsters=[];
 assert.equal(farmTransitAdmission(G,mapGraph(G),'main','level2s',['level1']).allowed,false);
 assert.equal(farmTransitAdmission(G,mapGraph(G),'not-real','main').allowed,false);
});

test('team plan ranks the safe mainland bee rather than crossing a lethal prat corridor for cgoo',()=>{
 const G=hostileFixture(),events=[];
 const c={name:'Leader',ctype:'ranger',map:'main',in:'main',x:0,y:0,
  hp:1200,max_hp:1200,mp:200,max_mp:200,attack:100,frequency:1,
  level:40,speed:55,items:[],slots:{},xp:0,gold:0};
 const bot={
  p:{c,G,root:{S:{}},parent:{S:{}},read:()=>null,realm:()=> 'EUII',entities:{}},
  cfg:{general:{testLogging:true,messageTtlMs:10000},farming:{pvp:false,
   mode:'balanced',maxAggro:1,planHoldMs:300000,deathWindowMs:600000},
   world:{excludedMaps:[],cacheTtlMs:60000},party:{enabled:true}},
  me:{name:'Leader',role:'farmer',farmTargets:[]},leader:'Leader',
  farmers:['Leader'],teamNames:['Leader'],transport:{fresh:()=>null},
  strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},
  monsters:()=>[],event:(...e)=>events.push(e),decisionEpoch:1,
  movement:{order:null,stop(){}},gear:{snapshot:()=>({})},
  content:{approve:()=>true},progression:{bonus:()=>0}
 };
 const manager=createTeamPlan(bot);manager.tick();
 assert.equal(manager.heartbeat()?.target,'bee');
 assert.equal(manager.status().ranking.some(r=>r.target==='cgoo'),false);
 assert.ok(events.some(([name,p])=>name==='farm.transitRejected'&&p.hazard==='level1'));
});

test('a death before farm arrival halts instead of repeatedly auto-respawning',()=>{
 const c={name:'My_Ranger2',ctype:'ranger',map:'level1',in:'level1',
  x:-230,y:600,hp:0,max_hp:1000,mp:0,max_mp:1000,rip:true,items:[]};
 const orders=[],events=[];
 const destination={id:'plan:12',key:'main:bee',map:'main',in:'main',x:546,y:1059};
 const bot={
  p:{c,G:{monsters:{},maps:{}},realm:()=> 'EUII'},
  cfg:{farming:{respawn:true,respawnDelayMs:0,deathWindowMs:600000,maxDeaths:5},
   party:{enabled:true}},
  me:{name:c.name,role:'farmer'},
  teamPlan:{heartbeat:()=>destination},
  strategy:{failActivity:()=>orders.push('failed')},
  movement:{order:{owner:'farm',dest:destination},stop:()=>orders.push('stop')},
  logistics:{handoffActive:false},gold:{reserved:false},journal:null,
  monsters:()=>[],exec:{run:()=>orders.push('respawn')},
  event:(...args)=>events.push(args),
  pause:why=>orders.push(['paused',why])
 };
 createFarmer(bot).tick();
 assert.equal(orders.some(x=>x==='respawn'),false);
 assert.ok(orders.some(x=>Array.isArray(x)&&x[0]==='paused'));
 assert.ok(events.some(([type])=>type==='combat.fatalFarmTransitStop'));
});
