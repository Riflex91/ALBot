import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovement} from '../src/core/movement.mjs';
import {Executor} from '../src/core/executor.mjs';
import {combatApproach} from '../src/combat/farmer.mjs';

test('combat approach uses short reachable steps and actual target coordinates behind obstacles',()=>{
 const c={map:'main',in:'main',real_x:200,real_y:770},target={map:'main',in:'main',real_x:520,real_y:753};
 const direct=combatApproach(c,target,90,()=>true);assert.ok(direct.x>200&&direct.x<261);assert.equal(direct.radius,6);
 const route=combatApproach(c,target,90,()=>false);assert.deepEqual(route,{map:'main',in:'main',x:520,y:753,radius:90});
});

test('rejected movement clears ownership, delays retry and ignores completion of canceled routes',async()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  let reject,stops=0;const events=[],c={map:'main',in:'main',x:0,y:0},bot={running:true,cfg:{world:{excludedMaps:[]},farming:{pvp:false}},event:(...e)=>events.push(e)};
  bot.p={c,G:{maps:{main:{}}},root:{},has:()=>true,call:(name)=>{if(name==='can_move_to')return false;if(name==='stop'){stops++;return Promise.resolve();}return new Promise((_,r)=>reject=r);}};
  bot.exec=new Executor({now:()=>now,active:()=>true,limit:4,onError(){}});const movement=createMovement(bot),dest={map:'main',in:'main',x:520,y:753,radius:90};
  movement.go(dest,'combat');assert.ok(movement.order);reject({reason:'failed'});await Promise.resolve();bot.exec.poll();assert.equal(movement.order,null);assert.equal(stops,1);assert.ok(events.some(([k])=>k==='movement.failed'));
  movement.go(dest,'combat');assert.equal(movement.order,null);now+=3001;movement.go(dest,'combat');const canceledReject=reject;movement.stop();movement.go({...dest,x:600},'combat');const latest=movement.order;
  canceledReject({reason:'interrupted'});await Promise.resolve();bot.exec.poll();assert.equal(movement.order,latest);assert.equal(movement.status().destination.x,600);movement.stop();
 }finally{Date.now=original;}
});

test('merchant chooses faster town while moving and waits for observed arrival',async()=>{const calls=[],events=[],c={name:'M',map:'main',in:'main',x:1500,y:0,speed:50,moving:true,c:{}},bot={running:true,me:{role:'merchant'},cfg:{merchant:{townTravel:true,townMinSavingsMs:3000},world:{excludedMaps:[]},farming:{pvp:false}},monsters:()=>[],event:(type,data)=>events.push({type,...data})};bot.p={c,G:{maps:{main:{spawns:[[0,0]]}}},root:{},has:()=>true,call:(id)=>{calls.push(id);if(id==='stop')c.moving=false;return Promise.resolve();}};bot.exec=new Executor({now:()=>Date.now(),active:()=>true,limit:4,onError(){}});const movement=createMovement(bot);movement.go({map:'main',in:'main',x:-35,y:-162},'economy');assert.deepEqual(calls,['stop','town']);movement.go({map:'main',in:'main',x:-35,y:-162},'economy');assert.deepEqual(calls,['stop','town']);assert.equal(movement.order,null);await Promise.resolve();bot.exec.poll();assert.ok(bot.exec.pending.has('travel.town'));c.x=c.y=0;bot.exec.poll();assert.equal(bot.exec.pending.has('travel.town'),false);assert.ok(events.some(e=>e.type==='travel.compare'&&e.savedMs>3000));});

