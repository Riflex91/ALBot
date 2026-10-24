import test from 'node:test';
import assert from 'node:assert/strict';
import {findLocalSafePath,planHazardItinerary,segmentThreatFree,
 threatRegions} from '../src/world/hazard-itinerary.mjs';
import {createMovement} from '../src/core/movement.mjs';
import {createHazardTravel} from '../src/world/hazard-travel.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';
const here=(map,x,y)=>({map,x,y});
const pack=(type,boundary)=>({type,boundary,count:5,grow:true});
function world(){
 return {
  monsters:{
   prat:{aggro:1,attack:320,speed:12,range:32,frequency:1.6},
   fireroamer:{aggro:1,attack:350,speed:30,range:32},
   cgoo:{aggro:.1,attack:320,speed:9,range:64},
   bee:{aggro:1,attack:16,speed:12,range:20}
  },
  npcs:{transporter:{places:{desertland:1,main:0}}},
  maps:{
   main:{monsters:[],spawns:[[0,0],[0,0]],npcs:[{
    id:'transporter',position:[0,0]}],
    doors:[[0,0,20,20,'level1',1,0]]},
   level1:{monsters:[pack('prat',[-86,17,64,212]),
    pack('prat',[-308,629,0,762])],
    spawns:[[149,87],[0,9],[-408,-258],[-863,89],[-327,511]],
    doors:[[0,-4,20,50,'main',0,1],
     [-313,544,24,24,'level2',1,4]],npcs:[]},
   level2:{monsters:[],spawns:[[39,177],[1,-5],[-87,256]],
    doors:[[0,-20,20,50,'level1',4,1],
     [-87,300,80,40,'level2s',0,2]],npcs:[]},
   level2s:{monsters:[pack('cgoo',[-52.5,359.33,120.29,646.25])],
    spawns:[[0,-14],[-240,681]],npcs:[],
    doors:[[-240,668,20,50,'desertland',2,1]]},
   desertland:{monsters:[pack('fireroamer',[300,-100,600,100])],
    spawns:[[0,0],[0,-380],[1000,0]],npcs:[{id:'transporter',position:[0,-380]}],
    doors:[[1000,0,40,40,'level2s',1,2]]}
  }
 };
}
const clear=()=>true;
test('official prat rectangles block endpoints AND straight line through a monster zone',()=>{
 const g=world(),regions=threatRegions(g,'level1');
 assert.equal(regions.ok,true);
 assert.equal(segmentThreatFree(regions,here('level1',-390,700),
  here('level1',130,700)),false);
 assert.equal(segmentThreatFree(regions,here('level1',-390,0),
  here('level1',-390,-100)),true);
});
test('bounded spatial search finds a geometry-checked detour, not endpoint-only clearance',()=>{
 const g=world(),t=threatRegions(g,'desertland');
 const from=here('desertland',0,-380),to=here('desertland',1000,0);
 const path=findLocalSafePath('desertland',from,to,t,clear,{step:90,maxNodes:1300});
 assert.equal(path.ok,true,JSON.stringify(path));
 assert.ok(path.points.length>1);
 let prev=from;
 for(const p of path.points){
  assert.equal(segmentThreatFree(t,prev,p),true);
  prev=p;
 }
 assert.equal(path.points.at(-1).x,to.x);
});
test('planner chooses public transporter into desertland, not lethal level1 shortcut',()=>{
 const g=world();
 const route=planHazardItinerary(g,here('main',0,0),
  here('level2s',-240,681),clear,{maxStates:54,maxNodes:1300});
 assert.equal(route.ok,true,JSON.stringify(route));
 assert.deepEqual(route.maps,['main','desertland','level2s']);
 assert.equal(route.steps.filter(x=>x.type==='transport').length,2);
 assert.equal(route.steps[0].type,'transport');
 assert.ok(route.steps.some(x=>x.type==='move'&&x.map==='desertland'));
 assert.equal(route.steps.some(x=>x.map==='level1'),false);
});
test('changing only portal distance cannot override a blocked physical landing',()=>{
 const g=world();
 delete g.npcs.transporter.places.desertland;
 const route=planHazardItinerary(g,here('main',0,0),
  here('level2s',-240,681),clear);
 assert.equal(route.ok,false);
 assert.match(route.reason,/route|budget/);
});
test('no native arbitrary-map collision oracle means no certified cross-map travel',()=>{
 const g=world();
 const route=planHazardItinerary(g,here('main',0,0),
  here('level2s',-240,681),()=>false,{maxNodes:75});
 assert.equal(route.ok,false);
});
test('live roaming enemies cannot be assumed to remain at static spawn',()=>{
 const g=world(),character=here('main',0,0),to=here('main',400,0);
 const regions=threatRegions(g,'main',[{
  map:'main',x:200,y:0,mtype:'prat',hp:9200,dead:false
 }]);
 assert.equal(segmentThreatFree(regions,character,to),false);
 assert.equal(segmentThreatFree(threatRegions(g,'main'),character,to),true);
});
test('unknown aggressive spawn shape must not become an implicitly empty safe area',()=>{
 const g=world();
 g.maps.main.monsters=[{type:'prat',count:5,random:true}];
 assert.deepEqual(threatRegions(g,'main').ok,false);
 assert.equal(planHazardItinerary(g,here('main',0,0),
  here('desertland',0,-380),clear).ok,false);
});
test('unsafe destination farm center is not misclassified as safe transport arrival',()=>{
 const g=world();
 const attempt=planHazardItinerary(g,here('main',0,0),
  here('level2s',40,500),clear);
 assert.equal(attempt.ok,false);
});
function runtimeHarness(){
 const g=world(),c={map:'main',in:'main',x:0,y:0,hp:5000,
  name:'My_Ranger1',ctype:'ranger',base:{h:8,v:8},moving:false};
 const events=[],commands=[];
 const p={c,G:g,has:(x)=>['can_move','can_move_to','move','transport','stop','town'].includes(x),
  call:(name,...args)=>{
   commands.push([name,...args]);
   if(name==='can_move'||name==='can_move_to')return true;
   if(name==='move'){
    c.x=args[0];c.y=args[1];return Promise.resolve({success:true});
   }
   if(name==='transport'){
    c.map=c.in=args[0];
    const spawn=g.maps[args[0]].spawns[args[1]];
    c.x=spawn[0];c.y=spawn[1];return Promise.resolve({success:true});
   }
   return Promise.resolve({success:true});
  }};
 const exec={pending:new Map(),busy:()=>false,cancelResource:()=>{},
  run:(name,resources,guard,invoke,options)=>{
   if(!guard())return false;
   invoke();
   if(options.observe?.()===true)options.onSettle?.('confirmed');
   return true;
  }};
 const bot={p,exec,session:'regression',running:true,me:{role:'farmer'},
  cfg:{world:{excludedMaps:[]},farming:{pvp:false},party:{},merchant:{}},
  monsters:()=>[],event:(...e)=>events.push(e),teamNames:[c.name]};
 bot.movement=createMovement(bot);
 return {bot,c,p,commands,events};
}
test('physical itinerary executes live verified portals without one smart_move call',()=>{
 const {bot,c,commands,events}=runtimeHarness();
 const goal={map:'level2s',in:'level2s',x:-240,y:681,radius:18};
 assert.equal(bot.movement.go(goal,'farm'),true);
 for(let i=0;i<75&&bot.movement.order;i++)bot.movement.poll();
 assert.equal(c.map,'level2s');
 assert.equal(c.x,-240);assert.equal(c.y,681);
 assert.equal(bot.movement.order,null);
 assert.equal(commands.some(c=>c[0]==='smart_move'),false);
 assert.equal(commands.filter(c=>c[0]==='transport').length,2);
 assert.ok(events.some(e=>e[0]==='travel.hazardArrived'));
});
test('a new follower destination cannot overwrite an active committed farm trip',()=>{
 const {bot,c,commands}=runtimeHarness();
 const goal={map:'level2s',x:-240,y:681,radius:18};
 assert.equal(bot.movement.go(goal,'farm'),true);
 assert.equal(bot.movement.order?.owner,'farm');
 assert.equal(bot.movement.go({map:'level1',x:0,y:9},'follow'),false);
 assert.equal(bot.movement.order?.dest.map,'level2s');
 assert.equal(commands.filter(c=>c[0]==='smart_move').length,0);
});

