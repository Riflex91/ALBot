import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createMovement} from '../src/core/movement.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';
import {caveDirectCohesionPreflight,createCaveDirectCohesion}
 from '../src/world/cave-direct-cohesion.mjs';

const time=1770000000000,run='a'.repeat(24),
 other='b'.repeat(24),map=`zone_${run}_1`;
function fixture(){
 const calls=[],events=[];
 const state={now:time,clear:true,monsters:[],visible:true,
  live:true,refresh:true};
 const c={name:'Ranger1',ctype:'ranger',map,in:map,
  cave:{run},hp:100,max_hp:100,mp:100,max_mp:100,
  x:0,y:0,range:150,rip:false};
 const healer={name:'Priest',ctype:'priest',class:'priest',
  map,in:map,hp:100,max_hp:100,x:180,y:0,
  running:true,realm:'EUI',received:time};
 const otherRanger={name:'Ranger2',ctype:'ranger',class:'ranger',
  map,in:map,hp:100,max_hp:100,x:100,y:0,
  running:true,realm:'EUI',received:time};
 const roster=['Ranger1','Ranger2','Priest'];
 const p={c,root:{},parent:{},G:{maps:{[map]:{instance:true}}},
  realm:()=> 'EUI',
  has:name=>['can_move_to','move'].includes(name),
  call:(action,...args)=>{
   calls.push([action,...args]);
   if(action==='can_move_to')return state.clear;
   if(action==='move')return Promise.resolve({success:true});
   if(action==='stop')return true;
   throw Error('Unexpected API '+action);
  }
 };
 const bot={p,me:{name:'Ranger1',role:'farmer'},session:'own',
  running:true,reason:'',journal:null,inventoryBlocked:false,
  cfg:{party:{enabled:true,waitForTeam:true},
   world:{excludedMaps:[]},
   farming:{enabled:true,potions:false,hpBelow:.3,mpBelow:.3,
    restBelow:.2,resumeAbove:.9,pvp:false}},
  farmers:roster,leader:'Ranger1',target:null,
  monsters:()=>state.monsters,
  transport:{fresh:name=>name==='Priest'?healer:
   name==='Ranger2'?otherRanger:null},
  entity:name=>name==='Priest'&&state.visible?
   {...healer,visible:true}:null,
  cave:{status:()=>({realm:'EUI',live:state.live?{
   run,floor:1,map,serverTime:time,paused:false,
   roster:roster.map(name=>({name,left:false,disconnected:false}))
  }:null})},
  caveLifecycle:{status:()=>({state:'live-observed',
   journal:{phase:'observed-run',name:'Ranger1',realm:'EUI',
    observed:{run,floor:1,map,at:time}}})},
  logistics:{reserved:false,handoffActive:false},
  event:(...entry)=>events.push(entry)
 };
 bot.exec=new Executor({now:()=>state.now,active:()=>bot.running,
  limit:5,admit:()=>true,onEvent:()=>{},onError:()=>{}});
 bot.movement=createMovement(bot);
 bot.caveDirect=createCaveDirectCohesion(bot,{now:()=>state.now});
 return {bot,p,c,healer,otherRanger,roster,state,calls,events};
}
const nativeMoves=f=>f.calls.filter(([type])=>type==='move');
const nativeSmarts=f=>f.calls.filter(([type])=>
 type==='smart_move'||type==='use_skill'||type==='town');

test('N12 lone verified Ranger requests one direct 35px step toward visible Priest',()=>{
 const f=fixture(),proof=caveDirectCohesionPreflight(f.bot,{
  now:f.state.now});
 assert.equal(proof.ready,true);
 assert.equal(proof.canMove,true);
 assert.equal(proof.canPull,false);
 assert.equal(proof.canAttack,false);
 assert.equal(proof.step,35);
 assert.equal(proof.x,35);
 assert.equal(proof.y,0);
 assert.equal(f.bot.caveDirect.tick(),true);
 assert.equal(nativeMoves(f).length,1);
 assert.deepEqual(nativeMoves(f)[0],['move',35,0]);
 assert.equal(f.bot.movement.order.owner,'cave');
 assert.equal(f.bot.movement.order.mode,'move');
 assert.equal(f.bot.caveDirect.status().attempts,1);
 assert.deepEqual(nativeSmarts(f),[]);
 assert.equal(f.bot.caveDirect.tick(),false,'no duplicate while moving');
});