test('smart_move pending pathfinding is not cancelled by twelve-second position-stall watchdog',()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  const events=[],calls=[],c={name:'A',map:'main',in:'main',x:0,y:0,moving:false};
  const bot={running:true,me:{role:'farmer'},cfg:{world:{excludedMaps:[]},farming:{pvp:false}},event:(...e)=>events.push(e)};
  bot.p={c,root:{},parent:{smart:{searching:true,moving:false}},G:{maps:{main:{}}},has:()=>true,call:(name)=>{
   calls.push(name);if(name==='can_move_to')return false;
   if(name==='smart_move')return new Promise(()=>{});
   if(name==='stop')return Promise.resolve();
  }};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot),dest={map:'main',in:'main',x:520,y:753,radius:90};
  movement.go(dest,'combat');
  assert.equal(movement.order?.mode,'smart_move');
  now+=13000;movement.poll();
  assert.equal(movement.order?.mode,'smart_move','Active pathfinding must keep its movement owner');
  assert.equal(calls.filter(x=>x==='stop').length,0);
  now+=46000;movement.poll();
  assert.ok(movement.order,'Still awaiting native smart_move; no false no-progress abort at 59 seconds');
  assert.ok(!events.some(([kind,data])=>kind==='movement.failed'&&data?.reason==='no_progress'));
  movement.stop();
 }finally{Date.now=original;}
});

test('plain move still aborts after twelve seconds without position change',()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  const calls=[],c={map:'main',in:'main',x:0,y:0},bot={running:true,me:{role:'farmer'},cfg:{world:{excludedMaps:[]},farming:{pvp:false}}};
  bot.p={c,root:{},parent:{},G:{maps:{main:{}}},has:()=>true,call:name=>{
   calls.push(name);if(name==='can_move_to')return true;
   if(name==='move')return new Promise(()=>{});
   if(name==='stop')return Promise.resolve();
  }};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot);
  movement.go({map:'main',in:'main',x:100,y:0,radius:8},'combat');
  assert.equal(movement.order?.mode,'move');
  now+=13000;movement.poll();
  assert.equal(movement.order,null);
  assert.equal(calls.filter(x=>x==='stop').length,1);
 }finally{Date.now=original;}
});

test('merchant town transition stops parent smart_move before invoking town',()=>{
 const original=Date.now;let now=40000;Date.now=()=>now;
 try{
  const calls=[],c={name:'M',map:'main',in:'main',x:1500,y:0,speed:50,moving:false,c:{}};
  const bot={running:true,me:{role:'merchant'},cfg:{merchant:{townTravel:true,townMinSavingsMs:3000},world:{excludedMaps:[]},farming:{pvp:false}},monsters:()=>[]};
  bot.p={c,root:{},parent:{smart:{moving:true,searching:true}},G:{maps:{main:{spawns:[[0,0]]}}},has:()=>true,call:name=>{calls.push(name);return Promise.resolve();}};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot);
  movement.go({map:'main',in:'main',x:-35,y:-162,radius:20},'economy');
  assert.deepEqual(calls,['stop','town'],'Stop active parent smart path before channel travel');
  movement.stop();
 }finally{Date.now=original;}
});

test('smart_move remains bounded by the existing 120-second total travel limit',()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  const events=[],calls=[],c={name:'A',map:'main',in:'main',x:0,y:0,moving:false};
  const bot={running:true,me:{role:'farmer'},cfg:{world:{excludedMaps:[]},farming:{pvp:false}},event:(...args)=>events.push(args)};
  bot.p={c,root:{},parent:{smart:{searching:true}},G:{maps:{main:{}}},has:()=>true,call:name=>{
   calls.push(name);if(name==='can_move_to')return false;
   if(name==='smart_move')return new Promise(()=>{});
   if(name==='stop')return Promise.resolve();
  }};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot);
  movement.go({map:'main',in:'main',x:520,y:753,radius:90},'combat');
  now+=120001;movement.poll();
  assert.equal(movement.order,null,'Bounded smart pathfinding must eventually release the movement owner');
  assert.equal(calls.filter(x=>x==='stop').length,1);
  assert.ok(events.some(([kind,data])=>kind==='movement.failed'&&data.reason==='timeout'));
 }finally{Date.now=original;}
});

test('explicit stop cancels parent-owned searching path even without a local order',()=>{
 const calls=[],c={map:'main',in:'main',x:0,y:0,moving:false};
 const bot={running:true,cfg:{world:{excludedMaps:[]},farming:{pvp:false}}};
 bot.p={c,root:{},parent:{smart:{searching:true,moving:false}},G:{maps:{main:{}}},call:name=>{calls.push(name);return Promise.resolve();}};
 bot.exec=new Executor({now:Date.now,active:()=>true,limit:4,onError(){}});
 createMovement(bot).stop();
 assert.deepEqual(calls,['stop']);
});