test('real official desertland fireroamer range 280 makes transporter arrival unverified',()=>{
 const g=world();
 // These are the official 2026-10-24 server-data values and rectangles,
 // not the simplified clear-corridor fixture used above.
 g.monsters.fireroamer={aggro:.2,attack:320,speed:24,
   range:280,frequency:1.2};
 g.monsters.plantoid={aggro:.2,attack:640,speed:20,range:80};
 g.monsters.porcupine={aggro:1,attack:16,speed:10,range:20};
 g.monsters.ent={aggro:.2,attack:3600,speed:12,range:64};
 g.monsters.gscorpion={aggro:.3,attack:120,speed:24,range:32};
 g.monsters.bscorpion={aggro:.8,attack:3200,speed:24,range:32};
 g.maps.desertland={
  monsters:[
   pack('plantoid',[-1013,-472,-575,-130]),
   pack('plantoid',[-1013,-624,-762,-137]),
   pack('porcupine',[-992,-58,-666,328]),
   pack('ent',[-757,-2034,-70,-1888]),
   pack('fireroamer',[91,-952,353,-702]),
   pack('fireroamer',[161,-868,453,-697]),
   pack('gscorpion',[220.31,-1569.2,561.04,-1275.72]),
   pack('bscorpion',[-522.44,-1340.19,-295.2,-1183.31])
  ],
  spawns:[[0,0],[10,-386],[601,-2365]],npcs:[
   {id:'transporter',position:[-14,-477]}],
  doors:[[600,-2383,40,40,'level2s',1,2]]
 };
 const arrival=here('desertland',10,-386);
 const r=threatRegions(g,'desertland');
 assert.equal(segmentThreatFree(r,arrival,arrival),false,
  'real fireroamer may hit close enough to the official transport spawn');
 assert.equal(segmentThreatFree(threatRegions(g,'level1'),
  here('level1',0,9),here('level1',0,9)),false,
  'official underground arrival likewise is near prat');
 const plan=planHazardItinerary(g,here('main',0,0),
  here('level2s',-240,681),clear);
 assert.equal(plan.ok,false,
  'neither unsafe portal landing may be silently treated as safe');
});
test('revoking transporter permissions before departure aborts the itinerary',()=>{
 const {bot,c,p,commands,events}=runtimeHarness();
 // Force delayed acknowledgement for transport without a fake new_map.
 const oldCall=p.call;p.call=(name,...args)=>{
  if(name==='transport'){commands.push([name,...args]);
   return Promise.resolve({success:false,in_progress:true});}
  return oldCall(name,...args);
 };
 const originalRun=bot.exec.run;
 let queued=null;
 bot.exec.run=(name,resources,guard,invoke,options)=>{
  if(!guard())return false;
  queued={name,resources,guard,invoke,options};
  return true;
 };
 const goal={map:'level2s',x:-240,y:681,radius:18};
 assert.equal(bot.movement.go(goal,'farm'),true);
 assert.equal(queued?.name,'travel.hazard');
 // The portal decision was made at plan time, but the official world
 // changes before the queued executor dispatch.
 delete p.G.npcs.transporter.places.desertland;
 assert.equal(queued.guard(),false);
 assert.equal(commands.some(q=>q[0]==='transport'),false);
});

