import test from 'node:test';
import assert from 'node:assert/strict';
import {planOrbitalKite} from '../src/combat/orbital-kiting.mjs';
import {createCombatNavigation} from '../src/combat/navigation.mjs';

const monster={id:'bee-1',mtype:'bee',type:'monster',hp:500,map:'main',in:'main',x:0,y:0,range:25,speed:40,target:'Ranger'};
const hero=(x=108,y=0,ctype='ranger')=>({name:'Ranger',ctype,map:'main',in:'main',x,y,range:150,speed:40});
const metadata={range:25,speed:40};
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
