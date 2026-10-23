import test from 'node:test';
import assert from 'node:assert/strict';
import {safeFocusCorrectionPoint} from '../src/combat/farmer.mjs';
import {leaderAssignedFarmTarget} from '../src/combat/team-readiness.mjs';
import {fitHeartbeat,compactFarmPlan,sharedMarchStatus} from '../src/party/transport.mjs';
import {createTeamPlan} from '../src/world/team-plan.mjs';
import {spawnLocations} from '../src/world/knowledge.mjs';

const now=Date.now();
const monsterMeta={hp:200,attack:10,frequency:1,range:30,respawn:1000};
const game={monsters:{armadillo:monsterMeta},maps:{main:{
  monsters:[{type:'armadillo',count:4,boundary:[50,50,150,150]}]}}};
const spawn=spawnLocations(game,['armadillo'])[0];
const plan={...spawn,id:'My_Ranger1:plan:3',kind:'farm',
  leader:'My_Ranger1',realm:'EUII',objective:null,
  expires:now+45000};
const monster={type:'monster',id:'1936333',mtype:'armadillo',hp:200,
  target:null,map:'main',in:'main',x:114,y:103};
const actor={name:'My_Priest',map:'main',in:'main',x:100,y:100,
  hp:1000,max_hp:1000,range:180};
const leader={name:'My_Ranger1',running:true,rip:false,realm:'EUII',
  received:now,map:'main',in:'main',x:109,y:103,
  target:monster.id,march:{plan:plan.id,anchor:compactFarmPlan(plan)}};

test('valid unengaged leader focus is provable with compact validated plan only',()=>{
 assert.equal(leaderAssignedFarmTarget(actor,leader,[monster],{
  plan:leader.march.anchor,realm:'EUII',
  teamNames:['My_Ranger1','My_Ranger2','My_Priest'],now
 })?.id,monster.id);
 for(const change of [
  {plan:{...plan,expires:now-1}},
  {plan:{...plan,id:'wrong'}},
  {leader:{...leader,received:now-6000}},
  {leader:{...leader,map:'bank'}},
  {monsters:[{...monster,target:'Foreign'}]},
  {monsters:[{...monster,mtype:'bee'}]}
 ]){
  const r=leaderAssignedFarmTarget(actor,change.leader??leader,
   change.monsters??[monster],{
    plan:change.plan??leader.march.anchor,realm:'EUII',
    teamNames:['My_Ranger1','My_Ranger2','My_Priest'],now
   });
  assert.equal(r,null,'unverified leader focus must fail closed');
 }
});
test('tiny line-of-fire correction never walks toward another active enemy',()=>{
 const can=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&
  x>=-200&&x<=200&&y>=-200&&y<=200;
 const point=safeFocusCorrectionPoint(actor,monster,[],can);
 assert.ok(point&&Math.hypot(point.x-actor.x,point.y-actor.y)<=35);
 assert.equal(safeFocusCorrectionPoint({...actor,hp:500},monster,[],can),null);
 assert.equal(safeFocusCorrectionPoint(actor,{...monster,x:NaN},[],can),null);
 assert.equal(safeFocusCorrectionPoint(actor,monster,[],()=>false),null);
 const a=safeFocusCorrectionPoint(actor,monster,[
  {id:'hostile1',hp:100,target:'My_Ranger1',map:'main',in:'main',
   x:75,y:130,range:80},
  {id:'hostile2',hp:100,target:'My_Ranger2',map:'main',in:'main',
   x:130,y:75,range:80}
 ],can);
 assert.equal(a,null,'do not sidestep into already engaged threats');
});
test('compact ordinary farm anchor survives full farmPlan shedding even outside a quest',()=>{
 const march=sharedMarchStatus(plan,null,'EUII');
 march.anchor=compactFarmPlan(plan);
 let fitting=null;
 for(let n=3000;n<4200;n+=20){
  const d=fitHeartbeat({name:'My_Ranger1',items:[],materials:[],
   bankOwner:{proof:'b'.repeat(n)},march,farmPlan:compactFarmPlan(plan)});
  if(d&&!d.farmPlan){fitting=d;break;}
 }
 assert.ok(fitting,'optional full plan must shed before retained compact march');
 assert.equal(fitting.march.anchor.id,plan.id);
});
test('real follower plan tick adopts verified leader march anchor and rejects stale successor',()=>{
 const events=[],c={name:'My_Priest',map:'main',in:'main',
  x:100,y:100,hp:1000,max_hp:1000,mp:700,max_mp:700};
 const leaderPeer={...leader,hp:1000,max_hp:1000,mp:500,max_mp:500,
  farmPlan:null};
 const bot={me:{name:c.name,group:'squad',role:'farmer',
  farmTargets:['armadillo']},leader:'My_Ranger1',
  running:true,farmers:['My_Ranger1','My_Ranger2','My_Priest'],
  teamNames:['My_Ranger1','My_Ranger2','My_Priest'],
  cfg:{general:{testLogging:true,messageTtlMs:10000},
   party:{enabled:true,merchant:'My_Merchant'},
   world:{quests:false,questTargets:false,excludedMaps:[]},
   farming:{autoTargets:false,targets:['armadillo'],pvp:false}},
  p:{c,realm:()=> 'EUII',G:game,parent:{},root:{S:{}},
   read:()=>null,write:()=>true},
  transport:{fresh:n=>n==='My_Ranger1'?leaderPeer:null},
  strategy:{permittedMap:()=>true,safeTarget:()=>true},
  movement:{order:null,stop(){}},
  content:{approve:()=>true},event:(type,data)=>events.push({type,data}),
  monsters:()=>[],production:{materials:()=>[]},
  decisionEpoch:1};
 bot.teamPlan=createTeamPlan(bot);
 bot.teamPlan.tick();
 assert.equal(bot.teamPlan.heartbeat()?.id,plan.id,
  'follower must adopt locally validated compact plan without full farmPlan');
 assert.ok(events.some(x=>x.type==='plan.adopt'));
 leaderPeer.march.anchor={...plan,expires:Date.now()-2};
 leaderPeer.march.plan='changed';
 bot.decisionEpoch++;
 bot.teamPlan.tick();
 assert.equal(bot.teamPlan.heartbeat(),null,
  'stale, changed leader plans never permit new neutral pulls');
});