test('N12 status and preview never issue movement or host game calls',()=>{
 const f=fixture();
 assert.equal(f.bot.caveDirect.status().ready,true);
 assert.equal(f.bot.caveDirect.status().canMove,true);
 assert.equal(f.calls.length,0,'status is pure read-only');
 assert.equal(f.bot.movement.order,null);
});

test('N12 reject non-current, paused, foreign, partial, stale, or wounded trio',()=>{
 const variants=[
  f=>{f.state.live=false},
  f=>{f.p.realm=()=> 'USII'},
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.c.cave.run=other},
  f=>{f.bot.cave.status=()=>({realm:'EUI',live:{
   run,floor:1,map,serverTime:time,paused:true,
   roster:f.roster.map(name=>({name,left:false,disconnected:false}))
  }})},
  f=>{f.bot.caveLifecycle.status=()=>({state:'exit-unknown'})},
  f=>{f.healer.running=false},
  f=>{f.healer.received=time-3001},
  f=>{f.healer.realm='USII'},
  f=>{f.healer.hp=50},
  f=>{f.otherRanger.hp=60},
  f=>{f.otherRanger.map='main'},
  f=>{f.state.visible=false},
  f=>{f.state.now=time+3001},
  f=>{f.bot.cfg.party.waitForTeam=false},
  f=>{f.bot.me.role='merchant'},
  f=>{f.c.ctype='priest'},
  f=>{f.bot.journal={kind:'item'}},
  f=>{f.bot.inventoryBlocked=true},
  f=>{f.bot.logistics.handoffActive=true},
  f=>{f.bot.account={rotationPending:()=>true}},
  f=>{f.c.moving=true},
  f=>{f.healer.x=290},
  f=>{f.healer.x=100}
 ];
 for(const mutate of variants){
  const f=fixture();mutate(f);
  const result=caveDirectCohesionPreflight(f.bot,{now:f.state.now,
   hostChecks:false});
  assert.equal(result.ready,false,result.reason);
  assert.equal(f.bot.caveDirect.tick(),false);
  assert.equal(nativeMoves(f).length,0);
 }
});

test('N12 Cave direct movement rejects every visible floor encounter or team aggro',()=>{
 const examples=[
  {id:'m1',map,in:map,target:null,x:100,y:0,hp:10},
  {id:'m2',map,in:map,target:'Priest',x:100,y:0,hp:10},
  {id:'m3',map,in:map,target:null,x:100,y:0},
  {id:'m4',map:'main',in:'main',target:'Ranger2',hp:10}
 ];
 for(const monster of examples){
  const f=fixture();f.state.monsters=[monster];
  assert.equal(f.bot.caveDirect.status().ready,false);
  assert.equal(f.bot.caveDirect.tick(),false);
  assert.equal(nativeMoves(f).length,0);
 }
});

test('N12 blocked native can_move_to never degrades into generated-map smart_move',()=>{
 const f=fixture();f.state.clear=false;
 assert.equal(f.bot.caveDirect.status().ready,true,
  'read-only status does not issue geometry game calls');
 assert.equal(f.bot.caveDirect.tick(),false);
 assert.equal(nativeMoves(f).length,0);
 assert.equal(nativeSmarts(f).length,0);
 assert.equal(f.bot.movement.order,null);
});

test('N12 generic Cave movement without an owning admission is rejected',()=>{
 const f=fixture();
 assert.equal(f.bot.movement.local(35,0,'cave'),false);
 assert.equal(f.bot.movement.go({map,x:60,y:0},'cave',()=>true),false,
  'direct Cave hop greater than 45 must be rejected');
 assert.equal(f.bot.movement.go({map:'main',x:2,y:0},'cave',()=>true),false);
 assert.deepEqual(nativeMoves(f),[]);
 assert.deepEqual(nativeSmarts(f),[]);
});

test('N12 deferred movement checks immutable run, Priest anchor and every threat again',()=>{
 const mutations=[
  f=>{f.c.cave.run=other},
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.healer.x=195},
  f=>{f.healer.received=time-4000},
  f=>{f.state.visible=false},
  f=>{f.state.monsters=[{id:'angry',map,in:map,hp:10,target:'Priest'}]},
  f=>{f.state.clear=false},
  f=>{f.bot.journal={kind:'unknown'}}
 ];
 for(const mutate of mutations){
  const f=fixture();
  f.bot.exec.beginFrame();
  assert.equal(f.bot.caveDirect.tick(),true);
  assert.equal(nativeMoves(f).length,0);
  mutate(f);
  f.bot.exec.flush();
  assert.equal(nativeMoves(f).length,0,
   'delayed Cave movement cannot use stale admission');
  assert.deepEqual(nativeSmarts(f),[]);
 }
});

