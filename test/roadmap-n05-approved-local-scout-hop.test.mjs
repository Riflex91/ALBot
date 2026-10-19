import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedLocalScoutHop,insideScoutFarmBoundary} from '../src/world/local-scout.mjs';
import {createRespawnCalendar} from '../src/world/respawn-calendar.mjs';

const BEGIN=1700000000000;
function fixture(){
 let at=BEGIN,realm='EUI',canMove=true,planValid=true,stops=0;
 const character={name:'M',map:'main',in:'main',x:-50,y:0,
  hp:95,max_hp:100,rip:false};
 const mobs=[{id:'e1',mtype:'phoenix',type:'monster',map:'main',
  in:'main',x:20,y:0,hp:100,dead:false}];
 const plan={id:'M-plan',kind:'farm',key:'main:phoenix:0',
  target:'phoenix',map:'main',in:'main',x:0,y:0,
  realm:'EUI',objective:null,bounds:['main',-110,-110,110,110]};
 const writes=[];
 const p={c:character,realm:()=>realm,
  read:()=>null,write:(key,v)=>{writes.push({key,v});return true;},
  has:method=>method==='can_move_to',
  call:(method)=>{assert.equal(method,'can_move_to');return canMove;},
  G:{maps:{main:{pvp:false}}}};
 const bot={p,me:{name:'M',role:'farmer'},leader:'M',
  session:'M-session',running:true,farmers:['M'],teamNames:['M'],
  cfg:{party:{enabled:false}},journal:null,inventoryBlocked:false,
  logistics:{reserved:false},strategy:{busy:false,
   permittedMap:map=>map==='main'},monsters:()=>mobs,
  entity:id=>mobs.find(m=>m.id===id),
  events:[],event:(type,details)=>bot.events.push({type,details}),
  movement:{order:null,nativeActive:false,dispatchAdmission:null,
   nativeBusy(){return this.nativeActive;},local(x,y,owner,admit){
   this.dispatchAdmission=admit;
   this.order={owner,mode:'move',dest:{map:'main',in:'main',x,y}};return true;
  },stop(){stops++;this.order=null;}},
  teamPlan:{heartbeat:()=>plan,valid:()=>planValid,
   allowed:id=>id==='phoenix'}};
 const calendar=createRespawnCalendar(bot,{now:()=>at});
 function killThenMiss(){
  calendar.sample();
  calendar.hit({actor:'M',target:'e1',damage:10});
  assert.equal(calendar.death({actor:'M',id:'e1'}),true);
  mobs.length=0;at+=2000;calendar.sample();
  assert.equal(calendar.status().rows[0].scout.negativeObservations,1);
 }
 return {bot,calendar,plan,p,mobs,character,writes,
  advance:ms=>{at+=ms;},setRealm:value=>{realm=value;},
  setCanMove:value=>{canMove=value;},
  setPlanValid:value=>{planValid=value;},
  get stops(){return stops;},now:()=>at,killThenMiss};
}
test('N05 only one short local hop from an approved solo farm can be dispatched',()=>{
 const f=fixture();f.killThenMiss();
 assert.equal(f.calendar.scout(f.plan),true);
 assert.equal(f.bot.movement.order.owner,'scout');
 assert.deepEqual(f.bot.movement.order.dest,
  {map:'main',in:'main',x:20,y:0});
 assert.equal(f.bot.events.at(-1).type,'respawn.localScoutHop');
 assert.equal(f.bot.events.at(-1).details.authority,'approved-current-farm-only');
 assert.equal(f.calendar.status().executable,false,
  'calendar never grants a new general movement or targeting permission');
 f.bot.movement.order=null;
 assert.equal(f.calendar.scout(f.plan),false,
  'the same confirmed kill never authorizes a second journey');
});
test('N05 local scout refuses wrong target, quest, distant or changed spawn boundaries',()=>{
 const f=fixture();f.killThenMiss();
 const row=f.calendar.status().rows[0];
 const makeRaw=()=>({id:row.id,monster:row.monster,map:row.map,in:row.in,
  x:row.x,y:row.y,realm:'EUI',killedAt:row.killedAt,
  lastMissingAt:row.lastMissingAt,scoutState:'observing',
  scoutUntil:row.scout.until,scoutNegatives:1});
 const opts=()=>({row:makeRaw(),plan:f.plan,character:f.character,
  realm:'EUI',now:f.now(),approved:true,solo:true,safe:true});
 assert.equal(approvedLocalScoutHop(opts()).allowed,true);
 for(const adjust of [
  x=>{x.plan={...x.plan,target:'goo'};},
  x=>{x.plan={...x.plan,kind:'hunt'};},
  x=>{x.plan={...x.plan,objective:'material'};},
  x=>{x.plan={...x.plan,bounds:['main',90,90,110,110]};},
  x=>{x.character={...x.character,map:'bank'};},
  x=>{x.character={...x.character,x:-400};},
  x=>{x.row={...x.row,scoutUntil:f.now()-1};},
  x=>{x.row={...x.row,scoutNegatives:12};},
  x=>{x.row={...x.row,lastMissingAt:null};},
  x=>{x.approved=false;},
  x=>{x.solo=false;}
 ]){
  const arg=opts();adjust(arg);
  assert.equal(approvedLocalScoutHop(arg).allowed,false);
 }
});
test('N05 active hop never bypasses solo, safety, current-plan or local collision gates',()=>{
 for(const invalidate of [
  f=>{f.bot.cfg.party.enabled=true;},
  f=>{f.bot.farmers=['M','Ranger'];},
  f=>{f.bot.journal={kind:'bank'};},
  f=>{f.bot.inventoryBlocked=true;},
  f=>{f.bot.logistics.reserved=true;},
  f=>{f.bot.strategy.busy=true;},
  f=>{f.character.hp=80;},
  f=>{f.character.rip=true;},
  f=>{f.setPlanValid(false);},
  f=>{f.setCanMove(false);},
  f=>{f.bot.movement.order={owner:'quest'};},
  f=>{f.plan.objective='some-objective';},
  f=>{f.bot.me.role='merchant';},
  f=>{f.bot.combatAssessment={emergency:()=>({active:true})};},
  f=>{f.mobs.push({id:'hostile',mtype:'goo',hp:10,target:'M'});}
 ]){
  const f=fixture();f.killThenMiss();invalidate(f);
  assert.equal(f.calendar.scout(f.plan),false);
  assert.equal(f.bot.events.length,0);
 }
});
test('N05 in-flight scout movement is revoked at once on health, plan or realm drift',()=>{
 for(const invalidate of [
  f=>{f.character.hp=40;},
  f=>{f.setPlanValid(false);},
  f=>{f.setRealm('USI');},
  f=>{f.bot.session='restarted';},
  f=>{f.bot.strategy.busy=true;},
  f=>{f.bot.journal={kind:'upgrade'};},
  f=>{f.mobs.push({id:'hostile',mtype:'goo',hp:10,target:'M'});}
 ]){
  const f=fixture();f.killThenMiss();
  assert.equal(f.calendar.scout(f.plan),true);
  invalidate(f);f.advance(2000);
  f.calendar.sample();
  assert.equal(f.bot.movement.order,null);
  assert.equal(f.stops,1);
  assert.equal(f.calendar.scout(f.plan),false);
 }
});
test('N05 one-hop window cancels after twelve seconds without authorizing replay',()=>{
 const f=fixture();f.killThenMiss();
 assert.equal(f.calendar.scout(f.plan),true);
 f.advance(12001);f.calendar.sample();
 assert.equal(f.stops,1);
 assert.equal(f.calendar.scout(f.plan),false);
});

