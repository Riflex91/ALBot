import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedLocalScoutHop} from '../src/world/local-scout.mjs';
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
  movement:{order:null,local(x,y,owner){
   this.order={owner,dest:{map:'main',in:'main',x,y}};return true;
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
