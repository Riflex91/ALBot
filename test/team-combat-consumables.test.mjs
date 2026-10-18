import test from 'node:test';
import assert from 'node:assert/strict';
import {compactCombatSupport,fitHeartbeat} from '../src/party/transport.mjs';
import {estimateThreatCapability} from '../src/combat/threat-capability.mjs';

const now=180000;
const base={map:'halloween',in:'halloween',running:true,rip:false,
 hp:2600,max_hp:3000,mp:1500,max_mp:1800,threats:0,received:now-400};
const ranger=(name,x)=>({...base,name,class:'ranger',x,y:-530,
 stats:{attack:280,frequency:1.6,armor:100,resistance:80,
  range:240,heal:0,mp_cost:20,damage_type:'physical'}});
const priest=()=>({...base,name:'My_Priest',class:'priest',ctype:'priest',
 level:50,x:-480,y:-530,
 stats:{attack:160,frequency:.8,armor:100,resistance:80,range:180,
  heal:450,mp_cost:20,damage_type:'magical'},
 range:180,mp_cost:20,heal:450,
 items:[{name:'hpot0',q:30},{name:'mpot0',q:40}]});
const G={skills:{heal:{class:['priest'],level:1,mp:20,range:180}},
 items:{hpot0:{gives:[['hp',400]]},mpot0:{gives:[['mp',500]]}}};
const monster=(hp=1000)=>({id:'greenjr-1',type:'monster',
 mtype:'greenjr',map:'halloween',in:'halloween',x:-500,y:-550,
 target:'My_Priest',hp,max_hp:hp});
const meta={aggro:1,hp:1000,attack:35,frequency:1,
 damage_type:'physical',range:70,armor:0,resistance:0};
const members=()=>[ranger('My_Ranger1',-520),ranger('My_Ranger2',-490),priest()];
function estimate(t=members(),m=monster(),data={}){
 return estimateThreatCapability({monster:m,team:t,meta,now,...data});
}

test('trimmed team heartbeat retains verified compact Priest healing',()=>{
 const p=priest(),support=compactCombatSupport(p,G,{ready:['heal']},true);
 assert.equal(support.healReady,true);
 assert.equal(support.healMpCost,20);
 assert.equal(support.hpPotion.restore,400);
 const payload=fitHeartbeat({
  name:'My_Priest',items:[],materials:[],
  combatSupport:support,skills:['heal'],capabilities:{ready:['heal']},
  stock:Array.from({length:250},(_,i)=>'x'.repeat(75)+i)
 },380);
 assert.ok(payload,'core payload must fit');
 // Capability lists are optional and can be discarded independently by
 // the 5KB transport trimmer without invalidating this compact evidence.
 const stripped={...payload};delete stripped.capabilities;delete stripped.skills;
 assert.equal(payload.combatSupport.healReady,true);
 const t=members();t[2]={...t[2],combatSupport:stripped.combatSupport,
  capabilities:undefined,skills:undefined};
 const result=estimate(t);
 assert.equal(result.healer,'My_Priest');
 assert.ok(result.healingDps>0);
 assert.ok(result.potionHp>0);
});

test('unproven cooldown, unknown potion value or missing readiness grant no credit',()=>{
 const p=priest(),yes=compactCombatSupport(p,G,{ready:['heal']},true);
 const no=compactCombatSupport(p,G,{ready:[]},false);
 assert.equal(no.healReady,false);
 const t=members();
 t[2]={...t[2],combatSupport:yes};
 const baseline=estimate(t);
 assert.ok(baseline.healingDps>0);
 assert.ok(baseline.potionHp>0);
 t[2]={...t[2],combatSupport:no};
 const denied=estimate(t);
 assert.equal(denied.healer,null);
 assert.equal(denied.healingDps,0);
 assert.equal(denied.potionHp,0);
 const unknown=compactCombatSupport(p,{skills:G.skills,items:{}},{ready:[]},true);
 assert.equal(unknown.hpPotion.restore,0);
 t[2]={...t[2],combatSupport:unknown};
 assert.equal(estimate(t).potionHp,0);
});

test('one verified health potion is bounded and extends modeled survival',()=>{
 const support=compactCombatSupport(priest(),G,{ready:[]},true);
 const t=members();t[2]={...t[2],combatSupport:support};
 const added=estimate(t);
 assert.ok(added.potionHp>0);
 assert.ok(added.potionHp<=400*.65);
 const without=estimate(t.map(row=>row.name==='My_Priest'?
  {...row,combatSupport:{...support,potionReady:false}}:row));
 assert.equal(without.potionHp,0);
 assert.ok(added.survivalSeconds>without.survivalSeconds);
});

test('verified long-window Ranger damage may add at most 20%, not an instant burst',()=>{
 const m=monster(5000);
 const t=members();
 const baseline=estimate(t,m);
 const burst=estimate(t,m,{observed:[{at:now-100,monsterId:m.id,
  kind:'outgoing',damage:20000}]});
 assert.equal(burst.teamDps,baseline.teamDps);
 const observed=Array.from({length:7},(_,i)=>({at:now-6000+i*900,
  monsterId:m.id,kind:'outgoing',damage:3000}));
 const repeated=estimate(t,m,{observed});
 assert.equal(repeated.observedSkillDamage,true);
 assert.ok(repeated.teamDps>baseline.teamDps);
 assert.ok(repeated.teamDps<=baseline.teamDps*1.21);
 assert.equal(repeated.measuredFight,false,'without heal events the old margin stays');
});

test('stale healer and unavailable potion cannot approve a fight',()=>{
 const t=members();t[2]={...t[2],
  combatSupport:compactCombatSupport(priest(),G,{ready:['heal']},true),
  received:now-5000};
 const r=estimate(t);
 assert.equal(r.viable,false);
 assert.equal(r.reason,'party-member-stale-or-unverified');
});

test('high-frequency Green Jr remains unsafe without real sustained heal evidence',()=>{
 const t=members();t[2]={...t[2],
  combatSupport:compactCombatSupport(priest(),G,{ready:['heal']},true)};
 const m=monster(4200),risk={...meta,hp:4200,attack:30,frequency:20,
  resistance:400};
 const result=estimateThreatCapability({monster:m,team:t,meta:risk,now});
 assert.equal(result.viable,false,'do not blindly approve lethal greenjr');
 assert.ok(result.healingDps>0,'Priest can be recognized, without granting impossible victory');
 assert.ok(result.potionHp>0);
});

test('safe Ranger regrouping approaches a threatened Priest without entering monster radius',async()=>{
 const {safeEmergencyRallyPoint}=await import('../src/combat/farmer.mjs');
 const enemy={map:'halloween',in:'halloween',x:0,y:0};
 const ranger={map:'halloween',in:'halloween',x:580,y:0};
 const threatened={map:'halloween',in:'halloween',x:180,y:0};
 const rally=safeEmergencyRallyPoint(ranger,threatened,enemy,80);
 assert.ok(rally);
 assert.ok(rally.x>=170,'destination remains outside 80-range monster');
 assert.equal(rally.y,0);
 assert.equal(safeEmergencyRallyPoint({...ranger,x:-580},threatened,enemy,80),null,
  'cannot path across a monster to rescue');
 assert.equal(safeEmergencyRallyPoint(ranger,{...threatened,map:'main'},enemy,80),null,
  'never rally across maps');
 assert.equal(safeEmergencyRallyPoint({...ranger,x:220},threatened,enemy,80),null,
  'nearby Ranger should not spam moves');
});