test('failed economy smart_move quarantines its destination map for five minutes only',async()=>{
 const original=Date.now;let now=10000;Date.now=()=>now;
 try{
  const events=[],c={name:'M',map:'main',in:'main',x:0,y:0,moving:false};
  const bot={running:true,me:{role:'merchant'},cfg:{merchant:{townTravel:false},world:{excludedMaps:[]},farming:{pvp:false}},event:(...a)=>events.push(a)};
  bot.p={c,root:{},parent:{},G:{maps:{main:{},woffice:{},other:{}}},has:()=>false,call:(kind)=>{
   if(kind==='smart_move')return Promise.reject(new Error('failed'));
   return Promise.resolve();
  }};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const movement=createMovement(bot);
  movement.go({map:'woffice',in:'woffice',x:-170,y:-248},'economy');
  assert.equal(movement.order?.mode,'smart_move');
  await Promise.resolve();await Promise.resolve();bot.exec.poll();
  assert.equal(movement.order,null);
  assert.equal(movement.failedRecently({map:'woffice'}),true);
  assert.equal(movement.failedRecently({map:'other'}),false);
  assert.ok(events.some(([type,e])=>type==='movement.route-quarantined'&&e.map==='woffice'));
  now+=300001;
  assert.equal(movement.failedRecently({map:'woffice'}),false);
 }finally{Date.now=original;}
});

test('merchant gathering skips a rejected smart-route zone and chooses another public zone',async()=>{
 const {createServices}=await import('../src/merchant/services.mjs');
 const polygon=[[-184,-232],[-128,-232],[-128,-184],[-184,-184]];
 const visited=[],notes=[],cfg={merchant:{mining:true,fishing:false,merrit:false,massBuffs:false},general:{economyTickMs:2000},world:{excludedMaps:[]}};
 const c={name:'M',map:'main',in:'main',x:0,y:0,level:60,mp:100,items:[{name:'pickaxe',level:0},...Array(5).fill(null)],slots:{}};
 const movement={failedRecently:region=>region.map==='woffice'};
 const economy={safe:i=>!!i&&i.name==='pickaxe',note:s=>notes.push(s),travel:(dest)=>{visited.push(dest.map);return false;}};
 const bot={cfg,p:{c,G:{maps:{main:{},woffice:{zones:[{type:'mining',polygon}]},other:{zones:[{type:'mining',polygon}]}},skills:{mining:{level:1,mp:5}}},call:()=>false,has:()=>false,read:()=>null},me:{name:'M'},exec:{},economy,movement,monsters:()=>[],strategy:{status:()=>({manual:null})}};
 const services=createServices(bot);
 assert.equal(services.tick(),true);
 assert.deepEqual(visited,['other'],'Failing woffice route must not be retried while another allowed zone exists');
 bot.p.G={maps:{main:{},woffice:{zones:[{type:'mining',polygon}]}},skills:{mining:{level:1,mp:5}}};
 assert.equal(services.tick(),false);
 assert.deepEqual(visited,['other'],'No repeated move toward quarantined woffice');
 assert.ok(notes.some(s=>s.includes('vorübergehend ausgesetzt')));
});

