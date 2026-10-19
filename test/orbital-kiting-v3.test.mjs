import test from 'node:test';
import assert from 'node:assert/strict';
import {planOrbitalKite} from '../src/combat/orbital-kiting.mjs';
import {createCombatNavigation,activeKiteEligibility} from '../src/combat/navigation.mjs';

const monster={id:'bee-1',mtype:'bee',type:'monster',hp:500,map:'main',in:'main',x:0,y:0,range:25,speed:40,target:'Ranger'};
const hero=(x=108,y=0,ctype='ranger')=>({name:'Ranger',ctype,map:'main',in:'main',x,y,range:150,speed:60});
const metadata={range:25,speed:40,aggro:1};
const polarAngle=p=>Math.atan2(p.y,p.x);
function advance(position,previous){
 const diff=polarAngle(position)-polarAngle(previous);
 return Math.atan2(Math.sin(diff),Math.cos(diff));
}
test('v3 Alpha31 style continuously orbits an engaged enemy even when already at a safe range',()=>{
 const c=hero(),first=planOrbitalKite(c,monster,metadata,{direction:1,canMove:()=>true});
 assert.equal(first?.mode,'orbit');
 assert.ok(first.y>8,'first waypoint must have a true tangential component, not radial-only travel');
 assert.ok(first.afterDistance>=first.hardSafeDistance+4);
 assert.ok(first.afterDistance<=first.maximumDistance);
 const second=planOrbitalKite({...c,x:first.x,y:first.y},monster,metadata,{direction:first.direction,canMove:()=>true});
 assert.equal(second?.mode,'orbit');
 assert.ok(advance(first,c)>0);
 assert.ok(advance(second,first)>0,'successive waypoints must continue around the monster');
 assert.ok(Math.abs(second.afterDistance-first.afterDistance)<20);
});
test('v3 Alpha33 spiral escape is tangential when too close, without waiting for a hit',()=>{
 const c=hero(0,0),t={...monster,x:50,y:0,target:'Ranger'};
 const w=planOrbitalKite(c,t,metadata,{direction:1,canMove:()=>true});
 assert.equal(w?.mode,'spiral');
 assert.ok(w.afterDistance>50);
 assert.ok(Math.abs(w.y)>5,'should spiral sideways, not only flee backward');
 assert.notEqual(w.angleStepDeg,0);
});
test('if preferred orbital side is blocked, reverse direction and preserve safe firing band',()=>{
 const c=hero(),w=planOrbitalKite(c,monster,metadata,{direction:1,canMove:(_x,y)=>y<=0});
 assert.equal(w?.mode,'orbit');
 assert.equal(w.direction,-1);
 assert.ok(w.y<0);
 assert.ok(w.afterDistance>=w.hardSafeDistance+4);
});
test('terrain intersection must block a waypoint even when its endpoint is reachable',()=>{
 const c=hero();
 const w=planOrbitalKite(c,monster,metadata,{direction:1,canMove:(_x,y)=>Math.abs(y)<6||Math.abs(y)>40});
 assert.ok(!w||Math.abs(w.y)<6,'may not jump across a forbidden segment');
});
test('v3 anchored orbit avoids exiting a shared farming area',()=>{
 const c=hero(),anchor={x:105,y:0};
 const w=planOrbitalKite(c,monster,metadata,{direction:1,anchor,anchorRadius:60,canMove:()=>true});
 assert.ok(w);
 assert.ok(Math.hypot(w.x-anchor.x,w.y-anchor.y)<=62);
});
test('do not attempt orbit with inadequate range compared with enemy attack and movement reach',()=>{
 assert.equal(planOrbitalKite(hero(108,0),{...monster,range:120},metadata,{direction:1}),null);
});
test('ALBot navigation actually performs orbital move while retaining current target',()=>{
 const c=hero(),moves=[],events=[];
 const t={...monster,target:c.name};
 const bot={p:{c,G:{monsters:{bee:metadata}},call:(id)=>id==='can_move_to'?true:null},
  cfg:{farming:{kiting:true,orbit:true,orbitRadius:220}},teamNames:['Ranger'],me:{name:'Ranger'},
  monsters:()=>[t],teamPlan:{heartbeat:()=>null},event:(type,data)=>events.push({type,data}),
  movement:{order:null,stop(){this.order=null;},local(x,y,owner){moves.push({x,y,owner});this.order={owner};}}};
 const nav=createCombatNavigation(bot);
 assert.equal(nav.rangePosition(t),true);
 assert.equal(moves.length,1);
 assert.ok(Math.abs(moves[0].y)>5);
 assert.equal(nav.status().orbitSteps,1);
 assert.equal(nav.status().lastOrbit.mode,'orbit');
 assert.equal(events.some(e=>e.type==='combat.orbitStep'),true);
 assert.equal(nav.rangePosition(t),false,'pending move must not be superseded repeatedly');
});
test('support classes do not orbit an enemy that is targeting a teammate',()=>{
 const c=hero(),t={...monster,target:'Leader'},moves=[];
 const bot={p:{c,G:{monsters:{bee:metadata}},call:()=>true},
 cfg:{farming:{kiting:true}},teamNames:['Ranger','Leader'],me:{name:'Ranger'},
 monsters:()=>[t],teamPlan:null,event:()=>{},movement:{order:null,local:(...args)=>moves.push(args)}};
 assert.equal(createCombatNavigation(bot).rangePosition(t),false);
 assert.equal(moves.length,0);
});