test('N05 accepted local movement is pending, not a confirmed scout arrival',()=>{
 const f=fixture();f.killThenMiss();
 assert.equal(f.calendar.scout(f.plan),true);
 assert.equal(f.calendar.status().localScoutHop.state,'in-flight');
 assert.equal(f.calendar.status().localScoutHop.endedAt,null);
 assert.equal(f.calendar.status().localScoutHop.executable,false);
 assert.equal(f.calendar.status().predictionAuthorized,false);
});
test('N05 local arrival requires a fresh physical character position at the dispatched hop',()=>{
 const f=fixture();f.killThenMiss();f.calendar.scout(f.plan);
 f.bot.movement.order=null;f.character.x=20;
 f.advance(2000);f.calendar.sample();
 const result=f.calendar.status().localScoutHop;
 assert.equal(result.state,'local-arrival-observed');
 assert.equal(result.endedAt,f.now());
 assert.equal(f.bot.events.at(-1).type,'respawn.localScoutOutcome');
 assert.equal(f.bot.events.at(-1).details.authority,
  'physical-local-observation-only');
 assert.equal(f.calendar.scout(f.plan),false,'physical arrival does not refresh one-use permit');
 assert.equal(f.calendar.status().executable,false);
});
test('N05 a disappearing movement order without physical arrival is unverified',()=>{
 const f=fixture();f.killThenMiss();f.calendar.scout(f.plan);
 f.bot.movement.order=null;
 f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().localScoutHop.state,'outcome-unverified');
 assert.equal(f.calendar.status().localScoutHop.endedAt,f.now());
 assert.equal(f.calendar.scout(f.plan),false);
});
test('N05 superseded local scout movement cannot claim arrival by coincident position',()=>{
 const f=fixture();f.killThenMiss();f.calendar.scout(f.plan);
 f.bot.movement.order={owner:'quest',dest:{map:'main',x:400,y:0}};
 f.character.x=20;
 f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().localScoutHop.state,'outcome-unverified');
 assert.equal(f.bot.movement.order.owner,'quest',
  'N05 must never stop a newer movement owned by another subsystem');
 assert.equal(f.calendar.scout(f.plan),false);
});
test('N05 safety revocation and timeout are terminal, not arrival or replay',()=>{
 for(const [edit,expected] of [
  [f=>{f.character.hp=40;},'safety-aborted'],
  [f=>{f.setPlanValid(false);},'safety-aborted'],
  [f=>{f.advance(12001);},'timeout-aborted']
 ]){
  const f=fixture();f.killThenMiss();f.calendar.scout(f.plan);
  edit(f);f.advance(2000);f.calendar.sample();
  assert.equal(f.calendar.status().localScoutHop.state,expected);
  assert.equal(f.calendar.status().localScoutHop.endedAt,f.now());
  assert.equal(f.stops,1);
  assert.equal(f.calendar.scout(f.plan),false);
 }
});
test('N05 session or realm changes never make an old local movement look completed',()=>{
 for(const edit of [
  f=>{f.bot.session='M-second';},
  f=>{f.setRealm('USI');}
 ]){
  const f=fixture();f.killThenMiss();f.calendar.scout(f.plan);
  edit(f);f.character.x=20;f.bot.movement.order=null;
  f.advance(2000);f.calendar.sample();
  assert.equal(f.calendar.status().localScoutHop,null);
  assert.equal(f.calendar.status().predictionAuthorized,false);
 }
});

