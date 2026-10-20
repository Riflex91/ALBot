import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createMovement} from '../src/core/movement.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';
import {createCaveTeamCoordination}
 from '../src/world/cave-team-coordination.mjs';
import {cavePriestSupportPreflight,createCavePriestSupport}
 from '../src/world/cave-priest-support.mjs';

const at=1770000000000,run='a'.repeat(24),
 otherRun='b'.repeat(24),map=`zone_${run}_1`;
function fixture(){
 const calls=[],events=[],state={at,clear:true,paused:false,visible:true,monsters:true};
 const c={name:'P',ctype:'priest',map,in:map,cave:{run},
  hp:100,max_hp:100,mp:160,max_mp:200,
  range:180,x:0,y:0,rip:false};
 const r1={name:'R1',class:'ranger',map,in:map,
  x:135,y:0,hp:65,max_hp:100,received:at,
  running:true,realm:'EUI',threats:1};
 const r2={name:'R2',class:'ranger',map,in:map,
  x:0,y:40,hp:95,max_hp:100,received:at,
  running:true,realm:'EUI',threats:0};
 const observed={
  R1:{...r1,type:'character',visible:true},
  R2:{...r2,type:'character',visible:true}
 };
 const m={id:'spider1',type:'monster',mtype:'spider',
  map,in:map,hp:80,x:165,y:0,range:25,target:'R1',dead:false};
 const team=['P','R1','R2'];
 const p={c,root:{},parent:{},G:{
  maps:{[map]:{instance:true}},
  monsters:{spider:{hp:100,attack:8,frequency:1,range:25}}
 },realm:()=> 'EUI',
 has:n=>['can_move_to','move'].includes(n),
 call:(method,...args)=>{
  calls.push([method,...args]);
  if(method==='can_move_to')return state.clear;
  if(method==='move')return Promise.resolve({success:true});
  if(method==='stop')return true;
  if(method==='is_on_cooldown')return true;
  throw Error('unexpected game method '+method);
 }};
 const bot={p,me:{name:'P',role:'farmer'},running:true,
  farmers:team,leader:'R1',teamNames:team,
  journal:null,inventoryBlocked:false,target:{id:'old-overworld'},
  cfg:{party:{enabled:true,healing:true,waitForTeam:true},
   world:{excludedMaps:[]},
   farming:{enabled:true,hpBelow:.3,mpBelow:.3,restBelow:.2,
    resumeAbove:.9,potions:false,pvp:false}},
  logistics:{reserved:false,handoffActive:false},
  gold:{reserved:false},bank:{pending:false},
  monsters:()=>state.monsters?[m]:[],
  entity:name=>name==='R1'&&state.visible?observed.R1:
   name==='R2'&&state.visible?observed.R2:
   name==='spider1'&&state.visible?m:null,
  transport:{fresh:n=>n==='R1'?r1:n==='R2'?r2:null},
  cave:{status:()=>({realm:'EUI',live:{
   run,floor:1,map,serverTime:at,paused:state.paused,
   roster:team.map(name=>({name,left:false,disconnected:false}))
  }})},
  caveLifecycle:{status:()=>({state:'live-observed',
   journal:{phase:'observed-run',name:'P',realm:'EUI',
    observed:{run,floor:1,map,at}}
  })},event:(...a)=>events.push(a)};
 bot.exec=new Executor({now:()=>state.at,active:()=>bot.running,
  limit:5,admit:()=>true,onEvent:()=>{},onError:()=>{}});
 bot.movement=createMovement(bot);
 bot.caveTeam=createCaveTeamCoordination(bot,{now:()=>state.at});
 bot.cavePriestSupport=createCavePriestSupport(bot,{now:()=>state.at});
 return {bot,p,c,r1,r2,observed,m,state,calls,events};
}
const moves=f=>f.calls.filter(([method])=>method==='move');
const forbidden=f=>f.calls.filter(([method])=>
 ['smart_move','town','attack','use_skill','blink'].includes(method));

