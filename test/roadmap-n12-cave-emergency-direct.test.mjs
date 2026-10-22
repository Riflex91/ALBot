import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createMovement} from '../src/core/movement.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';
import {createCaveTeamCoordination}
 from '../src/world/cave-team-coordination.mjs';
import {caveEmergencyDirectPreflight,createCaveEmergencyDirect}
 from '../src/world/cave-emergency-direct.mjs';

const now=1770000000000,run='a'.repeat(24),
 otherRun='b'.repeat(24),map=`zone_${run}_1`;
function fixture(){
 const events=[],calls=[],state={at:now,clear:true,monster:true,
  visible:true,paused:false};
 const c={name:'R1',ctype:'ranger',map,in:map,cave:{run},
  hp:55,max_hp:100,mp:100,max_mp:100,
  x:0,y:0,range:150,speed:45,rip:false};
 const monster={id:'spider1',type:'monster',mtype:'spider',
  map,in:map,x:-35,y:0,hp:100,dead:false,
  range:28,target:'R1'};
 const priest={name:'P',class:'priest',map,in:map,x:45,y:0,
  hp:100,max_hp:100,mp:120,max_mp:120,
  threats:0,running:true,realm:'EUI',received:now};
 const ally={name:'R2',class:'ranger',map,in:map,x:65,y:0,
  hp:100,max_hp:100,mp:100,max_mp:100,threats:0,
  running:true,realm:'EUI',received:now};
 const people=['R1','R2','P'];
 const p={c,root:{},parent:{},G:{
  maps:{[map]:{instance:true}},
  monsters:{spider:{hp:100,attack:4,frequency:1,speed:18}}
 },realm:()=> 'EUI',
 has:name=>['move','can_move_to'].includes(name),
 call:(kind,...args)=>{
  calls.push([kind,...args]);
  if(kind==='can_move_to')return state.clear;
  if(kind==='move')return Promise.resolve({success:true});
  if(kind==='stop')return true;
  if(kind==='is_on_cooldown')return true;
  throw Error('unexpected native call '+kind);
 }};
 const bot={p,me:{name:'R1',role:'farmer'},running:true,
  farmers:people,leader:'R1',session:'s1',teamNames:people,
  cfg:{party:{enabled:true,waitForTeam:true,healing:true},
   world:{excludedMaps:[]},
   farming:{enabled:true,hpBelow:.3,mpBelow:.3,
    potions:false,restBelow:.2,resumeAbove:.9,pvp:false}},
  journal:null,inventoryBlocked:false,target:{id:'old-farm'},
  bank:{pending:false},logistics:{reserved:false,handoffActive:false},
  gold:{reserved:false},
  cave:{status:()=>({realm:'EUI',live:{
    run,floor:1,map,serverTime:now,paused:state.paused,
    roster:people.map(name=>({name,left:false,disconnected:false}))
  }})},
  caveLifecycle:{status:()=>({state:'live-observed',
   journal:{phase:'observed-run',name:'R1',realm:'EUI',
    observed:{run,floor:1,map,at:now}}})},
  monsters:()=>state.monster?[monster]:[],
  entity:id=>id==='P'&&state.visible?
   {...priest,visible:true}:id===monster.id&&state.visible?monster:null,
  transport:{fresh:name=>name==='P'?priest:
    name==='R2'?ally:null},
  event:(...entry)=>events.push(entry)
 };
 bot.exec=new Executor({now:()=>state.at,active:()=>bot.running,
  admit:()=>true,limit:5,onEvent:()=>{},onError:()=>{}});
 bot.movement=createMovement(bot);
 bot.caveTeam=createCaveTeamCoordination(bot,{now:()=>state.at});
 bot.caveEmergency=createCaveEmergencyDirect(bot,{now:()=>state.at});
 return {bot,p,c,monster,priest,ally,state,events,calls};
}
const moves=f=>f.calls.filter(([name])=>name==='move');
const forbidden=f=>f.calls.filter(([name])=>
 ['smart_move','town','attack','heal','use_skill'].includes(name));

