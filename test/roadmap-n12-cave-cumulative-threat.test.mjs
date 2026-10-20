import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {caveCumulativeThreatBudget}
 from '../src/world/cave-cumulative-threat.mjs';
import {caveDefensiveAttackPreflight,createCaveDefensiveCombat}
 from '../src/world/cave-defensive-combat.mjs';

const time=1770000000000,run='a'.repeat(24),
 other='b'.repeat(24),map=`zone_${run}_1`;
function fixture(){
 const calls=[],events=[],state={at:time,monsters:[],cooldown:false};
 const c={name:'R1',ctype:'ranger',map,in:map,cave:{run},
  rip:false,hp:120,max_hp:120,mp:100,max_mp:100,
  range:150,x:0,y:0,targets:0};
 const peers={
  R2:{name:'R2',class:'ranger',map,in:map,x:45,y:0,
   hp:120,max_hp:120,threats:1,realm:'EUI',running:true,received:time},
  P:{name:'P',class:'priest',map,in:map,x:35,y:10,
   hp:120,max_hp:120,threats:1,realm:'EUI',running:true,received:time}
 };
 const m1={id:'shade1',type:'monster',mtype:'shade',
  map,in:map,x:70,y:10,target:'P',hp:70,dead:false};
 const m2={id:'shade2',type:'monster',mtype:'shade',
  map,in:map,x:80,y:5,target:'R2',hp:55,dead:false};
 state.monsters=[m1,m2];
 const team={ready:true,run,floor:1,map,members:['R1','R2','P'],
  priest:'P',focus:{id:'shade1',victim:'P',alreadyEngaged:true}};
 const p={c,realm:()=> 'EUI',G:{monsters:{
  shade:{hp:100,attack:8,frequency:1,damage_type:'physical'}}},
  call:(action,...args)=>{
   calls.push([action,...args]);
   if(action==='can_attack')return true;
   if(action==='is_on_cooldown')return state.cooldown;
   if(action==='attack')return Promise.resolve({success:true});
   throw Error('unexpected game API: '+action);
  }};
 const bot={p,me:{name:'R1',role:'farmer'},running:true,
  cfg:{party:{enabled:true,waitForTeam:true}},
  event:(...args)=>events.push(args),
  caveTeam:{status:()=>team},monsters:()=>state.monsters,
  entity:id=>state.monsters.find(m=>m.id===id)??null,
  transport:{fresh:name=>peers[name]},
  combatAssessment:{canDefend:()=>true},
  threats:{permitted:()=>true},
  bosses:{canAttack:()=>true},
  bank:{pending:false},logistics:{reserved:false},gold:{reserved:false}};
 bot.exec=new Executor({now:()=>state.at,active:()=>bot.running,
  admit:()=>true,limit:4,onError:()=>{},onEvent:()=>{}});
 bot.caveCombat=createCaveDefensiveCombat(bot,{now:()=>state.at});
 return {bot,p,c,peers,m1,m2,team,state,calls,events};
}
const attacks=f=>f.calls.filter(row=>row[0]==='attack');

test('N12 verifies two independently observed attackers with 4s raw-damage budget',()=>{
 const f=fixture();
 const risk=caveCumulativeThreatBudget(f.bot,{
  team:f.team,now:f.state.at});
 assert.equal(risk.ready,true);
 assert.equal(risk.attackerCount,2);
 assert.equal(risk.reason,'bounded-multi-aggro-without-heal-credit');
 assert.equal(risk.signature,'shade1:P|shade2:R2');
 assert.equal(risk.members.find(m=>m.name==='P').incomingDps,12);
 assert.equal(risk.members.find(m=>m.name==='P').forecastDamage4s,48);
 const p=caveDefensiveAttackPreflight(f.bot,{now:f.state.at});
 assert.equal(p.ready,true);
 assert.equal(p.threatSignature,risk.signature);
 assert.equal(f.bot.caveCombat.tick(),true);
 assert.equal(attacks(f).length,1);
 assert.equal(attacks(f)[0][1],f.m1);
 assert.equal(f.bot.caveCombat.status().attackerCount,2);
 assert.equal(f.bot.caveCombat.status().monster,undefined);
});

test('N12 rejects cumulative damage at the Priest even though each attack is weak',()=>{
 const f=fixture();
 f.m2.target='P';f.peers.R2.threats=0;f.peers.P.threats=2;
 const risk=caveCumulativeThreatBudget(f.bot,{team:f.team,now:f.state.at});
 assert.equal(risk.ready,false);
 assert.equal(risk.reason,'multi-aggro-survival-budget-exhausted');
 assert.equal(risk.member,'P');
 assert.equal(f.bot.caveCombat.tick(),false);
 assert.equal(f.bot.caveCombat.status().riskReason,
  'multi-aggro-survival-budget-exhausted');
 assert.equal(attacks(f).length,0);
});