test('active aggro of originally neutral armadillo permits speed-verified orbit, neutral spawn does not',()=>{
 const c=hero(90,0),moves=[],events=[];
 const meta={range:25,speed:30,aggro:0};
 const t={...monster,mtype:'armadillo',target:'Ranger',speed:30,range:25,x:0};
 const movement={order:null,stop(){this.order=null;},local(x,y,owner){moves.push({x,y,owner});this.order={owner};return true;}};
 const bot={p:{c,G:{monsters:{armadillo:meta}},call:()=>true},
  cfg:{farming:{kiting:true,orbit:true,orbitRadius:220}},teamNames:['Ranger'],
  me:{name:'Ranger'},monsters:()=>[t],teamPlan:null,movement,
  event:(name,data)=>events.push({name,data})};
 const nav=createCombatNavigation(bot);
 assert.equal(nav.rangePosition(t),true);
 assert.equal(moves[0].owner,'kite');
 assert.ok(events.some(e=>e.name==='combat.orbitStep'||e.name==='combat.spiralEscape'));
 t.target=null;movement.order=null;
 assert.equal(nav.rangePosition(t),false);
 assert.equal(activeKiteEligibility(c,t,meta).allowed,false);
});
test('active aggro kiting preempts follow, farm, combat and cohesion movement',()=>{
 for(const owner of ['follow','farm','combat','world','cohesion']){
  const c=hero(100,0),t={...monster,speed:30},moves=[],stops=[];
  const movement={order:{owner},stop(){stops.push(this.order.owner);this.order=null;},
   local(x,y,who){moves.push({x,y,who});this.order={owner:who};return true;}};
  const bot={p:{c,G:{monsters:{bee:{range:25,speed:30,aggro:0}}},call:()=>true},
   cfg:{farming:{kiting:true,orbitRadius:220}},teamNames:['Ranger'],me:{name:'Ranger'},
   monsters:()=>[t],teamPlan:null,movement,event(){}};
  assert.equal(createCombatNavigation(bot).rangePosition(t),true,owner);
  assert.deepEqual(stops,[owner]);assert.equal(moves[0].who,'kite');
 }
});
test('never preempt value movement, unsafe terrain, or faster or unknown-speed enemies',()=>{
 const c=hero(100,0),t={...monster,speed:30};
 for(const {owner,canMove,speed} of [
  {owner:'economy',canMove:true,speed:30},
  {owner:'follow',canMove:false,speed:30},
  {owner:'follow',canMove:true,speed:70},
  {owner:'follow',canMove:true,speed:undefined}
 ]){
  const target={...t,speed},moves=[];
  const movement={order:{owner},stop(){throw Error('must not preempt');},
   local(...args){moves.push(args);return true;}};
  const bot={p:{c,G:{monsters:{bee:{range:25,aggro:0}}},call:()=>canMove},
   cfg:{farming:{kiting:true,orbitRadius:220}},teamNames:['Ranger'],me:{name:'Ranger'},
   monsters:()=>[target],teamPlan:null,movement,event(){}};
  assert.equal(createCombatNavigation(bot).rangePosition(target),false);
  assert.equal(moves.length,0);
 }
 assert.equal(activeKiteEligibility(c,{...t,speed:60},{speed:20}).reason,'enemy-not-slower');
 assert.equal(activeKiteEligibility(c,{...t,speed:undefined},{range:25}).reason,'speed-unverified');
});

test('distant self-aggro cancels stale kite and allows combat approach to regain firing range',()=>{
 const c=hero(450,0),t={...monster,target:c.name,speed:30};
 const stops=[],moves=[],movement={order:{owner:'kite'},
  stop(){stops.push(this.order?.owner);this.order=null;},
  local(...args){moves.push(args);this.order={owner:'kite'};return true;}};
 const bot={p:{c,G:{monsters:{bee:metadata}},call:()=>true},
  cfg:{farming:{kiting:true,orbit:true,orbitRadius:220}},
  me:{name:'Ranger'},teamNames:['Ranger'],farmers:['Ranger'],
  monsters:()=>[t],teamPlan:null,movement,event(){}};
 assert.equal(createCombatNavigation(bot).rangePosition(t),false);
 assert.deepEqual(stops,['kite']);
 assert.deepEqual(moves,[]);
 assert.equal(movement.order,null);
});