test('N12 one verified wounded Ranger can make a native 28px step away from slow melee within Priest range',()=>{
 const f=fixture();
 const preflight=caveEmergencyDirectPreflight(f.bot,{now:f.state.at});
 assert.equal(preflight.ready,true,preflight.reason);
 assert.equal(preflight.step,28);
 assert.equal(preflight.x,28);
 assert.equal(preflight.y,0);
 assert.equal(preflight.canPull,false);
 assert.equal(preflight.canAttack,false);
 assert.equal(f.bot.caveEmergency.tick(),true);
 assert.equal(moves(f).length,1);
 assert.deepEqual(moves(f)[0],['move',28,0]);
 assert.equal(f.bot.movement.order?.owner,'cave-evade');
 assert.equal(f.bot.movement.order?.mode,'move');
 assert.deepEqual(forbidden(f),[]);
 assert.equal(f.bot.caveEmergency.tick(),false,
  'a second action cannot interrupt an active emergency step');
});

test('N12 status is read-only: no geometry checks, native moves, or mutable monster entity',()=>{
 const f=fixture(),status=f.bot.caveEmergency.status();
 assert.equal(status.ready,true);
 assert.equal(status.canMove,true);
 assert.equal(status.monster,undefined);
 assert.equal(status.attempts,0);
 assert.deepEqual(f.calls,[]);
});

test('N12 reject stale, remote, incomplete or wounded Cave healer/roster evidence',()=>{
 const edits=[
  f=>{f.bot.running=false},
  f=>{f.bot.me.role='merchant'},
  f=>{f.c.ctype='warrior'},
  f=>{f.c.rip=true},
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.c.cave.run=otherRun},
  f=>{f.state.paused=true},
  f=>{f.state.at+=3001},
  f=>{f.p.realm=()=> 'USII'},
  f=>{f.bot.caveLifecycle.status=()=>({state:'exit-unknown'})},
  f=>{f.bot.cfg.party.waitForTeam=false},
  f=>{f.bot.cfg.party.healing=false},
  f=>{f.bot.farmers=['R1','P']},
  f=>{f.priest.received=now-3200},
  f=>{f.ally.received=now-3200},
  f=>{f.priest.realm='USII'},
  f=>{f.ally.map='main'},
  f=>{f.ally.hp=60},
  f=>{f.priest.hp=60},
  f=>{f.priest.mp=10},
  f=>{f.priest.threats=1},
  f=>{f.ally.threats=1},
  f=>{f.state.visible=false},
  f=>{f.priest.x=400},
  f=>{f.c.hp=80},
  f=>{f.c.hp=20},
  f=>{f.c.speed=0},
  f=>{f.bot.journal={kind:'transfer'}},
  f=>{f.bot.inventoryBlocked=true},
  f=>{f.bot.logistics.handoffActive=true},
  f=>{f.bot.account={rotationPending:()=>true}},
  f=>{f.bot.strategy={busy:true}},
  f=>{f.bot.teamTravel={blocked:true}}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();edits[i](f);
  const s=f.bot.caveEmergency.status();
  assert.equal(s.ready,false,'variant '+i+' : '+s.reason);
  assert.equal(f.bot.caveEmergency.tick(),false);
  assert.equal(moves(f).length,0);
 }
});

test('N12 no emergency path when enemy geometry or encounter is not independently confirmed',()=>{
 const edits=[
  f=>{f.monster.target='P'},
  f=>{f.monster.target=null},
  f=>{f.monster.range=85},
  f=>{f.monster.range=NaN},
  f=>{f.monster.x=100},
  f=>{f.monster.hp=0},
  f=>{f.monster.map='main';f.monster.in='main'},
  f=>{f.monster.type='character'},
  f=>{f.monster.hp=NaN},
  f=>{f.bot.p.G.monsters.spider.speed=50},
  f=>{delete f.bot.p.G.monsters.spider.speed},
  f=>{delete f.bot.p.G.monsters.spider.attack},
  f=>{f.bot.p.G.monsters.spider.frequency=Infinity},
  f=>{f.state.monster=false},
  f=>{f.bot.monsters=()=>[f.monster,{
   id:'other',type:'monster',map,in:map,target:null,hp:20}]},
  f=>{f.bot.monsters=()=>null},
  f=>{f.bot.entity=()=>null}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();edits[i](f);
  assert.equal(f.bot.caveEmergency.status().ready,false,
   'cannot move with unverified monster variant '+i);
  assert.equal(f.bot.caveEmergency.tick(),false);
  assert.deepEqual(moves(f),[]);
  assert.deepEqual(forbidden(f),[]);
 }
});