test('N05 running scout cancels a changed movement mode or destination',()=>{
 for(const mutate of [
  f=>{f.bot.movement.order.mode='smart_move';},
  f=>{f.bot.movement.order.mode='blink';},
  f=>{f.bot.movement.order.dest.x+=70;},
  f=>{f.bot.movement.order.dest.map='bank';},
  f=>{f.bot.movement.order.dest.in='private-instance';}
 ]){
  const f=fixture();f.killThenMiss();
  assert.equal(f.calendar.scout(f.plan),true);
  mutate(f);f.advance(2000);f.calendar.sample();
  assert.equal(f.bot.movement.order,null);
  assert.equal(f.calendar.status().localScoutHop.state,'safety-aborted');
  assert.equal(f.stops,1);
  assert.equal(f.calendar.scout(f.plan),false);
 }
});
test('N05 ongoing local hop revokes denied target, map or changed PvP safety',()=>{
 for(const mutate of [
  f=>{f.bot.teamPlan.allowed=()=>false;},
  f=>{f.bot.strategy.permittedMap=()=>false;},
  f=>{f.p.G.maps.main.pvp=true;}
 ]){
  const f=fixture();f.killThenMiss();
  assert.equal(f.calendar.scout(f.plan),true);
  mutate(f);f.advance(2000);f.calendar.sample();
  assert.equal(f.bot.movement.order,null);
  assert.equal(f.calendar.status().localScoutHop.state,'safety-aborted');
  assert.equal(f.calendar.scout(f.plan),false);
 }
});