test('N12 independently observed peer aggro count must match live Cave enemies',()=>{
 for(const edit of [
  f=>{f.peers.R2.threats=2},
  f=>{delete f.peers.R2.threats},
  f=>{f.peers.P.threats=0},
  f=>{f.peers.R2.threats=-1},
  f=>{f.peers.P.threats=NaN},
  f=>{f.c.targets=-1},
  f=>{f.m2.hp=null},
  f=>{f.m2.hp=Infinity},
  f=>{f.m2.map=`zone_${other}_1`},
  f=>{f.m2.type='character'},
  f=>{f.m2.id='shade1'},
  f=>{f.peers.R2.received=time-3100},
  f=>{f.peers.P.realm='USII'},
  f=>{f.peers.P.hp=50},
  f=>{f.peers.P.hp=NaN},
  f=>{f.peers.P.running=false},
  f=>{f.p.G.monsters.shade.frequency=NaN},
  f=>{f.p.G.monsters.shade.attack=0},
  f=>{f.p.G.monsters={}}
 ]){
  const f=fixture();edit(f);
  const result=caveCumulativeThreatBudget(f.bot,{
   team:f.team,now:f.state.at});
  assert.equal(result.ready,false,result.reason);
  assert.equal(f.bot.caveCombat.tick(),false);
  assert.equal(attacks(f).length,0);
 }
});

test('N12 three simultaneous Cave aggressors are bounded; a fourth is refused',()=>{
 const f=fixture();
 f.peers.R2.threats=2;
 f.state.monsters.push({...f.m2,id:'shade3',target:'R2'});
 let budget=caveCumulativeThreatBudget(f.bot,{team:f.team,now:f.state.at});
 assert.equal(budget.ready,false,'two on one Ranger exceed HP reserve');
 assert.equal(budget.reason,'multi-aggro-survival-budget-exhausted');
 f.state.monsters.push({...f.m2,id:'shade4',target:'R2'});
 budget=caveCumulativeThreatBudget(f.bot,{team:f.team,now:f.state.at});
 assert.equal(budget.ready,false);
 assert.equal(budget.reason,'unbounded-engaged-count');
 assert.equal(budget.attackerCount,4);
 assert.equal(attacks(f).length,0);
});

test('N12 changes to any secondary attacker cancel deferred Ranger dispatch',()=>{
 for(const edit of [
  f=>{f.m2.target='stranger'},
  f=>{f.m2.target='P';f.peers.R2.threats=0;f.peers.P.threats=2},
  f=>{f.m2.id='new-spawn'},
  f=>{f.m2.hp=0},
  f=>{f.m2.map='main'},
  f=>{f.peers.R2.threats=2},
  f=>{f.peers.R2.received=time-4000},
  f=>{f.peers.P.hp=35},
  f=>{f.p.G.monsters.shade.attack=200},
  f=>{f.c.map='main';f.c.in='main'}
 ]){
  const f=fixture();f.bot.exec.beginFrame();
  assert.equal(f.bot.caveCombat.tick(),true);
  assert.equal(attacks(f).length,0);
  edit(f);f.bot.exec.flush();
  assert.equal(attacks(f).length,0,
   'a stale multi-enemy budget must never become a native attack');
 }
});

test('N12 a new attacker cancels a previously valid one-on-one queued attack',()=>{
 const f=fixture();
 f.state.monsters=[f.m1];f.peers.R2.threats=0;
 f.bot.exec.beginFrame();
 assert.equal(f.bot.caveCombat.tick(),true);
 f.state.monsters.push(f.m2);f.peers.R2.threats=1;
 f.bot.exec.flush();
 assert.equal(attacks(f).length,0);
});

test('N12 missing complete local monster list does not grant a new multi-target permission',()=>{
 const f=fixture();
 f.bot.monsters=()=>null;
 assert.equal(f.bot.caveCombat.tick(),false);
 assert.equal(attacks(f).length,0);
});

test('N12 the risk report is passive and never treats expected future healing as HP',()=>{
 const f=fixture();
 f.peers.P.hp=70;f.peers.P.max_hp=100;
 f.bot.cavePriest={status:()=>({ready:true}),tick:()=>true};
 const result=caveCumulativeThreatBudget(f.bot,{team:f.team,now:f.state.at});
 assert.equal(result.ready,false);
 assert.equal(result.reason,'multi-aggro-survival-budget-exhausted');
 assert.equal(attacks(f).length,0);
 assert.equal(f.calls.length,0);
});
