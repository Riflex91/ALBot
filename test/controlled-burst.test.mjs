import test from 'node:test';
import assert from 'node:assert/strict';
import {controlledBurstPlan} from '../src/combat/controlled-burst.mjs';
const mage={mp:2000,max_mp:2000,rpiercing:0},skill={mp:80,ratio:.5};
const mob=(id,hp=100,extra={})=>({id,type:'monster',hp,...extra});
test('controlled burst pays base once, preserves reserve and selects multiple affordable kills',()=>{
 const plan=controlledBurstPlan(mage,[mob('a'),mob('b'),mob('c',5000)],skill,
  {budget:1000,reserve:.5,maxTargets:5,primary:'a'});
 assert.deepEqual(plan.map(r=>r[0]),['a','b']);
 assert.ok(plan.reduce((n,r)=>n+r[1],skill.mp)<=1000);
});
test('mana uses target resistance and never treats a reflected hit as a safe kill',()=>{
 const [ordinary]=controlledBurstPlan(mage,[mob('a')],skill,{budget:1500});
 const [armored]=controlledBurstPlan(mage,[mob('a',100,{resistance:600})],skill,{budget:1500});
 assert.ok(armored[1]>ordinary[1]);
 assert.deepEqual(controlledBurstPlan(mage,[mob('a',1,{'1hp':true}),mob('b',100,{reflection:20})],skill,{budget:1000}),[]);
});
test('server cap, duplicate IDs and partial primary preserve valid integer allocations',()=>{
 const targets=Array.from({length:40},(_,n)=>mob('a'+n,1));
 const plan=controlledBurstPlan({...mage,mp:100000,max_mp:100000},targets.concat(targets),skill,{budget:10000,maxTargets:100});
 assert.equal(plan.length,16);assert.equal(new Set(plan.map(r=>r[0])).size,16);
 const partial=controlledBurstPlan(mage,[mob('boss',10000)],skill,{budget:500,primary:'boss'});
 assert.deepEqual(partial,[['boss',500]]);
 assert.deepEqual(controlledBurstPlan(mage,[mob('a')],skill,{budget:100,reserve:1}),[]);
});
