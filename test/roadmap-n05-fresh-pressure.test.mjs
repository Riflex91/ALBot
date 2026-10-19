import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSpawnPressure,chooseFarmAreaSwitch,chooseHuntSpawn}
 from '../src/world/spawn-choice.mjs';

// Independent realm-scoped area observations already come from team-plan.
// A historical 90s aggregate is not proof that a spawn is still crowded.
const NOW=2000000;
const current={id:'current',key:'main:goo:0',kind:'farm',target:'goo',
 started:NOW-240000};
const row=(key,score,pressure,observedAt=NOW-1000)=>({
 key,target:'goo',score,travelSeconds:key===current.key?5:70,
 pressureRatio:pressure,evidenceSeconds:120,observedAt
});

test('N05 crowd evidence has finite freshness and rejects future/unknown timestamps',()=>{
 const valid=row(current.key,100,.8);
 assert.equal(freshSpawnPressure(valid,NOW),true);
 assert.equal(freshSpawnPressure({...valid,observedAt:NOW-900000},NOW),true);
 for(const stamp of [null,undefined,0,-1,NaN,Infinity,
  NOW+1,NOW-900001,1.2]){
  assert.equal(freshSpawnPressure({...valid,observedAt:stamp},NOW),false);
 }
 assert.equal(freshSpawnPressure({...valid,evidenceSeconds:89},NOW),false);
 assert.equal(freshSpawnPressure({...valid,pressureRatio:1.01},NOW),false);
 assert.equal(freshSpawnPressure({...valid,pressureRatio:-.1},NOW),false);
});

test('N05 farm crowd relief needs recent measurements from both places',()=>{
 const source=row(current.key,100,.8),candidate=row('main:goo:1',90,.1);
 const run=(a,b)=>chooseFarmAreaSwitch({current,currentRank:a,candidate:b,
  now:NOW,holdMs:60000});
 assert.equal(run(source,candidate).reason,'verified-crowded-spawn-relief');
 assert.equal(run(source,candidate).choice.key,candidate.key);
 for(const [a,b] of [
  [{...source,observedAt:NOW-900001},candidate],
  [source,{...candidate,observedAt:NOW-900001}],
  [{...source,observedAt:NOW+10},candidate],
  [source,{...candidate,observedAt:null}]
 ]){
  const decision=run(a,b);
  assert.equal(decision.choice.key,current.key);
  assert.notEqual(decision.reason,'verified-crowded-spawn-relief');
 }
});

test('N05 hunt relocation rejects stale pressure and keeps ordinary target protections',()=>{
 const source=row(current.key,100,.8),candidate=row('main:goo:1',170,.1);
 const hunt={...current,kind:'hunt'};
 const run=(a,b)=>chooseHuntSpawn({current:hunt,currentRank:a,
  candidate:b,now:NOW,holdMs:180000});
 assert.equal(run(source,candidate).reason,'verified-less-crowded-hunt-spawn');
 for(const [a,b] of [
  [{...source,observedAt:NOW-900001},candidate],
  [source,{...candidate,observedAt:NOW+1}],
  [source,{...candidate,observedAt:null}],
  [source,{...candidate,evidenceSeconds:30}]
 ]){
  assert.equal(run(a,b).choice.key,current.key);
  assert.equal(run(a,b).reason,'no-comparable-crowd-evidence');
 }
 assert.equal(run(source,{...candidate,target:'bees'}).reason,'new-or-invalid-hunt');
});

test('N05 observation recency grants no execution or new monster authority',()=>{
 const evidence=row(current.key,100,.8);
 assert.equal(freshSpawnPressure(evidence,NOW),true);
 const result=chooseHuntSpawn({
  current:{...current,kind:'hunt'},currentRank:evidence,
  candidate:row('main:goo:1',170,.1),now:NOW
 });
 assert.equal(result.authority,'hunt-location-only');
 assert.equal(Object.hasOwn(result,'attack'),false);
 assert.equal(Object.hasOwn(result,'travel'),false);
 assert.equal(Object.hasOwn(result,'dispatch'),false);
});