test('merchant services keep a pending mining approach until first post-arrival tool step',async()=>{
 const {createServices}=await import('../src/merchant/services.mjs');
 const polygon=[[0,0],[100,0],[100,100],[0,100]],calls=[];
 const c={name:'M',map:'main',in:'main',x:-100,y:25,level:60,mp:100,items:[{name:'pickaxe',level:0},...Array(5).fill(null)],slots:{}};
 const economy={safe:i=>!!i&&i.name==='pickaxe',note:s=>calls.push(['note',s]),travel:()=>{calls.push(['travel']);return calls.filter(x=>x[0]==='travel').length>1;},perform:key=>{calls.push(['perform',key]);return true;}};
 const bot={cfg:{merchant:{mining:true,fishing:false,merrit:false,massBuffs:false},world:{excludedMaps:[]},general:{economyTickMs:2000}},
  p:{c,G:{maps:{main:{zones:[{type:'mining',polygon}]}},skills:{mining:{level:1,mp:5}}},read:()=>null,write:()=>true,call:()=>false,has:()=>false},
  me:{name:'M'},exec:{},economy,movement:{failedRecently:()=>false},monsters:()=>[],strategy:{status:()=>({manual:null})}};
 const s=createServices(bot);
 assert.equal(s.tick(),true);
 assert.equal(s.approaching,true);
 assert.equal(s.tick(),true);
 assert.equal(s.approaching,false);
 assert.equal(s.status().gathering,'mining');
 assert.ok(calls.some(x=>x[0]==='perform'&&x[1]==='gather.equip'));
});
test('fishing without a rod does not send merchant to inaccessible worksite',async()=>{
 const {createServices}=await import('../src/merchant/services.mjs');
 const polygon=[[0,0],[100,0],[100,100],[0,100]],actions=[];
 const c={name:'M',map:'main',in:'main',x:-100,y:25,level:60,mp:100,items:Array(5).fill(null),slots:{}};
 const bot={cfg:{merchant:{mining:false,fishing:true,merrit:false,massBuffs:false},world:{excludedMaps:[]},general:{economyTickMs:2000}},
  p:{c,G:{maps:{main:{zones:[{type:'fishing',polygon}]}},skills:{fishing:{level:1,mp:5}}},read:()=>null,call:()=>false,has:()=>false},
  me:{name:'M'},exec:{},economy:{safe:()=>true,note:s=>actions.push(['note',s]),travel:()=>actions.push(['travel'])},
  movement:{failedRecently:()=>false},monsters:()=>[],strategy:{status:()=>({manual:null})}};
 const s=createServices(bot);
 assert.equal(s.tick(),false);
 assert.equal(s.approaching,false);
 assert.ok(actions.some(x=>x[0]==='note'&&x[1].includes('rod')));
 assert.ok(!actions.some(x=>x[0]==='travel'));
});

test('merchant failed smart route quarantines only that shoreline waypoint, not the main map',async()=>{
 const old=Date.now;let now=40000;Date.now=()=>now;
 try{
  const events=[],c={name:'Merchant',map:'main',in:'main',x:100,y:100,moving:false};
  const bot={running:true,me:{role:'merchant'},cfg:{merchant:{townTravel:false},world:{excludedMaps:[]},farming:{pvp:false}},event:(...a)=>events.push(a)};
  bot.p={c,root:{},parent:{},G:{maps:{main:{}}},has:()=>false,call:kind=>kind==='smart_move'?Promise.reject(new Error('failed')):Promise.resolve()};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const m=createMovement(bot),blocked={map:'main',in:'main',x:-856,y:-396,radius:5};
  m.go(blocked,'economy');
  await Promise.resolve();await Promise.resolve();bot.exec.poll();
  assert.equal(m.failedRecently(blocked),true,'Failed exact coordinate must be remembered');
  assert.equal(m.failedRecently({...blocked,x:-832}),false,'Adjacent shore must stay available');
  assert.equal(m.failedRecently({map:'main',x:0,y:0}),false,'Bank, NPC and exchange sites must remain routable');
  assert.equal(m.failedRecently({map:'main'}),true,'Map-only legacy diagnostics indicate a failure somewhere');
  assert.ok(events.some(([name,info])=>name==='movement.route-quarantined'&&info.x===-856));
  now+=300001;assert.equal(m.failedRecently(blocked),false,'Waypoint cooldown must expire');
 }finally{Date.now=old;}
});

