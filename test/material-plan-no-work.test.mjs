import test from 'node:test';
import assert from 'node:assert/strict';
import {materialQuotaCap,materialRequestHasWork}
 from '../src/production/material-quotas.mjs';
import {createTeamPlan} from '../src/world/team-plan.mjs';

const request={objective:'goal:gem0',item:'gem0',monster:'goo',
 quantity:10,remaining:5,expires:Date.now()+600000,
 priority:50,utilityPerHour:100000};

test('empty explicit material quotas pause a pending goal rather than authorizing FarmPlan',()=>{
 assert.equal(materialRequestHasWork({...request,quotas:[]},['Ranger1']),false);
 assert.equal(materialRequestHasWork({...request,quotas:[
  {name:'Ranger1',quantity:0}]},['Ranger1']),false);
});
test('positive assignment to a different selected Farmer can keep shared material plan active',()=>{
 const row={...request,quotas:[{name:'Ranger2',quantity:5}]};
 assert.equal(materialRequestHasWork(row,['Ranger1','Ranger2']),true);
 assert.equal(materialRequestHasWork(row,['Ranger1']),false);
 assert.equal(materialQuotaCap(row,'Ranger1'),0);
});
test('completed, missing or malformed quota metadata cannot hijack farm selection',()=>{
 assert.equal(materialRequestHasWork({...request,remaining:0,
  quotas:[{name:'Ranger1',quantity:10}]},['Ranger1']),false);
 for(const quotas of [null,'not-verified',{name:'Ranger1'},[null],
   [{name:'Ranger1',quantity:-1}]]){
  const row={...request,quotas};
  assert.equal(materialRequestHasWork(row,['Ranger1']),false);
  assert.equal(materialQuotaCap(row,'Ranger1'),0);
 }
 assert.equal(materialRequestHasWork({...request,remaining:'unknown'},['Ranger1']),false);
 assert.equal(materialQuotaCap({...request,remaining:'unknown'},'Ranger1'),0);
});
test('legacy material requests without quota field remain usable until completed',()=>{
 const legacy={...request};
 assert.equal(materialRequestHasWork(legacy,['Ranger1']),true);
 assert.equal(materialQuotaCap(legacy,'Ranger1'),10);
 assert.equal(materialRequestHasWork({...legacy,remaining:0},['Ranger1']),false);
});
function plannerFixture(quotas){
 const c={name:'Ranger1',ctype:'ranger',level:80,map:'main',in:'main',x:0,y:0,
  attack:100,frequency:1,damage_type:'physical',hp:1500,max_hp:1500,
  mp:1000,max_mp:1000,range:100,speed:40,xp:0,gold:0};
 const G={monsters:{
  goo:{hp:90,xp:15,attack:1,frequency:1,respawn:2000},
  bee:{hp:30,xp:25,attack:1,frequency:1,respawn:2000}
 },maps:{main:{monsters:[
   {type:'goo',boundary:[100,100,120,120],count:4},
   {type:'bee',boundary:[-100,-100,-80,-80],count:4}
 ]}}};
 let merchant={running:true,realm:'EUII',materials:[{...request,quotas}]};
 const bot={
  p:{c,G,root:{S:{}},parent:{S:{}},entities:{},realm:()=> 'EUII',
   read:()=>({}),write:()=>true},
  me:{name:'Ranger1',role:'farmer',farmTargets:[]},
  cfg:{
   general:{testLogging:true,messageTtlMs:10000},
   world:{cacheTtlMs:0,excludedMaps:[]},
   farming:{autoTargets:false,targets:['goo','bee'],mode:'xp',
    pvp:false,knowledgeFreshMs:21600000,planHoldMs:0,maxAggro:2,
    orbitRadius:220,deathWindowMs:600000},
   party:{enabled:false,merchant:'Merchant',leader:'Ranger1',
    followDistance:500,aoe:false,aoeMaxTargets:1},
   production:{materialPreference:1.25,materialXpPerGold:10}
  },
  farmers:['Ranger1'],teamNames:['Ranger1'],leader:'Ranger1',
  running:true,session:'fixture-session',journal:null,
  movement:{order:null,stop(){}},transport:{fresh:name=>
    name==='Merchant'?merchant:null},
  strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},
  monsters:()=>[],event:()=>{},gold:{reserved:false},
  logistics:{reserved:false}
 };
 bot.teamPlan=createTeamPlan(bot);
 return {...bot,setMerchant:value=>{merchant=value;}};
}
test('real TeamPlan ignores a non-actionable material order when Merchant has no quotas',()=>{
 const bot=plannerFixture([]);
 bot.teamPlan.tick();
 const current=bot.teamPlan.heartbeat();
 assert.ok(current,'regular XP farming should remain possible');
 assert.equal(current.kind,'farm');
 assert.equal(current.objective,null);
});
test('real TeamPlan starts a material objective only for a verified assigned share',()=>{
 const bot=plannerFixture([{name:'Ranger1',quantity:5}]);
 bot.teamPlan.tick();
 const current=bot.teamPlan.heartbeat();
 assert.ok(current);
 assert.equal(current.kind,'material');
 assert.equal(current.objective,request.objective);
});
test('an in-flight material plan pauses new pulls without abandoning its objective when quotas disappear',()=>{
 const bot=plannerFixture([{name:'Ranger1',quantity:5}]);
 bot.teamPlan.tick();
 assert.equal(bot.teamPlan.heartbeat()?.kind,'material');
 bot.setMerchant({running:true,realm:'EUII',materials:[{...request,quotas:[]}]});
 bot.teamPlan.tick();
 assert.equal(bot.teamPlan.heartbeat()?.kind,'material');
 assert.equal(bot.teamPlan.heartbeat()?.objective,request.objective);
 assert.equal(bot.teamPlan.wantsCombat(),false);
});
