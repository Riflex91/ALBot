import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseHuntSpawn} from '../src/world/spawn-choice.mjs';
import {merchantActionDue} from '../src/merchant/action-cadence.mjs';

const now=1000000;
const hunt={key:'halloween:osnake:west',target:'osnake',kind:'hunt',started:now-300000};
const west={...hunt,score:55000,travelSeconds:4,
 evidenceSeconds:140,pressureRatio:.75};
const east={key:'halloween:osnake:east',target:'osnake',score:103000,
 travelSeconds:90,evidenceSeconds:0,pressureRatio:0};
function pick(patch={}){return chooseHuntSpawn({current:hunt,currentRank:west,
 candidate:east,now,...patch});}
test('osnake quest remains pinned even when distance makes other spawn score oscillate',()=>{
 const a=pick();
 assert.equal(a.choice.key,west.key);
 assert.equal(a.reason,'no-comparable-crowd-evidence');
 for(const score of [55000,103000,150000,55000]){
  assert.equal(pick({candidate:{...east,score}}).choice.key,west.key);
 }
});
test('active hunt cannot switch in first three minutes, even against known alternate',()=>{
 const candidate={...east,evidenceSeconds:180,pressureRatio:.02};
 const result=pick({current:{...hunt,started:now-85000},candidate});
 assert.equal(result.reason,'hunt-spawn-observation-hold');
 assert.equal(result.choice.key,west.key);
});
test('two sufficiently observed spawns may switch only on real crowd differential',()=>{
 const other={...east,evidenceSeconds:180,pressureRatio:.05};
 assert.equal(pick({candidate:other}).reason,'verified-less-crowded-hunt-spawn');
 assert.equal(pick({candidate:{...other,pressureRatio:.72}}).choice.key,west.key);
 assert.equal(pick({currentRank:{...west,pressureRatio:.2},
  candidate:other}).choice.key,west.key);
 assert.equal(pick({candidate:{...other,score:70000}}).choice.key,west.key);
});
test('quest completion or unsafe/quarantined spawn can choose another objective',()=>{
 const other={...east,target:'bee'};
 assert.equal(pick({candidate:other}).choice.key,other.key);
 assert.equal(pick({currentRank:null}).choice.key,east.key);
 assert.equal(pick({current:null}).choice.key,east.key);
 assert.equal(pick({candidate:null}).choice,null);
});
test('unknown/future timestamps never waive hunt stability',()=>{
 for(const current of [
  {...hunt,started:now+200},
  {...hunt,started:NaN}
 ]){
  const d=pick({current,candidate:{...east,evidenceSeconds:500}});
  assert.equal(d.choice.key,west.key);
 }
});
test('merchant depot can continue after 750 ms if no pending dispatch/journal/movement',()=>{
 const base={now:10000,last:9250,normalDue:false,
  merchant:true,depotActive:true,hasPending:false,blocked:false,
  moving:false};
 assert.equal(merchantActionDue(base),true);
 assert.equal(merchantActionDue({...base,now:9999}),false);
 assert.equal(merchantActionDue({...base,last:10001}),false);
});
test('faster polling never bypasses a pending action, journal, movement or passive job',()=>{
 const p={now:10000,last:5000,normalDue:false,
  merchant:true,depotActive:true,hasPending:false,blocked:false,
  moving:false};
 for(const key of ['hasPending','blocked','moving']){
  assert.equal(merchantActionDue({...p,[key]:true}),false,key);
 }
 assert.equal(merchantActionDue({...p,depotActive:false}),false);
 assert.equal(merchantActionDue({...p,merchant:false}),false);
 assert.equal(merchantActionDue({...p,fastIntervalMs:10}),false);
 assert.equal(merchantActionDue({...p,normalDue:true,blocked:true}),true,
  'ordinary economy due remains with original guards in caller');
});
