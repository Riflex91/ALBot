import test from 'node:test';
import assert from 'node:assert/strict';
import {idleStaffBankRule} from '../src/merchant/idle-staff-stock.mjs';
import {boundedSinglePullAggro,effectiveFarmAggro} from '../src/world/strategy.mjs';
import {createTeamPlan} from '../src/world/team-plan.mjs';
import {estimateThreatCapability} from '../src/combat/threat-capability.mjs';

const staff={name:'staff',level:4};
const surplus=extra=>idleStaffBankRule({
 item:staff,equipped:{name:'staff',level:5},gearUse:{state:'no-gear-use'},
 inventoryRule:null,productionRule:null,reserved:0,activeGoal:null,...extra
});
test('verified carried merchant staff +4 is banked only after +5 replaces it',()=>{
 assert.equal(surplus()?.action,'bank');
 assert.equal(surplus()?.batch,1);
 for(const state of [
  {equipped:{name:'staff',level:4}},{equipped:null},
  {gearUse:{state:'unknown'}},{gearUse:{state:'gear-useful'}},
  {reserved:1},{reserved:undefined},
  {inventoryRule:{action:'keep'}},{productionRule:{action:'upgrade'}},
  {activeGoal:{item:'staff'}},{item:{name:'staff',level:4,l:true}},
  {item:{name:'staff',level:4,stat_type:'str'}},
  {item:{name:'staff',level:6}}
 ])assert.equal(surplus(state),null,JSON.stringify(state));
});

test('single-target risk budgets current live aggro, not theoretical 5 AoE slots',()=>{
 assert.equal(effectiveFarmAggro(12,5,0),5,'legacy multi-target ceiling remains available');
 assert.equal(boundedSinglePullAggro(12,0),2);
 assert.equal(boundedSinglePullAggro(12,1),2);
 assert.equal(boundedSinglePullAggro(12,4),4,'four observed hostile targets must all count');
 assert.equal(boundedSinglePullAggro(1,0),1);
 assert.equal(boundedSinglePullAggro(12,-1),12,'malformed evidence fails closed');
});

function huntFixture(monster='greenjr'){
 const events=[],saved=new Map(),G={monsters:{
  greenjr:{hp:100,attack:1,frequency:1,xp:50,respawn:1,boss:true},
  bee:{hp:20,attack:1,frequency:1,xp:5,respawn:1}
 },maps:{main:{monsters:[
  {type:'greenjr',count:1,boundaries:[['main',0,0,120,120]]},
  {type:'bee',count:2,boundaries:[['main',200,0,320,120]]}
 ]}}};
 const c={name:'Leader',ctype:'ranger',map:'main',in:'main',
  x:0,y:0,attack:100,frequency:1,hp:1000,max_hp:1000,
  mp:1000,max_mp:1000,items:[],slots:{},xp:0,gold:0,
  s:{monsterhunt:{id:monster,c:1,ms:900000}}};
 const bot={p:{c,G,root:{S:{}},parent:{S:{}},realm:()=> 'EUII',
   read:k=>saved.get(k)??null,write:(k,v)=>{saved.set(k,v);return true;},entities:{}},
  cfg:{general:{testLogging:true,messageTtlMs:10000},
   farming:{pvp:false,maxAggro:1,planHoldMs:60000},
   world:{excludedMaps:[],cacheTtlMs:10000,quests:true,questTargets:true},
   party:{enabled:true,aoe:false}},
  me:{name:'Leader',group:'team',role:'farmer',farmTargets:[]},
  leader:'Leader',farmers:['Leader'],teamNames:['Leader'],
  transport:{fresh:()=>null},
  strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},
  decisionEpoch:1,monsters:()=>[],event:(name,data)=>events.push({name,data}),
  movement:{order:null,stop(){}},gear:{snapshot:()=>({})},
  content:{approve:()=>true},progression:{bonus:()=>0}};
 return {bot,events};
}
test('active server-verified monsterhunt may select boss excluded from ordinary farm candidates',()=>{
 const f=huntFixture(),plan=createTeamPlan(f.bot);
 assert.equal(plan.candidates().includes('greenjr'),false);
 plan.tick();
 assert.equal(plan.status().hunt?.monster,'greenjr');
 assert.equal(plan.heartbeat()?.target,'greenjr');
 assert.equal(plan.heartbeat()?.kind,'hunt');
});
test('a monsterhunt still cannot override the independently required safety gate',()=>{
 const f=huntFixture(),plan=createTeamPlan(f.bot);
 f.bot.strategy.safeTarget=id=>id!=='greenjr';
 plan.tick();
 assert.notEqual(plan.heartbeat()?.target,'greenjr');
 assert.ok(f.events.some(x=>x.name==='hunt.noApprovedSpawn'));
 const diagnostic=f.events.find(x=>x.name==='hunt.noApprovedSpawn')?.data?.diagnostics;
 assert.equal(typeof diagnostic,'string');
 assert.equal(JSON.parse(diagnostic).allowedMonster,false);
});

const now=Date.now();
const base={map:'main',in:'main',running:true,rip:false,
 hp:2500,max_hp:2500,mp:1500,max_mp:1500,threats:0,received:now-100,
 stats:{attack:330,frequency:1,armor:200,resistance:100,
  range:250,heal:0,damage_type:'physical'}};
const a={...base,name:'R1',class:'ranger',x:0,y:0};
const b={...base,name:'R2',class:'ranger',x:10,y:0};
const mob={id:'a',type:'monster',mtype:'weak',map:'main',in:'main',x:10,y:10,
 target:'R1',hp:50,max_hp:50};
const meta={aggro:1,hp:50,attack:2,frequency:.4,damage_type:'physical',armor:0,resistance:0};
test('fully observed secondary monster is counted even before peer heartbeat threats increments',()=>{
 const second={id:'b',type:'monster',mtype:'weak',map:'main',in:'main',
  x:15,y:10,target:'R2',hp:50,max_hp:50,meta};
 const result=estimateThreatCapability({monster:mob,meta,team:[a,b],
  otherMonsters:[second],now});
 assert.equal(result.viable,true,JSON.stringify(result));
 assert.equal(result.secondaryAggro,1);
 const stale={...b,threats:2};
 const denied=estimateThreatCapability({monster:mob,meta,team:[a,stale],
  otherMonsters:[second],now});
 assert.equal(denied.viable,false,'reported but absent threats still block');
 const missingMeta=estimateThreatCapability({monster:mob,meta,team:[a,b],
  otherMonsters:[{...second,meta:null}],now});
 assert.equal(missingMeta.viable,false,'unknown species data must remain fail closed');
});
