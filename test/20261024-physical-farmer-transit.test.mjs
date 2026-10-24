import test from 'node:test';
import assert from 'node:assert/strict';
import {farmerTransitAdmission,mapHasNaturalAggro} from '../src/world/farmer-transit-admission.mjs';
import {createMovement} from '../src/core/movement.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';

const rect=(map,type,a,b,c,d)=>({type,count:5,
 boundaries:[[map,a,b,c,d]]});
const fixture=()=>({
 monsters:{
  prat:{aggro:1,attack:320,frequency:1.6,lifesteal:120},
  bee:{aggro:0,attack:25,frequency:1},
  cgoo:{aggro:0,attack:25,frequency:1}
 },
 maps:{
  main:{monsters:[rect('main','bee',500,500,550,550)],
   doors:[[10,10,10,10,'level1',0]],spawns:[[0,0]]},
  level1:{monsters:[rect('level1','prat',-86,17,64,212),
    rect('level1','prat',-308,629,0,762)],
   doors:[[1,1,1,1,'main',0],[1,1,1,1,'level2s',0]],spawns:[[0,0]]},
  level2s:{monsters:[rect('level2s','cgoo',0,0,100,100)],
   doors:[[1,1,1,1,'level1',0]],spawns:[[0,0]]}
 }
});
const a=(G,from,to,options={})=>farmerTransitAdmission(
 from,to,G,{canMove:()=>true,...options});
const hero=(map='main',x=0,y=0)=>({name:'My_Ranger1',ctype:'ranger',
 map,in:map,x,y,hp:4000,max_hp:4000,speed:45,moving:false});

test('official level1 prat corridor is never a certified cross-map farm route',()=>{
 const G=fixture(),c=hero();
 for(const destination of [
  {map:'level2s',in:'level2s',x:50,y:50},
  {map:'level1',in:'level1',x:-200,y:700},
  {map:'main',in:'wrong-instance',x:25,y:50}
 ])assert.equal(a(G,c,destination).allowed,false);
 G.maps.main.doors.push([10,10,10,10,'level2s',0]);
 assert.equal(a(G,c,{map:'level2s',in:'level2s',x:50,y:50}).allowed,false,
  'even an apparently clean direct portal is not a physical route certificate');
});

test('full direct segment crossing both prat spawn rectangles is rejected',()=>{
 const G=fixture();
 const c=hero('level1',-390,580);
 const through={map:'level1',in:'level1',x:100,y:820};
 const denied=a(G,c,through);
 assert.equal(denied.allowed,false);
 assert.match(denied.reason,/hostile/);
 // Endpoints themselves can be outside; it is the full segment that matters.
 const top=hero('level1',0,-120);
 const crossing={map:'level1',in:'level1',x:0,y:370};
 assert.equal(a(G,top,crossing).allowed,false);
});

test('nearby safe direct steps work without blocking all ordinary farm movement',()=>{
 const G=fixture(),c=hero();
 const good={map:'main',in:'main',x:80,y:0};
 assert.equal(a(G,c,good).allowed,true);
 assert.equal(a(G,c,good,{canMove:()=>false}).allowed,false);
 assert.equal(a(G,c,{...good,map:'unknown'}).allowed,false);
});

test('already exposed farmers may take only bounded monotonically safer escape steps',()=>{
 const G=fixture();
 const c=hero('level1',-150,700);
 assert.equal(mapHasNaturalAggro(G,'level1'),true);
 assert.equal(a(G,c,{map:'level1',in:'level1',x:-150,y:750}).allowed,true);
 assert.equal(a(G,c,{map:'level1',in:'level1',x:-150,y:650}).allowed,false);
 assert.equal(a(G,c,{map:'level1',in:'level1',x:-150,y:900}).allowed,false,
  'a nominal escape cannot be a 200-unit unverified dash');
});

test('unknown aggressive-spawn geometry and incomplete definitions fail closed',()=>{
 const G=fixture(),c=hero();
 G.maps.main.monsters=[{type:'unknown'}];
 assert.equal(a(G,c,{map:'main',in:'main',x:10,y:10}).allowed,false);
 G.maps.main.monsters=[{type:'prat',count:1}];
 assert.equal(a(G,c,{map:'main',in:'main',x:10,y:10}).allowed,false);
});

