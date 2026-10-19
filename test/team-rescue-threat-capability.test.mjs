import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateThreatCapability,createCombatAssessment} from '../src/combat/threat-capability.mjs';

const now=180000;
const base={map:'halloween',in:'halloween',running:true,rip:false,
 hp:3914,max_hp:3914,mp:2400,max_mp:2400,threats:0,received:now-400,
 stats:{attack:420,frequency:2,armor:120,resistance:80,range:300,
  heal:0,mp_cost:10,damage_type:'physical'}};
const ranger=(name,x,y)=>({...base,name,class:'ranger',x,y,
 stats:{...base.stats},skills:[],capabilities:{ready:['3shot']}});
const priest=(x,y)=>({...base,name:'My_Priest',class:'priest',
 x,y,hp:2500,max_hp:2500,mp:1500,max_mp:1500,
 stats:{...base.stats,attack:190,frequency:.7,armor:90,
  heal:620,mp_cost:15,range:160,damage_type:'magical'},
 skills:['heal','partyheal'],capabilities:{ready:['heal','partyheal']}});
const monster=(mtype='greenjr',hp=4200)=>({
 id:'6058451',type:'monster',mtype,map:'halloween',in:'halloween',
 x:-500,y:-550,target:'My_Ranger1',hp,max_hp:hp});
const aggressive={aggro:1,hp:4200,attack:30,frequency:20,
 damage_type:'physical',range:80,speed:60,armor:0,resistance:400};
const team=(x=-470,y=-540)=>[
 ranger('My_Ranger1',-500,-520),
 ranger('My_Ranger2',-470,-530),
 priest(x,y)];
const estimate=(m=monster(),t=team(),meta=aggressive,extra={})=>
 estimateThreatCapability({monster:m,team:t,meta,now,...extra});

test('Green Jr. high-frequency aggro with normal three-person setup is not optimistically declared killable',()=>{
 const row=estimate();
 assert.equal(row.viable,false,row.reason);
 assert.equal(row.decision,'retreat');
 assert.ok(row.incomingDps>row.healingDps);
 assert.equal(row.tank.diversionCredited,false);
 assert.equal(row.skills.defensiveBuffCredit,0);
});

test('same three-person team may defensively fight verified weak already-engaged attacker',()=>{
 const m=monster('easyaggro',300);
 const a={...aggressive,hp:300,attack:15,frequency:.4,resistance:0};
 const r=estimate(m,team(),a);
 assert.equal(r.viable,true,JSON.stringify(r));
 assert.equal(r.decision,'defend');
 assert.ok(r.ttkSeconds<r.survivalSeconds);
});

test('distant healer cannot lend fictional survival to high-frequency aggro',()=>{
 const r=estimate(monster(),team(-160,-400));
 assert.equal(r.viable,false);
 assert.equal(r.healingDps,0);
 assert.equal(r.healerReachable,false);
 assert.ok(r.unavailableMembers.includes('My_Priest'));
});

test('stale healer, missing owner, anonymous aggro and unknown damage fail closed',()=>{
 assert.equal(estimate(monster(),[team()[0],team()[1],null]).viable,false);
 assert.equal(estimate(monster(),team().map((x,i)=>i===2?{...x,received:now-5000}:x)).viable,false);
 assert.equal(estimate({...monster(),target:null}).viable,false);
 assert.equal(estimate(monster(),team(),{...aggressive,frequency:undefined}).viable,false);
});

test('offline provisional Mage is ignored without vetoing verified local rat defense',()=>{
 const row=estimate(monster('easyaggro',300),
  [null,...team()],{...aggressive,hp:300,attack:15,frequency:.4,resistance:0});
 assert.equal(row.viable,true,JSON.stringify(row));
 assert.equal(row.decision,'defend');
 assert.deepEqual(row.unavailableMembers,[null]);
 assert.equal(row.partySize,3);
});
test('absent or remote support never earns DPS, healing or potion credit',()=>{
 const m=monster('easyaggro',300);
 const meta={...aggressive,hp:300,attack:15,frequency:.4,resistance:0};
 const complete=estimate(m,team(),meta);
 const distant=team();
 distant[1]={...distant[1],x:1000,y:1000};
 distant[2]={...distant[2],map:'main',in:'main'};
 const local=estimate(m,distant,meta);
 assert.equal(local.decision,'defend',JSON.stringify(local));
 assert.equal(local.healingDps,0);
 assert.equal(local.healerReachable,false);
 assert.deepEqual(local.unavailableMembers,['My_Ranger2','My_Priest']);
 assert.ok(local.teamDps<complete.teamDps);
 assert.deepEqual(local.localMembers,['My_Ranger1']);
});
test('unreachable victim is not authorized to attack merely because their stats exist',()=>{
 const m=monster('easyaggro',300);
 const distant=team().map((x,i)=>i===0?{...x,x:3000,y:3000}:{
  ...x,map:'main',in:'main'});
 const row=estimate(m,distant,
  {...aggressive,hp:300,attack:15,frequency:.4,resistance:0});
 assert.equal(row.decision,'regroup');
 assert.equal(row.viable,false);
 assert.equal(row.reason,'no-local-attacker');
});

test('projected buffs, taunt and priest partyheal never become fictitious extra DPS or HP',()=>{
 const t=team();
 t[1].class='warrior';
 t[1].capabilities.ready=['taunt','hardshell'];
 t[2].capabilities.ready=['partyheal'];
 const row=estimate(monster('easyaggro',300),t,
  {...aggressive,hp:300,attack:15,frequency:.4,resistance:0});
 assert.equal(row.skills.heal,false);
 assert.equal(row.healingDps,0);
 assert.equal(row.skills.defensiveBuffCredit,0);
 assert.equal(row.tank.diversionCredited,false);
});