test('N12 farmer Cave tick attempts safe cohesion only after healing/defense',()=>{
 const f=fixture();
 f.bot.skills={rotation:()=>{throw Error('no farm rotation in Cave')}};
 f.bot.caveTeam={status:()=>({reason:'priest-out-of-support-range'})};
 f.bot.target={id:'neutral'};
 createFarmer(f.bot).tick();
 assert.equal(nativeMoves(f).length,1);
 assert.equal(f.bot.target,null);
 assert.equal(f.bot.reason,'Cave: sicherer Direktschritt zum Priest angefordert');
 const g=fixture();
 g.bot.cavePriest={tick:()=>true};
 g.bot.caveTeam={status:()=>({reason:'healing'})};
 g.bot.skills={rotation:()=>{throw Error('no farm rotation in Cave')}};
 createFarmer(g.bot).tick();
 assert.equal(nativeMoves(g).length,0,'healing takes priority');
});

test('N12 running Cave hop is stopped when an encounter appears',()=>{
 const f=fixture();
 f.bot.skills={rotation:()=>{throw Error('no farm rotation in Cave')}};
 f.bot.caveTeam={status:()=>({reason:'waiting'})};
 assert.equal(f.bot.caveDirect.tick(),true);
 assert.equal(f.bot.movement.order.owner,'cave');
 f.state.monsters=[{id:'m1',map,in:map,hp:10,target:'Priest'}];
 createFarmer(f.bot).tick();
 assert.equal(f.bot.movement.order,null);
 assert.equal(nativeMoves(f).length,1,'no second movement');
 assert.ok(f.calls.some(([type])=>type==='stop'));
});

test('N12 Cave direct cannot launder a first-frame encounter via a second monster read',()=>{
 const f=fixture(),enemy={id:'f1',map,in:map,target:null,hp:100};
 let reads=0;
 f.bot.monsters=()=>{reads++;return reads===1?[enemy]:[];};
 const result=caveDirectCohesionPreflight(f.bot,{now:time,hostChecks:false});
 assert.equal(result.ready,false);
 assert.equal(result.reason,'visible-cave-encounter-blocks-cohesion');
 assert.equal(reads,1,'one immutable monster observation for each admission');
 assert.equal(nativeMoves(f).length,0);
});

test('N12 empty, thrown, truncated or unlocated monster evidence denies Cave movement',()=>{
 const cases=[
  ()=>null,()=>({}),()=>{throw Error('frame-read-failed');},
  ()=>Array(129).fill(null),
  ()=>[null],()=>[undefined],()=>[{id:'m',hp:20}],
  ()=>[{id:'m',map:'',in:'',hp:20}],()=>[{id:'m',hp:20,dead:true}]
 ];
 for(const source of cases){
  const f=fixture();f.bot.monsters=source;
  const status=f.bot.caveDirect.status();
  assert.equal(status.ready,false,status.reason);
  assert.equal(f.bot.caveDirect.tick(),false);
  assert.deepEqual(nativeMoves(f),[]);
  assert.deepEqual(nativeSmarts(f),[]);
 }
 const safe=fixture();
 safe.state.monsters=[{id:'outside',map:'main',in:'main',hp:10,target:null}];
 assert.equal(safe.bot.caveDirect.status().ready,true,
  'a provably off-floor neutral monster is not a current Cave threat');
});

test('N12 queued Cave move rejects newly incomplete monster observations at dispatch',()=>{
 for(const source of [()=>null,()=>Array(129).fill(null),
  ()=>[{id:'unlocated',hp:100,target:null}]]){
  const f=fixture();
  f.bot.exec.beginFrame();
  assert.equal(f.bot.caveDirect.tick(),true);
  f.bot.monsters=source;
  f.bot.exec.flush();
  assert.deepEqual(nativeMoves(f),[],
   'deferred move never trusts the earlier, still empty threat list');
  assert.equal(f.bot.movement.order,null);
 }
});
