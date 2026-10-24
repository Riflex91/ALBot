import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovement} from '../src/core/movement.mjs';
import {createStrategy} from '../src/world/strategy.mjs';
import {Executor} from '../src/core/executor.mjs';

const npc={map:'main',in:'main',x:-35,y:-162,radius:60};
function fixture({owner='quest',x=1500,speed=50,monsters=[],hasTown=true,spawns=[[0,0]],townActive=false,merchantTown=true}={}){
 const calls=[],events=[],c={name:'My_Ranger1',map:'main',in:'main',x,y:0,speed,moving:false,c:{town:townActive}};
 const bot={running:true,me:{name:c.name,role:'farmer'},cfg:{
   merchant:{townTravel:merchantTown,townMinSavingsMs:3000},
   world:{excludedMaps:[]},farming:{pvp:false}
  },monsters:()=>monsters,event:(type,data)=>events.push({type,...data})};
 bot.p={c,root:{},parent:{},G:{maps:{main:{spawns}}},
  has:name=>name!=='town'||hasTown,
  call:(name,...args)=>{calls.push({name,args});if(name==='can_move_to')return false;return Promise.resolve();}};
 bot.exec=new Executor({now:()=>Date.now(),active:()=>bot.running,limit:4,onError(){}});
 return {bot,c,calls,events,movement:createMovement(bot),owner};
}

test('remote monsterhunt NPC: farmer compares routes and chooses faster verified Town channel',async()=>{
 const previous=Date.now;let now=40000;Date.now=()=>now;
 try{
  const {bot,c,calls,events,movement,owner}=fixture();
  assert.equal(movement.go(npc,owner),false,'queued teleport is asynchronous');
  assert.deepEqual(calls.map(x=>x.name),['town']);
  assert.equal(movement.order,null,'do not also enqueue a competing walk');
  assert.ok(bot.exec.pending.has('travel.town'));
  assert.ok(events.some(e=>e.type==='travel.compare'&&e.owner==='quest'&&e.savedMs>3000));
  assert.ok(events.some(e=>e.type==='travel.town'&&e.owner==='quest'));
  assert.equal(movement.go(npc,owner),false,'do not launch a walk while teleport is pending');
  await Promise.resolve();bot.exec.poll();
  c.x=0;c.y=0;bot.exec.poll();
  assert.equal(bot.exec.pending.has('travel.town'),false);
  assert.equal(calls.filter(x=>x.name==='town').length,1);
  assert.equal(movement.go(npc,owner),false,'remainder still uses ordinary movement');
  assert.equal(movement.order?.owner,'quest');
  assert.equal(movement.order?.mode,'smart_move');
  assert.equal(calls.filter(x=>x.name==='town').length,1);
 }finally{Date.now=previous;}
});

test('short monsterhunt NPC trip stays on foot when Town would save less than threshold',()=>{
 const previous=Date.now;Date.now=()=>40000;
 try{
  const f=fixture({x:180});f.movement.go({...npc,x:320,y:0},'quest');
  assert.equal(f.movement.order?.owner,'quest');
  assert.equal(f.calls.some(x=>x.name==='town'),false);
  const estimate=f.events.find(e=>e.type==='travel.compare');
  assert.ok(estimate&&estimate.savedMs<estimate.threshold);
  f.movement.stop();
 }finally{Date.now=previous;}
});

test('farmer Town shortcut permits measured farm/follower trips, never combat or unrelated movement',()=>{
 const previous=Date.now;Date.now=()=>40000;
 try{
  for(const owner of ['farm','follow','quest-escort','regroup']){
   const f=fixture({owner});f.movement.go(npc,owner);
   assert.equal(f.calls.some(x=>x.name==='town'),true,owner);
   assert.equal(f.movement.order,null,owner);
   f.movement.stop();
  }
  for(const owner of ['combat','world','cohesion','logistics','economy','kite']){
   const f=fixture({owner});f.movement.go(npc,owner);
   assert.equal(f.calls.some(x=>x.name==='town'),false,owner);
   assert.equal(f.movement.order?.mode,'smart_move',owner);
   f.movement.stop();
  }
 }finally{Date.now=previous;}
});

test('farmer quest shortcut fails closed on threat, unavailable Town API, channel in progress or absent map spawn',()=>{
 const previous=Date.now;Date.now=()=>40000;
 try{
  const scenarios=[
   {monsters:[{target:'My_Ranger1'}]},
   {hasTown:false},
   {townActive:true},
   {spawns:[]}
  ];
  for(const input of scenarios){
   const f=fixture(input);f.movement.go(npc,'quest');
   assert.equal(f.calls.some(x=>x.name==='town'),false,JSON.stringify(input));
   assert.equal(f.movement.order?.mode,'smart_move');
   f.movement.stop();
  }
 }finally{Date.now=previous;}
});

