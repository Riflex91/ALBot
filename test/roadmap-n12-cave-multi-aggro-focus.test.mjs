import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {caveMultiAggroFocusPlan,createCaveMultiAggroFocus}
 from '../src/world/cave-multi-aggro-focus.mjs';
import {caveDefensiveAttackPreflight,createCaveDefensiveCombat}
 from '../src/world/cave-defensive-combat.mjs';

const at=1770000000000,run='a'.repeat(24),map=`zone_${run}_1`;
function fixture(){
 const actions=[],state={now:at,monsters:[]};
 const c={name:'R1',ctype:'ranger',map,in:map,cave:{run},
  x:0,y:0,range:150,hp:200,max_hp:200,mp:100,max_mp:100,
  targets:0,threats:0,rip:false};
 const members={
  R2:{name:'R2',class:'ranger',map,in:map,x:30,y:0,
   hp:200,max_hp:200,threats:1,received:at,realm:'EUI',running:true},
  P:{name:'P',class:'priest',map,in:map,x:20,y:10,
   hp:200,max_hp:200,threats:1,received:at,realm:'EUI',running:true}
 };
 const mob=(id,target,mtype='shade',hp=90)=>({
  id,type:'monster',mtype,map,in:map,x:60,y:5,hp,
  target,dead:false,invincible:false
 });
 const a=mob('a','P'),b=mob('b','R2');
 state.monsters=[a,b];
 const team={ready:true,run,floor:1,map,
  members:['R1','R2','P'],priest:'P',
  focus:{id:'a',victim:'P',alreadyEngaged:true}};
 const p={c,realm:()=> 'EUI',G:{monsters:{
  shade:{attack:5,frequency:1},heavy:{attack:12,frequency:1},
  light:{attack:2,frequency:1}}},
  call:(method,...args)=>{
   actions.push([method,...args]);
   if(method==='can_attack')return true;
   if(method==='is_on_cooldown')return false;
   if(method==='attack')return Promise.resolve({success:true});
   throw Error('unexpected API '+method);
  }};
 const bot={p,me:{name:'R1',role:'farmer'},running:true,
  cfg:{party:{enabled:true,waitForTeam:true}},
  caveTeam:{status:()=>team},
  transport:{fresh:name=>members[name]},
  monsters:()=>state.monsters,
  entity:id=>state.monsters.find(m=>m.id===id)??null,
  combatAssessment:{canDefend:()=>true},
  threats:{permitted:()=>true},bosses:{canAttack:()=>true},
  bank:{pending:false},logistics:{reserved:false},
  gold:{reserved:false},event:()=>{}};
 bot.exec=new Executor({now:()=>state.now,active:()=>bot.running,
  admit:()=>true,limit:4,onEvent:()=>{},onError:()=>{}});
 bot.caveMultiAggro=createCaveMultiAggroFocus(bot,{now:()=>state.now});
 bot.caveCombat=createCaveDefensiveCombat(bot,{now:()=>state.now});
 return {bot,p,c,team,members,a,b,state,actions};
}
const attacks=f=>f.actions.filter(([kind])=>kind==='attack');

test('N12 two already engaged monsters agree on Priest protection and never authorize neutral pulls',()=>{
 const f=fixture();
 const plan=f.bot.caveMultiAggro.status();
 assert.equal(plan.ready,true,plan.reason);
 assert.equal(plan.attackerCount,2);
 assert.deepEqual(plan.focus,{id:'a',victim:'P',alreadyEngaged:true});
 assert.equal(plan.canPull,false);
 assert.equal(plan.canMove,false);
 assert.equal(plan.canAoE,false);
 assert.equal(plan.monster,undefined);
 assert.equal(f.actions.length,0);
 const info=caveDefensiveAttackPreflight(f.bot,{now:at});
 assert.equal(info.ready,true,info.reason);
 assert.equal(info.focusId,'a');
 assert.equal(info.coordinationSignature,plan.signature);
 assert.equal(f.bot.caveCombat.tick(),true);
 assert.equal(attacks(f).length,1);
 assert.equal(attacks(f)[0][1],f.a);
});