test('actual high incoming damage reduces safety estimate, never grants additional survivability',()=>{
 const a={...aggressive,hp:2500,attack:25,frequency:1,resistance:0};
 const m=monster('aggro',2500),t=team();
 const baseRow=estimate(m,t,a);
 const hits=Array.from({length:5},(_,i)=>({at:now-5000+i*1000,
  monsterId:m.id,kind:'incoming',victim:'My_Ranger1',damage:400}));
 const observed=estimate(m,t,a,{observed:hits});
 assert.ok(observed.incomingDps>=baseRow.incomingDps);
 assert.ok(observed.survivalSeconds<=baseRow.survivalSeconds);
});

test('live assessment refuses to authorize unengaged roaming aggressive monsters',()=>{
 const m=monster();m.target=null;
 const row=estimate(m);
 assert.equal(row.viable,false);
 assert.equal(row.reason,'monster-data-unverified');
});

test('observed active curse reduces incoming pressure only conservatively',()=>{
 const victim=team();
 const m=monster('aggro',900);const meta={...aggressive,hp:900,attack:40,frequency:2,resistance:0};
 const baseline=estimate(m,victim,meta);
 const cursed=estimate({...m,s:{cursed:{ms:2000}}},victim,meta);
 assert.equal(cursed.skills.activeCurseObserved,true);
 assert.ok(cursed.incomingDps<baseline.incomingDps);
 assert.ok(cursed.incomingDps>baseline.incomingDps*.78,
  'no full reduction applied to uncertain future curse uptime');
});

test('live threat status responds only to already engaged natural aggression',()=>{
 const m=monster('easyaggro',250);const meta={...aggressive,hp:250,attack:10,
  frequency:.3,resistance:0};
 const own=ranger('My_Ranger1',-500,-520);own.ctype='ranger';Object.assign(own,own.stats);
 const peers=[ranger('My_Ranger2',-470,-530),priest(-470,-540)];
 const nowOrig=Date.now;
 const t=Date.now();
 const current={...m};
 const bot={me:{name:'My_Ranger1'},farmers:['My_Ranger1','My_Ranger2','My_Priest'],
  running:true,events:[],p:{c:own,G:{monsters:{easyaggro:meta}},
   realm:()=> 'USI'},transport:{fresh:n=>peers.find(p=>p.name===n)&&
    ({...peers.find(p=>p.name===n),received:t})},
  capabilities:{snapshot:()=>own.capabilities},
  monsters:()=>[current],
  event(name,data){this.events.push({name,data});}};
 const assessment=createCombatAssessment(bot);
 const emergency=assessment.emergency();
 assert.equal(emergency.active,true);
 assert.equal(emergency.monsters.length,1);
 assert.equal(assessment.canDefend(current),false,'no unverified preapproval');
 const estimated=assessment.assess(current);
 assert.equal(estimated.viable,true,JSON.stringify(estimated));
 assert.equal(assessment.canDefend(current),true);
 assessment.hit({actor:'My_Ranger1',target:current.id,damage:90});
 assert.equal(assessment.status().hits,1,'numeric or text monster IDs both supported');
 current.target=null;
 assert.equal(assessment.emergency().monsters.length,0);
 assert.equal(assessment.canDefend(current),false,'no defensive permission for neutral');
 assessment.close();
});

test('fully observed weak secondary aggro may be defended but missing attacker still fails closed',()=>{
 const m=monster('easyaggro',150),meta={...aggressive,hp:150,attack:5,frequency:.3,resistance:0};
 const peers=team().map(x=>({...x,stats:{...x.stats}}));
 peers[1].threats=1;
 const blocked=estimate(m,peers,meta);
 assert.equal(blocked.viable,false);
 assert.equal(blocked.reason,'other-team-aggro-unmodelled');
 const second={id:'other-223',type:'monster',mtype:'easyaggro',
  map:'halloween',in:'halloween',x:-480,y:-540,target:'My_Ranger2',
  hp:100,max_hp:150,meta};
 const accepted=estimate(m,peers,meta,{otherMonsters:[second]});
 assert.equal(accepted.viable,true,JSON.stringify(accepted));
 assert.equal(accepted.secondaryAggro,1);
 const unknown=estimate(m,peers,meta,{otherMonsters:[{...second,meta:null}]});
 assert.equal(unknown.viable,false);
 assert.equal(unknown.reason,'other-team-aggro-unverified');
});

test('rangers select the same weakest endangered teammate and lowest HP attacker',async()=>{
 const {chooseEmergencyFocus}=await import('../src/combat/farmer.mjs');
 const team=[{name:'R1',hp:900,max_hp:1000},{name:'R2',hp:800,max_hp:1000},
  {name:'P',hp:200,max_hp:1000}];
 const mobs=[
  {id:'r1',target:'R1',hp:10},
  {id:'p2',target:'P',hp:200},
  {id:'p1',target:'P',hp:100},
  {id:'outside',target:'Stranger',hp:5}
 ];
 assert.equal(chooseEmergencyFocus(mobs,team).id,'p1');
 assert.equal(chooseEmergencyFocus([...mobs].reverse(),team).id,'p1');
 assert.equal(chooseEmergencyFocus(mobs,[]),null);
});
