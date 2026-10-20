import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {caveDefensiveAttackPreflight,createCaveDefensiveCombat}
 from '../src/world/cave-defensive-combat.mjs';
import {createCaveTeamCoordination}
 from '../src/world/cave-team-coordination.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';

const when=1770000000000,run='a'.repeat(24),
 other='b'.repeat(24),map=`zone_${run}_1`;
function fixture(){
 const calls=[],events=[],state={at:when,canDefend:true,cooldown:false,
  canAttack:true,focus:true};
 const c={name:'P',ctype:'ranger',map,in:map,cave:{run},x:0,y:0,
  range:150,hp:100,max_hp:100,mp:100,max_mp:100,rip:false};
 const monster={id:'angry',type:'monster',mtype:'moth',
  map,in:map,x:70,y:0,target:'H',hp:90,dead:false,invincible:false};
 const p={c,G:{},
  realm:()=> 'EUI',
  call:(action,...args)=>{
   calls.push([action,...args]);
   if(action==='can_attack')return state.canAttack;
   if(action==='is_on_cooldown')return state.cooldown;
   if(action==='attack')return Promise.resolve({success:true});
   throw Error('unexpected game API '+action);
  }
 };
 const partyNames=['P','R','H'],peers={
  R:{name:'R',class:'ranger',map,in:map,x:60,y:0,
   hp:100,max_hp:100,running:true,realm:'EUI',received:when},
  H:{name:'H',class:'priest',map,in:map,x:30,y:20,
   hp:100,max_hp:100,running:true,realm:'EUI',received:when}
 };
 const bot={p,me:{name:'P',role:'farmer'},running:true,session:'s1',
  farmers:partyNames,leader:'P',teamNames:partyNames,reason:'',
  cfg:{party:{enabled:true,waitForTeam:true},
   farming:{enabled:true,hpBelow:.3,mpBelow:.3,
    restBelow:.2,resumeAbove:.9,potions:false}},
  monsters:()=>state.focus?[monster]:[],
  entity:id=>id===monster.id?monster:null,
  transport:{fresh:name=>peers[name]},
  cave:{status:()=>({realm:'EUI',live:{
   run,floor:1,map,serverTime:when,paused:false,
   roster:partyNames.map(name=>({name,left:false,disconnected:false}))
  }})},
  caveLifecycle:{status:()=>({state:'live-observed',
   journal:{phase:'observed-run',name:'P',realm:'EUI',
    observed:{run,floor:1,map,at:when}}})},
  combatAssessment:{canDefend:()=>state.canDefend},
  threats:{permitted:()=>true},
  bosses:{canAttack:()=>true},
  bank:{pending:false},logistics:{reserved:false,handoffActive:false},
  event:(...args)=>events.push(args)
 };
 bot.exec=new Executor({now:()=>state.at,active:()=>bot.running,
  limit:3,admit:()=>true,onError:()=>{},onEvent:()=>{}});
 bot.caveTeam=createCaveTeamCoordination(bot,{now:()=>state.at});
 bot.caveCombat=createCaveDefensiveCombat(bot,{now:()=>state.at});
 return {bot,p,c,monster,peers,state,calls,events};
}
const attacks=f=>f.calls.filter(x=>x[0]==='attack');

test('N12 Cave basic Ranger defense targets only the existing Priest attacker',async()=>{
 const f=fixture();
 const ready=caveDefensiveAttackPreflight(f.bot,{now:f.state.at});
 assert.equal(ready.ready,true);
 assert.equal(ready.focusId,'angry');
 assert.equal(ready.victim,'H');
 assert.equal(ready.canPull,false);
 assert.equal(ready.canMove,false);
 assert.equal(ready.canUseSkills,false);
 assert.equal(f.bot.caveCombat.tick(),true);
 assert.equal(attacks(f).length,1);
 assert.equal(attacks(f)[0][1],f.monster);
 assert.equal(f.bot.caveCombat.status().attempts,1);
 assert.equal(f.bot.caveCombat.tick(),false,'pending action cannot double-send');
 await Promise.resolve();f.bot.exec.poll();
 f.state.at+=301;
 // The server snapshot is now stale; no automatic blind repeat.
 assert.equal(f.bot.caveCombat.tick(),false);
 assert.equal(attacks(f).length,1);
});

test('N12 neutral, off-floor or another team enemy is never a Cave attack target',()=>{
 for(const mutation of [
  f=>{f.monster.target=null},
  f=>{f.monster.target='stranger'},
  f=>{f.monster.map=`zone_${other}_1`;f.monster.in=f.monster.map},
  f=>{f.monster.type='character'},
  f=>{f.monster.hp=0},
  f=>{f.monster.dead=true},
  f=>{f.monster.invincible=true},
  f=>{f.monster.id='other'},
  f=>{f.monster.x=170},
  f=>{f.state.focus=false}
 ]){
  const f=fixture();mutation(f);
  assert.equal(f.bot.caveCombat.tick(),false);
  assert.equal(attacks(f).length,0);
 }
});

