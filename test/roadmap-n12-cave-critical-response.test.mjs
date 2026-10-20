import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createCaveTeamCoordination}
 from '../src/world/cave-team-coordination.mjs';
import {createCaveCriticalResponse,caveCriticalResponsePreflight}
 from '../src/world/cave-critical-response.mjs';
import {caveDefensiveAttackPreflight,createCaveDefensiveCombat}
 from '../src/world/cave-defensive-combat.mjs';
import {createCavePriestHealing}
 from '../src/world/cave-priest-healing.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';

const when=1770000000000,run='a'.repeat(24),
 other='b'.repeat(24),map=`zone_${run}_1`;
function fixture({priest=false}={}){
 const actions=[],events=[],state={now:when,monsters:[],
  canAttack:true,canHeal:true};
 const roster={
  R1:{name:'R1',ctype:'ranger',class:'ranger',map,in:map,
   cave:{run},x:0,y:0,range:150,mp:120,max_mp:120,
   hp:120,max_hp:120,rip:false,targets:0,threats:0,
   running:true,realm:'EUI',received:when},
  R2:{name:'R2',ctype:'ranger',class:'ranger',map,in:map,
   cave:{run},x:40,y:0,range:150,mp:120,max_mp:120,
   hp:120,max_hp:120,rip:false,targets:1,threats:1,
   running:true,realm:'EUI',received:when},
  P:{name:'P',ctype:'priest',class:'priest',map,in:map,
   cave:{run},x:35,y:10,range:180,mp:200,max_mp:240,
   hp:120,max_hp:120,rip:false,targets:1,threats:1,
   running:true,realm:'EUI',received:when}
 };
 const self=priest?'P':'R1',c=roster[self],names=['R1','R2','P'];
 const m1={id:'a',type:'monster',mtype:'shade',map,in:map,
  x:65,y:8,hp:75,dead:false,target:'P'};
 const m2={id:'b',type:'monster',mtype:'shade',map,in:map,
  x:60,y:0,hp:55,dead:false,target:'R2'};
 state.monsters=[m1,m2];
 const p={c,G:{maps:{[map]:{instance:true}},
  skills:{heal:{mp:15}},monsters:{shade:{attack:7,frequency:1}}},
  realm:()=> 'EUI',
  has:name=>['can_heal','heal','is_on_cooldown','can_attack'].includes(name),
  call:(name,...args)=>{
   actions.push([name,...args]);
   if(name==='can_attack')return state.canAttack;
   if(name==='can_heal')return state.canHeal;
   if(name==='is_on_cooldown')return false;
   if(name==='heal'||name==='attack')return Promise.resolve({success:true});
   throw Error('Forbidden native call: '+name);
  }
 };
 const bot={p,me:{role:'farmer',name:self},running:true,
  session:'own',farmers:names,leader:'R1',target:null,
  cfg:{party:{enabled:true,waitForTeam:true,healing:true},
   farming:{enabled:true,hpBelow:.3,mpBelow:.3,restBelow:.2,
    resumeAbove:.9,potions:false,pvp:false},
   world:{excludedMaps:[]}},
  bank:{pending:false},logistics:{reserved:false,handoffActive:false},
  gold:{reserved:false},
  transport:{fresh:name=>name===self?null:roster[name]},
  monsters:()=>state.monsters,
  entity:id=>state.monsters.find(m=>m.id===id)||
   (id!==self&&roster[id]?{...roster[id],visible:true,type:'character'}:null),
  cave:{status:()=>({realm:'EUI',live:{
   run,floor:1,map,serverTime:when,paused:false,
   roster:names.map(name=>({name,left:false,disconnected:false}))}})},
  caveLifecycle:{status:()=>({state:'live-observed',
   journal:{phase:'observed-run',name:self,realm:'EUI',
    observed:{run,floor:1,map,at:when}}})},
  combatAssessment:{canDefend:()=>true},
  threats:{permitted:()=>true},bosses:{canAttack:()=>true},
  event:(...a)=>events.push(a)
 };
 bot.exec=new Executor({now:()=>state.now,active:()=>bot.running,
  limit:6,admit:()=>true,onEvent:()=>{},onError:()=>{}});
 bot.caveTeam=createCaveTeamCoordination(bot,{now:()=>state.now});
 bot.caveCriticalResponse=createCaveCriticalResponse(bot,{now:()=>state.now});
 bot.caveCombat=createCaveDefensiveCombat(bot,{now:()=>state.now});
 bot.cavePriest=createCavePriestHealing(bot,{now:()=>state.now});
 return {bot,p,c,roster,m1,m2,state,actions,events,names};
}
const hits=f=>f.actions.filter(([name])=>name==='attack');
const heals=f=>f.actions.filter(([name])=>name==='heal');