test('live roaming aggressor blocks a physically direct path even off its spawn',()=>{
 const G=fixture(),c=hero();
 const bad={map:'main',in:'main',x:300,y:0};
 const mob={id:'monster1',type:'monster',mtype:'prat',map:'main',
  x:150,y:0,hp:1000,range:40};
 assert.equal(a(G,c,bad,{liveMonsters:[mob]}).allowed,false);
 assert.equal(a(G,c,bad,{liveMonsters:[{...mob,dead:true}]}).allowed,true);
});

function harness(){
 const G=fixture(),c=hero(),calls=[],events=[],pending=new Map();
 const p={c,G,root:{},parent:{},has:()=>true,
  call:(method,...args)=>{
   calls.push([method,...args]);
   if(method==='can_move_to')return true;
   if(method==='move'||method==='stop')return Promise.resolve(true);
   return false;
  }};
 const exec={pending,busy:()=>false,cancelResource:()=>{},
  run:(name,resources,admission,invoke)=>{
   if(!admission())return false;
   invoke();return true;
  }};
 const bot={p,exec,running:true,session:'regression',me:{role:'farmer'},
  cfg:{world:{excludedMaps:[]},farming:{pvp:false},party:{},merchant:{}},
  monsters:()=>[],teamNames:[c.name],event:(...args)=>events.push(args)};
 bot.movement=createMovement(bot);
 return {bot,c,G,calls,events};
}

test('all farmer movement owners reject unproven cross-map paths before native API call',()=>{
 const {bot,calls}=harness();
 for(const owner of ['farm','follow','regroup','quest','quest-escort',
  'combat','kite','cohesion','world','economy']){
  bot.movement.go({map:'level2s',in:'level2s',x:40,y:50},owner);
  assert.equal(bot.movement.order,null,owner);
 }
 assert.equal(calls.some(([m])=>m==='smart_move'||m==='move'),false);
});

test('farmer can move directly on main, but never falls through to smart_move',()=>{
 const {bot,calls}=harness();
 bot.movement.go({map:'main',in:'main',x:60,y:0},'farm');
 assert.equal(bot.movement.order?.owner,'farm');
 assert.equal(bot.movement.order?.mode,'move');
 assert.equal(calls.some(([method])=>method==='smart_move'),false);
 bot.movement.stop();
});

test('mid-route arrival of a live prat interrupts an active route',()=>{
 const {bot,c,G,calls,events}=harness();
 let monsters=[];
 bot.monsters=()=>monsters;
 bot.movement.go({map:'main',in:'main',x:300,y:0},'follow');
 assert.equal(bot.movement.order?.owner,'follow');
 monsters=[{id:'prat1',type:'monster',mtype:'prat',map:'main',
  x:150,y:0,hp:9200}];
 bot.movement.poll();
 assert.equal(bot.movement.order,null);
 assert.ok(calls.some(([method,channel])=>method==='stop'&&channel==='move'));
 assert.ok(events.some(([name])=>name==='movement.farmerTransitStopped'));
});

test('foreign native movement without an ALBot order is halted',()=>{
 const {bot,c,calls}=harness();
 c.moving=true;
 bot.movement.poll();
 assert.ok(calls.some(([method,channel])=>method==='stop'&&channel==='move'));
});

test('death inside prat map halts even when plan and movement ownership disappeared',()=>{
 const G=fixture(),c={...hero('level1',-129,761),rip:true,hp:0,
  items:[],max_mp:1000,mp:0};
 const orders=[],events=[];
 const bot={
  p:{c,G,realm:()=> 'EUII'},
  cfg:{farming:{respawn:true,respawnDelayMs:0,
    deathWindowMs:600000,maxDeaths:5},party:{enabled:true}},
  me:{name:c.name,role:'farmer'},
  teamPlan:{heartbeat:()=>null},
  strategy:{failActivity:()=>orders.push('failed')},
  movement:{order:null,stop:()=>orders.push('stop')},
  logistics:{handoffActive:false},gold:{reserved:false},journal:null,
  monsters:()=>[],exec:{run:()=>orders.push('respawn')},
  event:(...args)=>events.push(args),
  pause:why=>orders.push(['paused',why])
 };
 createFarmer(bot).tick();
 assert.equal(orders.includes('respawn'),false);
 assert.ok(orders.some(x=>Array.isArray(x)&&x[0]==='paused'));
 assert.ok(events.some(([name])=>name==='combat.fatalTransitStop'));
});