test('N12 higher incoming DPS wins shared focus for equal-threat victim, not low monster HP',()=>{
 const f=fixture();
 f.a.target='R2';f.a.mtype='light';f.a.hp=8;
 f.b.mtype='heavy';f.members.P.threats=0;
 f.members.R2.threats=2;
 f.team.focus={id:'a',victim:'R2',alreadyEngaged:true};
 const p=caveMultiAggroFocusPlan(f.bot,{team:f.team,now:at});
 assert.equal(p.ready,true,p.reason);
 assert.equal(p.focus.id,'b');
 const attack=caveDefensiveAttackPreflight(f.bot,{now:at});
 assert.equal(attack.ready,true,attack.reason);
 assert.equal(attack.focusId,'b','use coordinated priority, not old shortest-HP focus');
 assert.equal(f.bot.caveCombat.tick(),true);
 assert.equal(attacks(f)[0][1],f.b);
});

test('N12 deterministic victim focus when both Rangers observe same current trio',()=>{
 const f=fixture();
 f.a.target='R1';f.c.targets=1;f.c.threats=1;
 f.members.P.threats=0;
 f.team.focus={id:'a',victim:'R1',alreadyEngaged:true};
 f.members.R2.hp=150;f.members.R2.max_hp=200;
 const first=f.bot.caveMultiAggro.status();
 assert.equal(first.ready,true,first.reason);
 assert.equal(first.focus.id,'b','smaller remaining safety margin first');
 // Switch to the other active Ranger with the same shared observations.
 // Its own native aggro count must reflect the same server state.
 Object.assign(f.c,{running:true,realm:'EUI',received:at});
 f.p.c={...f.members.R2,ctype:'ranger',cave:{run},range:150,targets:1};
 f.bot.me.name='R2';
 f.bot.transport.fresh=name=>name==='R1'?f.c:name==='P'?f.members.P:null;
 const second=f.bot.caveMultiAggro.status();
 assert.equal(second.ready,true,second.reason);
 assert.deepEqual(second.focus,first.focus);
 assert.equal(second.signature,first.signature);
 assert.equal(second.memberSignature,first.memberSignature);
});

test('N12 incoming multi-aggro damage, peer counters and observed target drift deny new attacks',()=>{
 const edits=[
  f=>{f.members.P.threats=0},
  f=>{f.members.R2.received=at-3100},
  f=>{f.members.R2.hp=120},
  f=>{f.a.mtype='unknown'},
  f=>{f.p.G.monsters.shade.attack=NaN},
  f=>{f.b.id='a'},
  f=>{f.b.map='main'},
  f=>{f.state.monsters=[f.a,{...f.b,id:'c',target:'P',hp:20},f.b]},
  f=>{f.state.monsters=null},
  f=>{f.state.monsters.push({...f.b,id:'c'}, {...f.b,id:'d'})}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();edits[i](f);
  const plan=f.bot.caveMultiAggro.status();
  assert.equal(plan.ready,false,'case '+i+': '+plan.reason);
  assert.equal(f.bot.caveCombat.tick(),false);
  assert.equal(attacks(f).length,0);
 }
});

test('N12 deferred attack cancels when nonfocused attacker, team HP or monster metadata changes',()=>{
 const edits=[
  f=>{f.b.hp--},
  f=>{f.b.x+=2},
  f=>{f.b.mtype='heavy'},
  f=>{f.p.G.monsters.shade.attack++},
  f=>{f.members.R2.hp--},
  f=>{f.members.P.max_hp+=1},
  f=>{f.b.target='P';f.members.R2.threats=0;f.members.P.threats=2}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();f.bot.exec.beginFrame();
  assert.equal(f.bot.caveCombat.tick(),true);
  assert.equal(attacks(f).length,0);
  edits[i](f);
  f.bot.exec.flush();
  assert.equal(attacks(f).length,0,'stale coordinated attack case '+i);
 }
});

test('N12 a new attacker invalidates queued single-monster attack',()=>{
 const f=fixture();
 f.state.monsters=[f.a];f.members.R2.threats=0;
 f.bot.exec.beginFrame();
 assert.equal(f.bot.caveCombat.tick(),true);
 f.state.monsters.push(f.b);f.members.R2.threats=1;
 f.bot.exec.flush();
 assert.equal(attacks(f).length,0);
});

test('N12 one focused attacker remains under legacy single-defense bounds',()=>{
 const f=fixture();
 f.state.monsters=[f.a];f.members.R2.threats=0;
 assert.equal(f.bot.caveMultiAggro.status().ready,false);
 const p=caveDefensiveAttackPreflight(f.bot,{now:at});
 assert.equal(p.ready,true,p.reason);
 assert.equal(p.coordinationSignature,null);
 assert.equal(p.focusId,'a');
 assert.equal(f.bot.caveCombat.tick(),true);
 assert.equal(attacks(f).length,1);
});