test('N12 healthy two-attacker Cave retains the previously guarded basic defense',()=>{
 const f=fixture(),report=f.bot.caveCriticalResponse.status();
 assert.equal(report.ready,true,report.reason);
 assert.equal(report.state,'bounded-multi-aggro');
 assert.equal(report.holdOffense,false);
 assert.equal(report.attackerCount,2);
 assert.equal(report.canAttack,false,'observation never grants native attack');
 assert.equal(report.canHeal,false,'observation never grants native heal');
 assert.equal(report.members.length,3);
 assert.equal(f.actions.length,0);
 const p=caveDefensiveAttackPreflight(f.bot,{now:f.state.now});
 assert.equal(p.ready,true,p.reason);
 assert.equal(p.responseSignature,report.signature);
 assert.equal(f.bot.caveCombat.tick(),true);
 assert.equal(hits(f).length,1);
 assert.equal(hits(f)[0][1],f.m1);
});
test('N12 two simultaneous attacks below four-second HP floor hold Ranger offense',()=>{
 const f=fixture();f.p.G.monsters.shade.attack=20;
 const status=f.bot.caveCriticalResponse.status();
 assert.equal(status.ready,true,status.reason);
 assert.equal(status.critical,true);
 assert.equal(status.holdOffense,true);
 assert.equal(status.state,'critical-hold');
 assert.ok(status.members.some(m=>m.critical));
 const pre=caveDefensiveAttackPreflight(f.bot,{now:f.state.now});
 assert.equal(pre.ready,false);
 assert.equal(pre.reason,'critical-cave-response-holds-offense');
 assert.equal(f.bot.caveCombat.tick(),false);
 assert.deepEqual(hits(f),[]);
});
test('N12 critical injury below 70 percent works even when standard Cave combat readiness is false',()=>{
 const f=fixture();f.roster.P.hp=65;
 assert.equal(f.bot.caveTeam.status().ready,false);
 assert.equal(f.bot.caveTeam.healStatus().ready,true);
 const response=f.bot.caveCriticalResponse.status();
 assert.equal(response.ready,true,response.reason);
 assert.equal(response.critical,true);
 assert.equal(response.member,'P');
 assert.equal(response.holdOffense,true);
 assert.equal(f.bot.caveCombat.tick(),false);
 assert.deepEqual(hits(f),[]);
});
test('N12 malformed, stale, inconsistent and excessive Cave enemy evidence holds offense',()=>{
 const edits=[
  f=>{f.roster.P.threats=0},
  f=>{f.roster.R2.threats=2},
  f=>{delete f.roster.P.threats},
  f=>{f.roster.R2.received=when-3100},
  f=>{f.roster.P.running=false},
  f=>{f.roster.P.map='main'},
  f=>{f.roster.P.hp=NaN},
  f=>{f.m2.map='main'},
  f=>{f.m2.id='a'},
  f=>{f.m2.hp=null},
  f=>{f.m2.type='character'},
  f=>{f.p.G.monsters.shade.attack=Infinity},
  f=>{f.p.G.monsters.shade.frequency=0},
  f=>{f.state.monsters=null},
  f=>{f.state.monsters.push({...f.m2,id:'c',target:'P'},
   {...f.m2,id:'d',target:'P'})},
  f=>{f.p.realm=()=> 'USII'},
  f=>{f.state.now+=3101},
  f=>{f.c.cave.run=other}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();edits[i](f);
  const response=f.bot.caveCriticalResponse.status();
  assert.equal(response.holdOffense,true,'case '+i+' '+response.reason);
  assert.equal(f.bot.caveCombat.tick(),false,'no unsafe attack '+i);
  assert.deepEqual(hits(f),[]);
 }
});
test('N12 unverified multi-aggro risk cannot be mistaken for safe no-engagement',()=>{
 const f=fixture();f.state.monsters=null;
 const r=f.bot.caveCriticalResponse.status();
 assert.equal(r.ready,false);
 assert.equal(r.holdOffense,true);
 assert.equal(r.state,'unverified');
 assert.equal(r.signature,null);
});
test('N12 single engaged attacker keeps guarded defense and Ranger emergency movement eligibility',()=>{
 const f=fixture();f.state.monsters=[f.m1];
 f.roster.R2.threats=0;
 const r=f.bot.caveCriticalResponse.status();
 assert.equal(r.ready,true);
 assert.equal(r.state,'single-engagement');
 assert.equal(r.holdOffense,false);
 assert.equal(f.bot.caveCombat.tick(),true);
 assert.equal(hits(f).length,1);
});
test('N12 newly critical pressure aborts queued Ranger attack before dispatch',()=>{
 const edits=[
  f=>{f.roster.P.hp=65},
  f=>{f.p.G.monsters.shade.attack=20},
  f=>{f.roster.R2.threats=0},
  f=>{f.state.monsters.push({...f.m1,id:'c',target:'P'},
   {...f.m2,id:'d',target:'R2'})},
  f=>{f.state.now=when+3200}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();f.bot.exec.beginFrame();
  assert.equal(f.bot.caveCombat.tick(),true,'queued '+i);
  assert.equal(hits(f).length,0);
  edits[i](f);f.bot.exec.flush();
  assert.equal(hits(f).length,0,'must cancel stale attack '+i);
 }
});
test('N12 at native attack boundary new critical threat also aborts',()=>{
 const f=fixture(),original=f.bot.monsters;let observations=0;
 f.bot.monsters=()=>{
  observations++;
  // Multiple independent observations occur at preflight, scheduling,
  // and before invoke. Change only when the final proof is evaluated.
  if(observations===11)f.roster.P.hp=60;
  return original();
 };
 assert.equal(f.bot.caveCombat.tick(),true);
 assert.equal(hits(f).length,0,'no network attack on changed risk');
});
test('N12 critical Cave farmer stops an existing direct step and does not attack or move',()=>{
 const f=fixture();f.p.G.monsters.shade.attack=20;
 const stopped=[];
 f.bot.movement={order:{owner:'cave',mode:'move'},
  stop:()=>{stopped.push('stop');f.bot.movement.order=null;}};
 f.bot.caveDirect={status:()=>({ready:true}),
  tick:()=>{throw Error('no Cave cohesion in multi-aggro')}};
 f.bot.caveEmergency={tick:()=>{throw Error('no blind escape')}};
 f.bot.cavePriestSupport={tick:()=>{throw Error('no Priest move')}};
 f.bot.skills={rotation:()=>{throw Error('no ordinary farm skills')}};
 createFarmer(f.bot).tick();
 assert.deepEqual(stopped,['stop']);
 assert.equal(f.bot.reason,
  'Cave: kritische Mehrfachaggro – Offensive und Bewegung gesperrt');
 assert.equal(hits(f).length,0);
 assert.equal(f.actions.some(([name])=>name==='smart_move'),false);
});
test('N12 critical Cave Priest still performs life-saving native heal first',()=>{
 const f=fixture({priest:true});
 f.roster.P.hp=45;
 const response=f.bot.caveCriticalResponse.status();
 assert.equal(response.ready,true,response.reason);
 assert.equal(response.holdOffense,true);
 f.bot.movement={order:null,stop:()=>{throw Error('no move')}};
 f.bot.skills={rotation:()=>{throw Error('no overworld skills')}};
 createFarmer(f.bot).tick();
 assert.equal(heals(f).length,1,'critical Priest remains heal-capable');
 assert.equal(heals(f)[0][1],f.c);
 assert.equal(hits(f).length,0);
 assert.equal(f.bot.reason,'Cave: gezielte Priest-Heilung angefordert');
});
test('N12 status is pure, exposes no live character/monster objects',()=>{
 const f=fixture();const r=caveCriticalResponsePreflight(f.bot,{
  now:f.state.now});
 assert.equal(r.ready,true);
 assert.equal(r.monster,undefined);
 assert.equal(r.target,undefined);
 assert.equal(r.members.find(m=>m.name==='P').hp,undefined);
 assert.deepEqual(f.actions,[]);
 assert.deepEqual(f.events,[]);
});