test('Farmer Town remains independent of Merchant-only preference, while Merchant route is unchanged',()=>{
 const previous=Date.now;Date.now=()=>40000;
 try{
  const f=fixture({merchantTown:false});
  f.movement.go(npc,'quest');
  assert.equal(f.calls.filter(x=>x.name==='town').length,1);
  f.movement.stop();
  const m=fixture({merchantTown:false});
  m.bot.me.role='merchant';
  m.movement.go(npc,'economy');
  assert.equal(m.calls.some(x=>x.name==='town'),false);
  assert.equal(m.movement.order?.mode,'smart_move');
  m.movement.stop();
 }finally{Date.now=previous;}
});

test('threat interrupt cancels a pending monsterhunt Town channel as well as walking',()=>{
 const stops=[],events=[];
 const c={name:'My_Ranger1',s:{},map:'main'};
 const p={c,G:{maps:{main:{}}},root:{},parent:{},has:()=>true,read:()=>null};
 const movement={townActive:false,order:null,stop:()=>stops.push('stop'),
   go:(d,owner)=>{events.push([owner,d]);return false;}};
 const bot={p,me:{name:c.name,role:'farmer',farmTargets:[]},cfg:{
   general:{testLogging:true},world:{quests:true,questTargets:true,excludedMaps:[]},
   party:{enabled:false},farming:{}
  },running:true,leader:c.name,farmers:[c.name],journal:null,
  logistics:{reserved:false},movement,
  economy:{destination:id=>id==='monsterhunter'?npc:null,at:()=>false},
  event:(...args)=>events.push(args),
  teamPlan:{materialActive:()=>false,orderedHunt:()=>null}};
 const strategy=createStrategy(bot);
 assert.equal(strategy.quest(),true);
 assert.equal(strategy.busy,true);
 assert.equal(stops.length,1,'first stop cancels previous travel before quest');
 movement.townActive=true;
 strategy.interruptQuest();
 assert.equal(strategy.busy,false);
 assert.equal(stops.length,2,'queued Town must be stopped on new aggro');
 assert.ok(events.some(x=>x[0]==='quest.interrupted'));
});


test('Priest Monsterhunt quest travel cannot be hijacked by ordinary follower movement',()=>{
 const previous=Date.now;Date.now=()=>40000;
 try{
  const f=fixture();f.bot.strategy={busy:true};
  for(const owner of ['follow','farm','world','cohesion','quest-escort','economy','logistics']){
   assert.equal(f.movement.go(npc,owner),false,owner);
   assert.equal(f.movement.order,null,owner);
  }
  assert.equal(f.calls.length,0,'no follower travel or Town call before quest');
  f.movement.go(npc,'quest');
  assert.equal(f.calls.filter(x=>x.name==='town').length,1,'quest retains Town shortcut');
  assert.equal(f.movement.go(npc,'follow'),false,'follow cannot queue during Town');
  assert.equal(f.calls.filter(x=>x.name==='town').length,1,'no duplicate Town');
  f.movement.stop();
  const foot=fixture({x:180,spawns:[]});foot.bot.strategy={busy:true};
  foot.movement.go({...npc,x:320,y:0},'quest');
  assert.equal(foot.movement.order?.owner,'quest','last leg remains quest-owned');
  assert.equal(foot.movement.go(npc,'follow'),false);
  assert.equal(foot.movement.order?.owner,'quest','follow does not supersede quest');
  foot.movement.stop();
  foot.bot.strategy.busy=false;
  foot.movement.go(npc,'follow');
  assert.equal(foot.movement.order?.owner,'follow','follow resumes after quest clears');
  foot.movement.stop();
 }finally{Date.now=previous;}
});


test('cross-map quest uses only verified direct portal-to-main geometry for Town saving',async()=>{
 const previous=Date.now;Date.now=()=>50000;
 try{
  const f=fixture({x:1100,speed:40});
  f.c.map='mansion';f.c.in='mansion';
  f.bot.p.G.maps.mansion={spawns:[[0,0]],doors:[[30,0,30,30,'main',0]]};
  assert.equal(f.movement.go(npc,'quest'),false);
  assert.equal(f.calls.filter(x=>x.name==='town').length,1);
  assert.ok(f.events.some(x=>x.type==='travel.compare'&&x.owner==='quest'));
  await Promise.resolve();f.bot.exec.poll();
  f.c.map='main';f.c.in='main';f.c.x=0;f.c.y=0;f.bot.exec.poll();
  assert.equal(f.bot.exec.pending.has('travel.town'),false);
  f.movement.stop();
  const noPortal=fixture({x:1100,speed:40});
  noPortal.c.map='mansion';noPortal.c.in='mansion';
  noPortal.bot.p.G.maps.mansion={spawns:[[0,0]],doors:[]};
  noPortal.movement.go(npc,'quest');
  assert.equal(noPortal.calls.some(x=>x.name==='town'),false);
  noPortal.movement.stop();
 }finally{Date.now=previous;}
});
