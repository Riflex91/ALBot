import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSquadConvergenceStep} from '../src/combat/farmer.mjs';

const now=10000;
const ranger={name:'My_Ranger1',ctype:'ranger',map:'mansion',in:'mansion',x:0,y:0};
const priest={name:'My_Priest',class:'priest',running:true,rip:false,
 realm:'USIV',received:now-100,map:'mansion',in:'mansion',x:460,y:0};
const options={now,realm:'USIV',minimumGap:140};
const free=()=>true;

test('dispersed ranger advances toward a fresh Priest, not away from squad',()=>{
 const point=safeSquadConvergenceStep(ranger,priest,[],free,options);
 assert.ok(point);
 assert.equal(point.anchor,'My_Priest');
 assert.equal(point.map,'mansion');
 assert.ok(Math.hypot(point.x-priest.x,point.y-priest.y)<460-12);
 assert.ok(Math.hypot(point.x,point.y)<=81);
});

test('already assembled party does not issue redundant convergence steps',()=>{
 assert.equal(safeSquadConvergenceStep(ranger,{...priest,x:120},[],free,options),null);
 assert.equal(safeSquadConvergenceStep(ranger,{...priest,name:ranger.name},[],free,options),null);
});

test('stale, dead, cross-realm and cross-instance anchors never navigate',()=>{
 for(const invalid of [
  {...priest,received:now-5000},
  {...priest,received:now+1},
  {...priest,received:undefined},
  {...priest,running:false},
  {...priest,rip:true},
  {...priest,realm:'EU1'},
  {...priest,map:'main',in:'main'},
  {...priest,in:'crypt'}
 ]){
  assert.equal(safeSquadConvergenceStep(ranger,invalid,[],free,options),null);
 }
});

test('convergence keeps or increases clearance from an actual self-attacker',()=>{
 const rat={id:'rat1',name:'rat',map:'mansion',in:'mansion',x:-35,y:0,
  hp:100,range:20,target:ranger.name};
 const point=safeSquadConvergenceStep(ranger,priest,[rat],free,options);
 assert.ok(point);
 assert.ok(Math.hypot(point.x-rat.x,point.y-rat.y)>=35-6);
});

test('no invented route through hostile attacker or impassable corridor',()=>{
 const blocking={id:'rat2',map:'mansion',in:'mansion',x:80,y:0,
  hp:100,range:160,target:'My_Ranger2'};
 const point=safeSquadConvergenceStep(ranger,priest,[blocking],free,options);
 if(point){
  const old=Math.hypot(ranger.x-blocking.x,ranger.y-blocking.y);
  const next=Math.hypot(point.x-blocking.x,point.y-blocking.y);
  assert.ok(next>=Math.min(210,old-5));
 }
 assert.equal(safeSquadConvergenceStep(ranger,priest,[],()=>false,options),null);
});

test('missing positions and stale target monsters cannot grant blind movement',()=>{
 assert.equal(safeSquadConvergenceStep({...ranger,x:NaN},priest,[],free,options),null);
 assert.equal(safeSquadConvergenceStep(ranger,{...priest,y:Infinity},[],free,options),null);
 const point=safeSquadConvergenceStep(ranger,priest,[
  {id:'dead',map:'mansion',in:'mansion',x:1,y:1,hp:0,target:ranger.name}
 ],free,options);
 assert.ok(point);
});