test('N05 refuses a local hop starting outside the approved spawn even if its endpoint is safe',()=>{
 const f=fixture();f.killThenMiss();
 f.plan.bounds=['main',-40,-110,110,110];
 assert.equal(insideScoutFarmBoundary({map:'main',x:20,y:0},f.plan.bounds),true);
 assert.equal(insideScoutFarmBoundary(f.character,f.plan.bounds),false);
 assert.equal(f.calendar.scout(f.plan),false);
 assert.equal(f.bot.movement.order,null);
 assert.equal(f.bot.events.length,0);
 f.character.x=-30;
 assert.equal(insideScoutFarmBoundary(f.character,f.plan.bounds),true);
 assert.equal(f.calendar.scout(f.plan),true,
  'the same approved endpoint is allowed after moving into the safe interior');
});
test('N05 farm bounds reject invalid, inverted or too narrow rectangles',()=>{
 const point={map:'main',x:15,y:0};
 for(const bounds of [
  null,[],['bank',-100,-100,100,100],
  ['main',20,-100,-20,100],
  ['main',0,-100,15,100],
  ['main',-100,0,100,18],
  ['main',-100,NaN,100,100]
 ]){
  assert.equal(insideScoutFarmBoundary(point,bounds),false);
 }
 assert.equal(insideScoutFarmBoundary(point,['main',-100,-100,100,100]),true);
 assert.equal(insideScoutFarmBoundary({...point,x:Infinity},
  ['main',-100,-100,100,100]),false);
});
test('N05 unexpected excursion beyond approved farm margin aborts active native scout',()=>{
 const f=fixture();f.killThenMiss();
 assert.equal(f.calendar.scout(f.plan),true);
 f.character.x=-105;
 f.advance(2000);f.calendar.sample();
 assert.equal(f.stops,1);
 assert.equal(f.bot.movement.order,null);
 assert.equal(f.calendar.status().localScoutHop.state,'safety-aborted');
 assert.equal(f.calendar.scout(f.plan),false,'aborted movement is not replayable');
});
test('N05 changed farm bounds block claiming arrival despite coincident coordinates',()=>{
 const f=fixture();f.killThenMiss();
 assert.equal(f.calendar.scout(f.plan),true);
 f.bot.movement.order=null;
 f.character.x=20;
 f.plan.bounds=['main',20,-100,100,100];
 f.advance(2000);f.calendar.sample();
 assert.equal(f.calendar.status().localScoutHop.state,'outcome-unverified');
 assert.equal(f.calendar.scout(f.plan),false);
});

test('N05 deferred dispatch rechecks original kill, exact target and current live farm',()=>{
 const f=fixture();f.killThenMiss();
 assert.equal(f.calendar.scout(f.plan),true);
 const admission=f.bot.movement.dispatchAdmission;
 assert.equal(typeof admission,'function');
 assert.equal(admission(),true);
 for(const mutate of [
  x=>{x.bot.teamPlan.allowed=()=>false;},
  x=>{x.bot.strategy.permittedMap=()=>false;},
  x=>{x.character.hp=60;},
  x=>{x.plan.target='goo';},
  x=>{x.plan.bounds=['main',0,-100,110,110];},
  x=>{x.character.x=-105;},
  x=>{x.bot.cfg.party.enabled=true;},
  x=>{x.bot.farmers.push('AnotherFarmer');},
  x=>{x.bot.session='new-session';},
  x=>{x.setRealm('USI');}
 ]){
  const g=fixture();g.killThenMiss();g.calendar.scout(g.plan);
  const recheck=g.bot.movement.dispatchAdmission;
  assert.equal(recheck(),true);
  mutate(g);
  assert.equal(recheck(),false,'deferred command must not inherit old authorization');
 }
});
test('N05 no negative sample or expired local scout lease authorizes delayed dispatch',()=>{
 for(const mutate of [
  f=>{f.advance(10001);},
  f=>{f.advance(300001);},
  f=>{f.mobs.push({id:'e1',mtype:'phoenix',type:'monster',
   map:'main',in:'main',x:20,y:0,hp:100,dead:false});
   f.advance(2000);f.calendar.sample();},
  f=>{f.character.stand=true;}
 ]){
  const f=fixture();f.killThenMiss();f.calendar.scout(f.plan);
  const lease=f.bot.movement.dispatchAdmission;
  mutate(f);
  assert.equal(lease(),false);
 }
});

test('N05 rejects local scout planning during uncontrolled native motion',()=>{
 for(const edit of [
  f=>{f.bot.movement.nativeActive=true;},
  f=>{f.character.moving=true;f.bot.movement.nativeBusy=()=>!!f.character.moving;},
  f=>{f.bot.movement.nativeBusy=()=>true;}
 ]){
  const f=fixture();f.killThenMiss();edit(f);
  assert.equal(f.calendar.scout(f.plan),false);
  assert.equal(f.bot.movement.order,null);
  assert.equal(f.bot.events.length,0);
  assert.equal(f.calendar.status().localScoutHop,null);
 }
});
test('N05 queued scout lease is revoked if an unrelated native path starts before dispatch',()=>{
 const f=fixture();f.killThenMiss();
 assert.equal(f.calendar.scout(f.plan),true);
 const lease=f.bot.movement.dispatchAdmission;
 assert.equal(lease(),true);
 f.bot.movement.nativeActive=true;
 assert.equal(lease(),false,'native movement invalidates pre-dispatch lease');
 f.bot.movement.nativeActive=false;
 assert.equal(lease(),true,'the order remains pending and must still pass all other checks');
});
