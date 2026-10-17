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

test('cannot assume a healer reaches a dying Ranger after 300 unit kite displacement',()=>{
 const r=estimate(monster(),team(-160,-400));
 assert.equal(r.viable,false);
 assert.ok(['party-not-in-combat-support-range',
   'healer-unable-to-reach-victim'].includes(r.reason),r.reason);
});

test('stale healer, missing owner, anonymous aggro and unknown damage fail closed',()=>{
 assert.equal(estimate(monster(),[team()[0],team()[1],null]).viable,false);
 assert.equal(estimate(monster(),team().map((x,i)=>i===2?{...x,received:now-5000}:x)).viable,false);
 assert.equal(estimate({...monster(),target:null}).viable,false);
 assert.equal(estimate(monster(),team(),{...aggressive,frequency:undefined}).viable,false);
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