test('rejected farm smart_move quarantines only the failed waypoint and allows reroute',async()=>{
 const original=Date.now;let now=100000;Date.now=()=>now;
 try{
  const events=[],c={name:'Leader',map:'main',in:'main',x:315,y:95};
  const bot={running:true,me:{role:'farmer'},cfg:{world:{excludedMaps:[]},farming:{pvp:false}},
   event:(...e)=>events.push(e)};
  bot.p={c,root:{},parent:{},G:{maps:{main:{}}},has:()=>true,
   call:kind=>kind==='can_move_to'?false:
    kind==='smart_move'?Promise.reject(new Error('failed')):Promise.resolve()};
  bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});
  const m=createMovement(bot),point={map:'main',in:'main',x:335.186,y:177.968,radius:20};
  m.go(point,'farm');
  assert.equal(m.order?.mode,'smart_move');
  await Promise.resolve();await Promise.resolve();bot.exec.poll();
  assert.equal(m.failedRecently(point,'farm'),true);
  assert.equal(m.failedRecently({...point,x:385},'farm'),false);
  assert.equal(m.failedRecently(point,'economy'),false,
   'Farm failures never blacklist independent merchant work');
  assert.equal(m.failedRecently({map:'main',in:'main',x:546,y:1059},'farm'),false);
  assert.ok(events.some(([name,data])=>name==='movement.route-quarantined'&&data.owner==='farm'));
  now+=300001;
  assert.equal(m.failedRecently(point,'farm'),false);
 }finally{Date.now=original;}
});

test('N05 scout never falls back to smart_move when the final native local check changes',()=>{
 const c={name:'Scout',map:'main',in:'main',x:0,y:0},calls=[];
 let checks=0;
 const bot={running:true,me:{role:'farmer'},cfg:{
  world:{excludedMaps:[]},farming:{pvp:false}}};
 bot.p={c,root:{},parent:{},G:{maps:{main:{}}},
  has:()=>true,call:name=>{
   calls.push(name);
   if(name==='can_move_to')return ++checks===1;
   if(name==='move'||name==='smart_move'||name==='use_skill')
    return new Promise(()=>{});
   return Promise.resolve();
  }};
 bot.exec=new Executor({now:Date.now,active:()=>bot.running,limit:4,onError(){}});
 const movement=createMovement(bot);
 assert.equal(movement.local(70,0,'scout'),false);
 assert.equal(movement.order,null);
 assert.equal(checks,2);
 assert.equal(calls.includes('smart_move'),false);
 assert.equal(calls.includes('move'),false);
 assert.equal(calls.includes('use_skill'),false);
 assert.equal(bot.exec.pending.size,0);
});
test('N05 direct scout movement refuses distant and cross-map destinations without any route',()=>{
 const c={name:'Scout',map:'main',in:'main',x:0,y:0},calls=[];
 const bot={running:true,me:{role:'farmer'},cfg:{
  world:{excludedMaps:[]},farming:{pvp:false}}};
 bot.p={c,root:{},parent:{},G:{maps:{main:{},bank:{}}},
  has:()=>true,call:name=>{calls.push(name);return true;}};
 bot.exec=new Executor({now:Date.now,active:()=>bot.running,limit:4,onError(){}});
 const m=createMovement(bot);
 assert.equal(m.go({map:'main',in:'main',x:96,y:0},'scout'),false);
 assert.equal(m.go({map:'bank',in:'bank',x:60,y:0},'scout'),false);
 assert.equal(m.go({map:'main',in:'other',x:60,y:0},'scout'),false);
 assert.equal(m.order,null);
 assert.deepEqual(calls,[]);
});
test('N05 admitted scout selects only native move, preserving other owners smart-route fallback',()=>{
 const c={name:'Scout',map:'main',in:'main',x:0,y:0},calls=[];
 let allowed=true;
 const bot={running:true,me:{role:'farmer'},cfg:{
  world:{excludedMaps:[]},farming:{pvp:false}}};
 bot.p={c,root:{},parent:{},G:{maps:{main:{}}},
  has:()=>true,call:name=>{
   calls.push(name);
   if(name==='can_move_to')return allowed;
   if(name==='move'||name==='smart_move'||name==='use_skill')
    return new Promise(()=>{});
   return Promise.resolve();
  }};
 bot.exec=new Executor({now:Date.now,active:()=>bot.running,limit:4,onError(){}});
 const m=createMovement(bot),dest={map:'main',in:'main',x:65,y:0,radius:8};
 assert.equal(m.go(dest,'scout'),true);
 assert.equal(m.order?.mode,'move');
 assert.equal(calls.includes('smart_move'),false);
 assert.equal(calls.includes('use_skill'),false);
 m.stop();allowed=false;
 assert.equal(m.go({...dest,x:70},'farm'),true);
 assert.equal(m.order?.mode,'smart_move','existing approved farm routing remains untouched');
 m.stop();
});
