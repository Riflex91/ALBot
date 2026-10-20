import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createCaveTeamCoordination,caveTeamCoordination}
 from '../src/world/cave-team-coordination.mjs';
import {cavePriestHealPreflight,createCavePriestHealing}
 from '../src/world/cave-priest-healing.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';

const at=1770000000000,run='a'.repeat(24),other='b'.repeat(24);
const map=`zone_${run}_1`;
function fixture(){
 const state={at,cooldown:false,canHeal:true},calls=[],events=[];
 const c={name:'H',ctype:'priest',type:'character',map,in:map,
  cave:{run},hp:100,max_hp:100,mp:240,max_mp:300,mp_cost:20,
  range:180,x:0,y:0,rip:false};
 const entities={
  R1:{name:'R1',type:'character',visible:true,map,in:map,
   hp:45,max_hp:100,x:35,y:0,rip:false},
  R2:{name:'R2',type:'character',visible:true,map,in:map,
   hp:90,max_hp:100,x:45,y:0,rip:false}
 };
 const peers={
  R1:{name:'R1',class:'ranger',map,in:map,x:35,y:0,
   hp:45,max_hp:100,received:at,running:true,realm:'EUI'},
  R2:{name:'R2',class:'ranger',map,in:map,x:45,y:0,
   hp:90,max_hp:100,received:at,running:true,realm:'EUI'}
 };
 const p={c,G:{skills:{heal:{mp:20}}},
  realm:()=> 'EUI',has:name=>['heal','can_heal','is_on_cooldown'].includes(name),
  call:(method,...args)=>{
   calls.push([method,...args]);
   if(method==='can_heal')return state.canHeal;
   if(method==='is_on_cooldown')return state.cooldown;
   if(method==='heal')return Promise.resolve({success:true});
   throw Error('unexpected native method '+method);
  }
 };
 const bot={running:true,p,me:{name:'H',role:'farmer'},
  cfg:{party:{enabled:true,healing:true,waitForTeam:true},
   farming:{enabled:true,hpBelow:.3,mpBelow:.3,restBelow:.2,
    resumeAbove:.9,potions:false}},farmers:['H','R1','R2'],
  leader:'R1',teamNames:['H','R1','R2'],session:'s1',
  entity:name=>entities[name]??null,
  transport:{fresh:name=>peers[name]},
  monsters:()=>[],event:(...args)=>events.push(args),
  cave:{status:()=>({realm:'EUI',live:{
   run,map,floor:1,serverTime:at,paused:false,
   roster:['H','R1','R2'].map(name=>({name,
    left:false,disconnected:false}))
  }})},
  caveLifecycle:{status:()=>({state:'live-observed',journal:{
   phase:'observed-run',name:'H',realm:'EUI',
   observed:{run,floor:1,map,at}
  }})},logistics:{reserved:false,handoffActive:false},
  bank:{pending:false}
 };
 bot.exec=new Executor({now:()=>state.at,active:()=>bot.running,
  limit:3,admit:()=>true,onError:()=>{},onEvent:()=>{}});
 bot.caveTeam=createCaveTeamCoordination(bot,{now:()=>state.at});
 bot.cavePriest=createCavePriestHealing(bot,{now:()=>state.at});
 return {bot,p,c,state,peers,entities,calls,events};
}
const heals=f=>f.calls.filter(x=>x[0]==='heal');
test('N12 healing readiness admits injured teammate while combat readiness stays blocked',()=>{
 const f=fixture();
 assert.equal(f.bot.caveTeam.status().ready,false);
 assert.equal(f.bot.caveTeam.healStatus().ready,true);
 const r=cavePriestHealPreflight(f.bot,{now:at});
 assert.equal(r.ready,true);
 assert.equal(r.targetName,'R1');
 assert.equal(r.targetHp,45);
 assert.equal(r.canAttack,false);
 assert.equal(r.canMove,false);
 assert.equal(r.canAoE,false);
});
test('N12 only one actual visible injured teammate is healed through native basic heal',async()=>{
 const f=fixture();
 assert.equal(f.bot.cavePriest.tick(),true);
 assert.equal(heals(f).length,1);
 assert.equal(heals(f)[0][1],f.entities.R1);
 assert.equal(f.bot.cavePriest.status().targetName,'R1');
 assert.equal(f.bot.cavePriest.tick(),false,'same resource still pending');
 await Promise.resolve();f.bot.exec.poll();
 assert.equal(f.bot.exec.pending.size,1,
  'a returned Promise alone is not proof HP increased');
 f.entities.R1.hp=77;f.peers.R1.hp=77;f.bot.exec.poll();
 assert.equal(f.bot.exec.pending.size,0);
 assert.equal(heals(f).length,1);
 assert.equal(f.bot.cavePriest.status().last.targetName,'R1');
});
test('N12 no actual missing HP means no heal or useless full-life cast',()=>{
 const f=fixture();
 f.entities.R1.hp=94;f.peers.R1.hp=94;
 assert.equal(f.bot.cavePriest.tick(),false);
 assert.equal(heals(f).length,0);
 assert.equal(f.bot.cavePriest.status().reason,'no-current-injured-in-range-member');
});
test('N12 self-healing is allowed only for a visibly injured own Priest',()=>{
 const f=fixture();
 f.c.hp=50;f.entities.R1.hp=80;f.peers.R1.hp=80;
 const p=cavePriestHealPreflight(f.bot,{now:at});
 assert.equal(p.ready,true);
 assert.equal(p.targetName,'H');
 assert.equal(f.bot.cavePriest.tick(),true);
 assert.equal(heals(f)[0][1],f.c);
});
test('N12 no heal if own Priest or team evidence is stale, incomplete or off-floor',()=>{
 const cases=[
  f=>{f.c.ctype='ranger'},
  f=>{f.c.rip=true},
  f=>{f.c.cave.run=other},
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.peers.R2.received=at-3200},
  f=>{f.peers.R2.map='main'},
  f=>{f.peers.R2.running=false},
  f=>{f.peers.R2.realm='USII'},
  f=>{f.peers.R2.hp=0},
  f=>{f.peers.R2.x=300},
  f=>{f.state.at=at+3200},
  f=>{f.bot.caveLifecycle.status=()=>({
   state:'exit-outcome-unknown',journal:null})},
  f=>{f.bot.cave.status=()=>({realm:'EUI',live:{
   run,map,floor:1,serverTime:at,paused:true,
   roster:['H','R1','R2'].map(name=>({name,left:false,disconnected:false}))
  }})},
  f=>{f.bot.cfg.party.healing=false}
 ];
 for(const mutate of cases){
  const f=fixture();mutate(f);
  assert.equal(f.bot.cavePriest.tick(),false);
  assert.equal(heals(f).length,0);
 }
});
test('N12 no healing when recipient is stale, not visible or off floor',()=>{
 for(const mutate of [
  f=>{f.entities.R1.visible=false},
  f=>{f.entities.R1.map='main'},
  f=>{f.entities.R1.in='main'},
  f=>{f.entities.R1.hp=0},
  f=>{f.entities.R1.hp=150},
  f=>{f.entities.R1.x=190},
  f=>{f.bot.entity=()=>null},
  f=>{f.peers.R1.received=at-3200},
  f=>{f.peers.R1.hp=0}
 ]){
  const f=fixture();mutate(f);
  assert.equal(f.bot.cavePriest.tick(),false);
  assert.equal(heals(f).length,0);
 }
});
test('N12 missing mana, blocked condition and native heal capability deny cast',()=>{
 const mutate=[
  f=>{f.c.mp=40},
  f=>{f.c.mp=NaN},
  f=>{f.p.G.skills.heal.mp=NaN},
  f=>{f.bot.cfg.party.enabled=false},
  f=>{f.bot.journal={kind:'gold'}},
  f=>{f.bot.bank.pending=true},
  f=>{f.bot.inventoryBlocked=true},
  f=>{f.bot.account={rotationPending:()=>true}},
  f=>{f.bot.lifecycleChanging=true},
  f=>{f.state.cooldown=true},
  f=>{f.state.canHeal=false},
  f=>{f.p.has=()=>false},
  f=>{f.p.call=()=>{throw Error('missing native heal capability')}}
 ];
 for(const m of mutate){
  const f=fixture();m(f);
  assert.equal(f.bot.cavePriest.tick(),false);
  assert.equal(heals(f).length,0);
 }
});
test('N12 deferred Executor refuses changed run, healer, healed target or danger',()=>{
 const changes=[
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.c.cave.run=other},
  f=>{f.entities.R1.visible=false},
  f=>{f.entities.R1.hp=100},
  f=>{f.entities.R1.map='main'},
  f=>{f.entities.R1.x=220},
  f=>{f.entities.R1.hp=0},
  f=>{f.peers.R2.x=220},
  f=>{f.peers.R2.running=false},
  f=>{f.state.cooldown=true},
  f=>{f.bot.cfg.party.healing=false}
 ];
 for(const change of changes){
  const f=fixture();
  f.bot.exec.beginFrame();
  assert.equal(f.bot.cavePriest.tick(),true);
  change(f);f.bot.exec.flush();
  assert.equal(heals(f).length,0,'queued heal must be canceled after evidence drift');
 }
});
test('N12 final game call revalidation rejects last-moment target visibility change',()=>{
 const f=fixture(),original=f.bot.entity;
 let reads=0;
 f.bot.entity=name=>{
  const e=original(name);
  if(name==='R1'&&++reads===3)e.visible=false;
  return e;
 };
 assert.equal(f.bot.cavePriest.tick(),true);
 assert.equal(heals(f).length,0);
});
test('N12 farmer Cave tick calls Priest single heal and no normal farm skill or movement',()=>{
 const f=fixture(),stops=[];
 f.bot.movement={order:{owner:'follow'},
  stop:()=>stops.push('stop'),go:()=>{throw Error('no cave movement')}};
 f.bot.skills={rotation:()=>{throw Error('no normal rotations')}};
 f.bot.target={id:'neutral'};
 createFarmer(f.bot).tick();
 assert.deepEqual(stops,['stop']);
 assert.equal(heals(f).length,1);
 assert.equal(f.bot.target,null);
 assert.equal(f.bot.reason,'Cave: gezielte Priest-Heilung angefordert');
});
test('N12 Cave Priest status never heals or exposes mutable character entity',()=>{
 const f=fixture();
 const s=f.bot.cavePriest.status();
 assert.equal(s.ready,true);
 assert.equal(s.target,undefined);
 assert.equal(s.attempts,0);
 assert.equal(heals(f).length,0);
});