test('N12 one witnessed Ranger patient at outer margin permits one 24px native Priest step',()=>{
 const f=fixture();
 const p=cavePriestSupportPreflight(f.bot,{now:f.state.at});
 assert.equal(p.ready,true,p.reason);
 assert.equal(p.patient,'R1');
 assert.equal(p.monsterId,'spider1');
 assert.equal(p.step,24);
 assert.equal(p.x,24);
 assert.equal(p.y,0);
 assert.equal(p.canMove,true);
 assert.equal(p.canAttack,false);
 assert.equal(p.canPull,false);
 assert.equal(f.bot.cavePriestSupport.tick(),true);
 assert.deepEqual(moves(f),[['move',24,0]]);
 assert.equal(f.bot.movement.order?.owner,'cave-priest');
 assert.equal(f.bot.movement.order?.mode,'move');
 assert.deepEqual(forbidden(f),[]);
 assert.equal(f.bot.cavePriestSupport.tick(),false);
});
test('N12 read-only Priest position status never calls game API or leaks mutable entities',()=>{
 const f=fixture();
 const s=f.bot.cavePriestSupport.status();
 assert.equal(s.ready,true);
 assert.equal(s.monster,undefined);
 assert.equal(s.target,undefined);
 assert.equal(s.attempts,0);
 assert.equal(f.calls.length,0);
});
test('N12 deny unknown run, wounded Priest, weak mana, stale peers, missing visibility',()=>{
 const changes=[
  f=>{f.bot.running=false},
  f=>{f.bot.me.role='merchant'},
  f=>{f.c.ctype='ranger'},
  f=>{f.c.rip=true},
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.c.cave.run=otherRun},
  f=>{f.p.realm=()=> 'USII'},
  f=>{f.state.paused=true},
  f=>{f.state.at+=3001},
  f=>{f.bot.caveLifecycle.status=()=>({state:'exit-unknown'})},
  f=>{f.bot.cfg.party.enabled=false},
  f=>{f.bot.cfg.party.healing=false},
  f=>{f.bot.cfg.party.waitForTeam=false},
  f=>{f.bot.farmers=['P','R1']},
  f=>{f.c.hp=84},
  f=>{f.c.hp=NaN},
  f=>{f.c.mp=40},
  f=>{f.c.mp=NaN},
  f=>{f.r1.received=at-3100},
  f=>{f.r2.received=at-3100},
  f=>{f.r1.realm='USII'},
  f=>{f.r2.map='main'},
  f=>{f.r2.hp=35},
  f=>{f.r1.running=false},
  f=>{f.r2.threats=1},
  f=>{f.r1.threats=2},
  f=>{f.state.visible=false},
  f=>{f.observed.R1.x+=15},
  f=>{f.observed.R1.hp=40},
  f=>{f.observed.R2.visible=false},
  f=>{f.bot.journal={kind:'bank'}},
  f=>{f.bot.inventoryBlocked=true},
  f=>{f.bot.logistics.handoffActive=true},
  f=>{f.bot.gold.reserved=true},
  f=>{f.bot.account={rotationPending:()=>true}},
  f=>{f.bot.strategy={busy:true}}
 ];
 for(let i=0;i<changes.length;i++){
  const f=fixture();changes[i](f);
  const p=f.bot.cavePriestSupport.status();
  assert.equal(p.ready,false,'case '+i+': '+p.reason);
  assert.equal(f.bot.cavePriestSupport.tick(),false);
  assert.equal(moves(f).length,0);
 }
});
test('N12 only one Ranger wounded at outer healing margin can trigger positioning',()=>{
 for(const change of [
  f=>{f.r1.hp=90;f.observed.R1.hp=90},
  f=>{f.r1.hp=35;f.observed.R1.hp=35},
  f=>{f.r1.x=110;f.observed.R1.x=110},
  f=>{f.r1.x=150;f.observed.R1.x=150},
  f=>{f.r2.hp=65;f.observed.R2.hp=65},
  f=>{f.r2.x=-140;f.observed.R2.x=-140},
  f=>{f.r1.x=135;f.observed.R1.x=135;f.r2.x=0;f.observed.R2.x=0;f.r2.y=145;f.observed.R2.y=145}
 ]){
  const f=fixture();change(f);
  assert.equal(f.bot.cavePriestSupport.tick(),false);
  assert.equal(moves(f).length,0);
 }
});
test('N12 neutral second monster, ranger swap, ranged mob and unclear damage all block',()=>{
 const edits=[
  f=>{f.m.target='P'},
  f=>{f.m.target='R2'},
  f=>{f.m.target=null},
  f=>{f.m.range=80},
  f=>{f.m.range=NaN},
  f=>{f.m.hp=null},
  f=>{f.m.map='main';f.m.in='main'},
  f=>{f.m.type='character'},
  f=>{f.m.x=400},
  f=>{f.m.x=100},
  f=>{f.p.G.monsters.spider.attack=NaN},
  f=>{f.p.G.monsters.spider.frequency=0},
  f=>{f.p.G.monsters.spider.range=100},
  f=>{f.p.G.monsters={}},
  f=>{f.bot.monsters=()=>null},
  f=>{f.bot.monsters=()=>[f.m,{id:'neutral',map,in:map,hp:90,type:'monster'}]},
  f=>{f.bot.entity=()=>null}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();edits[i](f);
  assert.equal(f.bot.cavePriestSupport.status().ready,false,'case '+i);
  assert.equal(f.bot.cavePriestSupport.tick(),false);
  assert.equal(moves(f).length,0);
  assert.deepEqual(forbidden(f),[]);
 }
});
test('N12 native can_move_to failure never escalates into smart_move',()=>{
 const f=fixture();f.state.clear=false;
 assert.equal(f.bot.cavePriestSupport.status().ready,true);
 assert.equal(f.bot.cavePriestSupport.tick(),false);
 assert.equal(f.bot.movement.order,null);
 assert.deepEqual(moves(f),[]);
 assert.deepEqual(forbidden(f),[]);
});
test('N12 movement owner refuses generic route, off-floor travel, and unbounded hop',()=>{
 const f=fixture();
 assert.equal(f.bot.movement.local(24,0,'cave-priest'),false);
 assert.equal(f.bot.movement.go({map,x:100,y:0},'cave-priest',()=>true),false);
 assert.equal(f.bot.movement.go({map:'main',x:5,y:0},'cave-priest',()=>true),false);
 assert.deepEqual(moves(f),[]);
 assert.deepEqual(forbidden(f),[]);
});
test('N12 delayed call refuses drift in exact monster, Priest, patient or other Ranger',()=>{
 const changes=[
  f=>{f.m.target='R2'},
  f=>{f.m.hp-=1},
  f=>{f.m.id='replacement'},
  f=>{f.m.x+=3},
  f=>{f.m.range+=4},
  f=>{f.m.mtype='unknown'},
  f=>{f.p.G.monsters.spider.attack*=2},
  f=>{f.p.G.monsters.spider.frequency*=2},
  f=>{f.r1.threats=0},
  f=>{f.observed.R1.x-=5},
  f=>{f.observed.R1.hp=68;f.r1.hp=68},
  f=>{f.r2.x+=7;f.observed.R2.x+=7},
  f=>{f.c.hp-=1},
  f=>{f.c.mp-=1},
  f=>{f.c.x+=2},
  f=>{f.c.cave.run=otherRun},
  f=>{f.state.at=at+3001},
  f=>{f.state.clear=false},
  f=>{f.bot.monsters=()=>[f.m,{id:'another',map,in:map,hp:100}]},
  f=>{f.bot.journal={kind:'gold'}}
 ];
 for(let i=0;i<changes.length;i++){
  const f=fixture();f.bot.exec.beginFrame();
  assert.equal(f.bot.cavePriestSupport.tick(),true,'preaccepted '+i);
  assert.equal(moves(f).length,0);
  changes[i](f);f.bot.exec.flush();
  assert.equal(moves(f).length,0,'stale Priest move '+i);
  assert.deepEqual(forbidden(f),[]);
 }
});
test('N12 Farmer respects real heal priority before moving Priest',()=>{
 const f=fixture();
 f.bot.cavePriest={tick:()=>true};
 f.bot.skills={rotation:()=>{throw Error('overworld skill forbidden')}};
 f.bot.caveCombat={tick:()=>{throw Error('should not fight')}};
 createFarmer(f.bot).tick();
 assert.equal(moves(f).length,0);
 assert.equal(f.bot.reason,'Cave: gezielte Priest-Heilung angefordert');
});
test('N12 Farmer runs safe Priest support after unavailable heal, never regular movement',()=>{
 const f=fixture();
 f.bot.cavePriest={tick:()=>false};
 f.bot.caveCombat={tick:()=>{throw Error('Priest must not attack')}};
 f.bot.skills={rotation:()=>{throw Error('no overworld farming')}};
 createFarmer(f.bot).tick();
 assert.equal(moves(f).length,1);
 assert.equal(f.bot.target,null);
 assert.equal(f.bot.reason,'Cave: Priest sichert Heilerreichweite per Direktschritt');
 assert.deepEqual(forbidden(f),[]);
});
test('N12 Farmer cancels ongoing support movement on disappearing mob or healer invalidation',()=>{
 const f=fixture();
 f.bot.cavePriest={tick:()=>false};
 f.bot.caveCombat={tick:()=>false};
 f.bot.skills={rotation:()=>{throw Error('no overworld skills')}};
 assert.equal(f.bot.cavePriestSupport.tick(),true);
 assert.equal(f.bot.movement.order.owner,'cave-priest');
 f.state.monsters=false;
 createFarmer(f.bot).tick();
 assert.equal(f.bot.movement.order,null);
 assert.equal(moves(f).length,1);
 assert.ok(f.calls.some(([method])=>method==='stop'));
});
test('N12 in-progress support step is not replaced by another Cave action',()=>{
 const f=fixture();
 f.bot.cavePriest={tick:()=>false};
 f.bot.caveCombat={tick:()=>{throw Error('do not attack during support hop')}};
 f.bot.caveEmergency={tick:()=>{throw Error('do not activate Ranger evade')}};
 f.bot.caveDirect={tick:()=>{throw Error('no second Cave movement')}};
 f.bot.skills={rotation:()=>{throw Error('no normal skills')}};
 assert.equal(f.bot.cavePriestSupport.tick(),true);
 createFarmer(f.bot).tick();
 assert.equal(moves(f).length,1);
 assert.equal(f.bot.reason,'Cave: Priest sichert Heilerreichweite per Direktschritt');
});