test('N12 no eligible direct step when healer would leave support radius',()=>{
 const f=fixture();
 f.priest.x=-110;f.ally.x=-105;
 // Keep the trio assembled; the safe candidate would move away from
 // this healer beyond the 110px emergency tether.
 const s=f.bot.caveEmergency.status();
 assert.equal(s.ready,false);
 assert.equal(f.bot.caveEmergency.tick(),false);
 assert.deepEqual(moves(f),[]);
});

test('N12 native geometry blocks and never falls back to smart movement',()=>{
 const f=fixture();f.state.clear=false;
 assert.equal(f.bot.caveEmergency.status().ready,true);
 assert.equal(f.bot.caveEmergency.tick(),false);
 assert.equal(f.bot.movement.order,null);
 assert.deepEqual(moves(f),[]);
 assert.deepEqual(forbidden(f),[]);
});

test('N12 a generic movement call cannot bypass the Cave emergency admission',()=>{
 const f=fixture();
 assert.equal(f.bot.movement.local(28,0,'cave-evade'),false);
 assert.equal(f.bot.movement.go({map,x:100,y:0},'cave-evade',()=>true),false);
 assert.equal(f.bot.movement.go({map:'main',x:5,y:0},'cave-evade',()=>true),false);
 assert.deepEqual(moves(f),[]);
 assert.deepEqual(forbidden(f),[]);
});

test('N12 deferred native move aborts on monster, healer, run, health and waypoint drift',()=>{
 const edits=[
  f=>{f.monster.target='P'},
  f=>{f.monster.x-=4},
  f=>{f.monster.hp-=5},
  f=>{f.monster.map='main'},
  f=>{f.priest.x+=15},
  f=>{f.priest.mp=1},
  f=>{f.priest.received=now-4000},
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.c.cave.run=otherRun},
  f=>{f.c.hp=85},
  f=>{f.c.x+=4},
  f=>{f.bot.monsters=()=>[f.monster,
   {id:'new',type:'monster',map,in:map,hp:100,target:null}]},
  f=>{f.state.clear=false},
  f=>{f.bot.journal={kind:'gold'}}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();f.bot.exec.beginFrame();
  assert.equal(f.bot.caveEmergency.tick(),true,'accepted variant '+i);
  assert.equal(moves(f).length,0);
  edits[i](f);f.bot.exec.flush();
  assert.equal(moves(f).length,0,
   'no stale Cave evade move, variant '+i);
  assert.deepEqual(forbidden(f),[]);
 }
});

test('N12 Farmer prioritizes safe emergency over Ranger defense and farm skill',()=>{
 const f=fixture();
 f.bot.skills={rotation:()=>{throw Error('normal farm skill in Cave')}};
 f.bot.caveCombat={tick:()=>{throw Error('defense must not outrank emergency')}};
 f.bot.cavePriest={tick:()=>false};
 f.bot.caveDirect={tick:()=>{throw Error('cohesion cannot outrank emergency')}};
 createFarmer(f.bot).tick();
 assert.equal(moves(f).length,1);
 assert.equal(f.bot.target,null);
 assert.equal(f.bot.reason,
  'Cave: abgesicherter Direktschritt aus Nahkampfdruck');
 assert.deepEqual(forbidden(f),[]);
});