test('new roaming aggressive monster interrupts an already dispatched native move',()=>{
 const g=world();
 const c={name:'My_Ranger1',map:'desertland',in:'desertland',
  x:0,y:-380,hp:5000,base:{h:8,v:8},moving:true};
 let live=[],commands=[];
 const p={c,G:g,has:()=>true,
  call:(method,...args)=>{
   commands.push([method,...args]);
   if(method==='can_move'||method==='can_move_to')return true;
   return Promise.resolve({success:true});
  }};
 const exec={pending:new Map(),
  busy:(r)=>[...exec.pending.values()].some(v=>v.resources.includes(r)),
  cancelResource:(r)=>{for(const [key,v] of exec.pending)
   if(v.resources.includes(r))exec.pending.delete(key);},
  run:(key,resources,guard,invoke,options)=>{
   if(!guard())return false;
   exec.pending.set(key,{resources,options});
   invoke();return true;
  }};
 const events=[],bot={p,exec,session:'threat-replan',running:true,
  cfg:{world:{excludedMaps:[]}},monsters:()=>live,
  event:(...e)=>events.push(e)};
 const nav=createHazardTravel(bot);
 assert.equal(nav.start({map:'desertland',x:1000,y:0,radius:15},'farm'),true);
 const first=nav.session().steps[0];
 assert.equal(first.type,'move');
 nav.poll();
 assert.equal(exec.pending.has('travel.hazard'),true);
 live=[{id:'prat-threat',type:'monster',mtype:'prat',hp:9200,
  map:'desertland',x:(c.x+first.x)/2,y:(c.y+first.y)/2}];
 nav.poll();
 assert.equal(nav.active,false,'unsafe in-flight route must not finish');
 assert.equal(exec.pending.size,0);
 assert.ok(commands.some(x=>x[0]==='stop'&&x[1]==='move'));
 assert.ok(events.some(x=>x[0]==='travel.hazardAborted'));
});

test('prat death halts automatic respawn even after movement and farm plan disappear',()=>{
 const g=world(),c={name:'My_Priest',ctype:'priest',rip:true,hp:0,
  map:'level1',in:'level1',x:-129,y:761,items:[],mp:0,max_mp:2000};
 const actions=[],events=[];
 const bot={
  p:{c,G:g,realm:()=> 'EUII'},
  cfg:{farming:{respawn:true,respawnDelayMs:0,deathWindowMs:600000,
   maxDeaths:5},party:{enabled:true}},
  me:{role:'farmer',name:c.name},
  movement:{order:null,stop:()=>actions.push('stop')},
  teamPlan:{heartbeat:()=>null},
  strategy:{failActivity:()=>actions.push('failed')},
  logistics:{handoffActive:false},gold:{reserved:false},
  journal:null,monsters:()=>[],exec:{run:()=>actions.push('respawn')},
  event:(...e)=>events.push(e),
  pause:reason=>actions.push(['pause',reason])
 };
 createFarmer(bot).tick();
 assert.equal(actions.includes('respawn'),false);
 assert.ok(actions.some(a=>Array.isArray(a)&&a[0]==='pause'));
 assert.ok(events.some(e=>e[0]==='combat.fatalTransitHalt'));
});