test('N12 no teammate health/Priest tether or current Cave run proof means no attack',()=>{
 const variants=[
  f=>{f.peers.H.x=180},
  f=>{f.peers.R.received=when-3100},
  f=>{f.peers.R.running=false},
  f=>{f.peers.H.hp=60},
  f=>{f.peers.H.class='ranger'},
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.c.cave.run=other},
  f=>{f.bot.cave.status=()=>({realm:'USII',live:null})},
  f=>{f.bot.cave.status=()=>({realm:'EUI',live:{
   run,floor:1,map,serverTime:when,paused:true,
   roster:['P','R','H'].map(name=>({name,left:false,disconnected:false}))
  }})},
  f=>{f.bot.caveLifecycle.status=()=>({
   state:'exit-outcome-unknown',journal:null})},
  f=>{f.state.at=when+3001}
 ];
 for(const mutate of variants){
  const f=fixture();mutate(f);
  const info=f.bot.caveCombat.status();
  assert.equal(info.ready,false,info.reason);
  assert.equal(f.bot.caveCombat.tick(),false);
  assert.deepEqual(attacks(f),[]);
 }
});

test('N12 threat capability is mandatory, host attack and cooldown checks fail closed',()=>{
 for(const mutate of [
  f=>{f.state.canDefend=false},
  f=>{delete f.bot.combatAssessment},
  f=>{f.bot.threats.permitted=()=>false},
  f=>{f.bot.bosses.canAttack=()=>false},
  f=>{f.state.canAttack=false},
  f=>{f.state.cooldown=true},
  f=>{f.p.call=()=>{throw Error('host unavailable')}},
  f=>{f.c.ctype='priest'},
  f=>{f.bot.me.role='merchant'},
  f=>{f.bot.cfg.party.waitForTeam=false},
  f=>{f.bot.journal={kind:'item'}},
  f=>{f.bot.bank.pending=true},
  f=>{f.bot.logistics.reserved=true},
  f=>{f.bot.account={rotationPending:()=>true}},
  f=>{f.bot.lifecycleChanging=true},
  f=>{f.bot.inventoryBlocked=true}
 ]){
  const f=fixture();mutate(f);
  assert.equal(f.bot.caveCombat.tick(),false);
  assert.equal(attacks(f).length,0);
 }
});

test('N12 deferred Executor guard cancels Cave defense on map/floor, victim or Priest drift',()=>{
 const mutations=[
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.c.cave.run=other},
  f=>{f.monster.target='P'},
  f=>{f.monster.hp=0},
  f=>{f.monster.map=`zone_${other}_2`},
  f=>{f.peers.H.x=400},
  f=>{f.peers.H.received=when-4000},
  f=>{f.state.canDefend=false},
  f=>{f.state.cooldown=true}
 ];
 for(const mutate of mutations){
  const f=fixture();f.bot.exec.beginFrame();
  assert.equal(f.bot.caveCombat.tick(),true);
  assert.equal(attacks(f).length,0);
  mutate(f);f.bot.exec.flush();
  assert.equal(attacks(f).length,0,
   'a queued cave attack must re-check the live run and target');
 }
});

test('N12 actual farmer Cave tick dispatches guarded defense without overworld target or move',()=>{
 const f=fixture(),orders=[];
 f.bot.movement={order:{owner:'follow'},stop:()=>orders.push('stop'),
  go:()=>{throw Error('no Cave navigation allowed')}};
 f.bot.skills={rotation:()=>{throw Error('no AoE or farm skill allowed')}};
 f.bot.target={id:'neutral'};
 createFarmer(f.bot).tick();
 assert.deepEqual(orders,['stop']);
 assert.equal(attacks(f).length,1);
 assert.deepEqual(f.bot.caveCombat.status().last,{
  run,floor:1,focusId:'angry',victim:'H',at:when});
 assert.equal(f.bot.target,null);
 assert.equal(f.bot.reason,'Cave: bestätigte Teamverteidigung angefordert');
});

test('N12 paused, unverified or defensively unviable Cave leaves farmer isolated',()=>{
 for(const mutate of [
  f=>{f.state.canDefend=false},
  f=>{f.peers.H.running=false},
  f=>{f.monster.target=null}
 ]){
  const f=fixture(),orders=[];
  f.bot.movement={order:{owner:'farm'},stop:()=>orders.push('stop')};
  f.bot.skills={rotation:()=>{throw Error('farm skill forbidden')}};
  mutate(f);createFarmer(f.bot).tick();
  assert.deepEqual(orders,['stop']);
  assert.equal(attacks(f).length,0);
  assert.equal(f.bot.target,null);
  assert.match(f.bot.reason,/^Cave-Gruppe:/);
 }
});

test('N12 status performs no attack or combat mutation',()=>{
 const f=fixture();
 const report=f.bot.caveCombat.status();
 assert.equal(report.ready,true);
 assert.equal(report.attempts,0);
 assert.equal(report.monster,undefined,'no entity leaks through status');
 assert.equal(attacks(f).length,0);
 assert.equal(f.events.length,0);
});