test('N12 ongoing Cave emergency stops on lost monster, without a new attack or smart route',()=>{
 const f=fixture();
 f.bot.skills={rotation:()=>{throw Error('normal farm rotation')}};
 f.bot.caveCombat={tick:()=>false};
 f.bot.cavePriest={tick:()=>false};
 f.bot.caveDirect={tick:()=>false};
 createFarmer(f.bot).tick();
 assert.equal(f.bot.movement.order?.owner,'cave-evade');
 f.state.monster=false;
 createFarmer(f.bot).tick();
 assert.equal(f.bot.movement.order,null);
 assert.equal(moves(f).length,1,'no extra movement');
 assert.ok(f.calls.some(([method])=>method==='stop'));
 assert.deepEqual(forbidden(f),[]);
});

test('N12 active escape order keeps exclusive priority over Cave defense',()=>{
 const f=fixture();
 f.bot.cavePriest={tick:()=>false};
 f.bot.caveCombat={tick:()=>{throw Error('should not attack while evading')}};
 f.bot.caveDirect={tick:()=>{throw Error('should not regroup while evading')}};
 f.bot.skills={rotation:()=>{throw Error('must not run normal rotation')}};
 assert.equal(f.bot.caveEmergency.tick(),true);
 createFarmer(f.bot).tick();
 assert.equal(f.bot.reason,'Cave: abgesicherter Direktschritt aus Nahkampfdruck');
 assert.equal(moves(f).length,1);
 assert.deepEqual(forbidden(f),[]);
});

test('N12 unlocated second live monster cannot disappear from emergency threat count',()=>{
 const f=fixture(),spurious={id:'unknown',type:'monster',hp:30,
  x:-50,y:0,dead:false,target:null};
 f.bot.monsters=()=>[f.monster,spurious];
 const s=f.bot.caveEmergency.status();
 assert.equal(s.ready,false);
 assert.equal(s.reason,'unverified-cave-monster-location');
 assert.equal(f.bot.caveEmergency.tick(),false);
 assert.deepEqual(moves(f),[]);
 assert.deepEqual(forbidden(f),[]);
});
test('N12 malformed, throwing and oversized Cave monster frames never allow emergency movement',()=>{
 const frames=[
  ()=>{throw Error('transient-entity-observation-fault');},
  ()=>[fixture().monster,null],
  ()=>[fixture().monster,{}],
  ()=>[fixture().monster,{id:'unknown',hp:10,map:''}],
  ()=>Array.from({length:513},()=>null)
 ];
 for(const source of frames){
  const f=fixture();
  f.bot.monsters=source;
  assert.equal(f.bot.caveEmergency.status().ready,false);
  assert.equal(f.bot.caveEmergency.tick(),false);
  assert.deepEqual(moves(f),[]);
  assert.deepEqual(forbidden(f),[]);
 }
});
test('N12 provably off-floor neutral monster does not suppress otherwise safe emergency',()=>{
 const f=fixture(),other={id:'other',type:'monster',map:'main',
  in:'main',hp:80,target:null,dead:false};
 f.bot.monsters=()=>[f.monster,other];
 assert.equal(f.bot.caveEmergency.status().ready,true,
  'remote known harmless enemy should not be counted as Cave threat');
 assert.equal(f.bot.caveEmergency.tick(),true);
 assert.equal(moves(f).length,1);
});
test('N12 deferred Cave emergency rechecks unknown second monster and refuses queued move',()=>{
 const f=fixture();
 f.bot.exec.beginFrame();
 assert.equal(f.bot.caveEmergency.tick(),true);
 assert.equal(moves(f).length,0);
 f.bot.monsters=()=>[f.monster,{id:'unknown',hp:50,target:null}];
 f.bot.exec.flush();
 assert.deepEqual(moves(f),[]);
 assert.deepEqual(forbidden(f),[]);
});
test('N12 one Cave emergency admission reads the bounded monster frame once',()=>{
 const f=fixture();
 let calls=0;
 f.bot.monsters=()=>{calls++;return calls===1?[f.monster]:[
   f.monster,{id:'extra',map,in:map,hp:70,target:null}];};
 const p=caveEmergencyDirectPreflight(f.bot,{now:f.state.at,hostChecks:false});
 assert.equal(p.ready,true,p.reason);
 assert.equal(calls,1);
});
