import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseCommittedFarmArea,shouldHoldOrdinaryLocation}
 from '../src/world/team-plan.mjs';

const bee={id:'plan:3',key:'main:bee:0',target:'bee',
 kind:'farm',map:'main',in:'main',x:546,y:1059,started:1000,
 arrivedAt:null};
const minimush={id:'plan:4',key:'halloween:minimush:0',target:'minimush',
 kind:'farm',map:'halloween',in:'halloween',x:8,y:630.5};
const rank=(site,score,travelSeconds=50)=>({
 ...site,score,travelSeconds,evidenceSeconds:0,pressureRatio:0
});
const choose=(current,character,candidate,now=100000)=>chooseCommittedFarmArea({
 current,currentRank:rank(current,400218,100),candidate,character,
 now,holdMs:60000,improvement:.2
});

test('reproduces captured bee/minimush oscillation: re-ranking cannot interrupt either cross-map trip',()=>{
 const travelingBee={map:'main',in:'main',x:120,y:20};
 const travelingMush={map:'mtunnel',in:'mtunnel',x:2,y:9};
 for(let time=20000;time<=180000;time+=10000){
  const toMush=choose(bee,travelingBee,rank(minimush,419036,120),time);
  assert.equal(toMush.choice.key,bee.key);
  assert.equal(toMush.reason,'committed-farm-trip');
  const reverse=choose({...minimush,arrivedAt:null},travelingMush,
   rank(bee,419036,100),time);
  assert.equal(reverse.choice.key,minimush.key);
  assert.equal(reverse.reason,'committed-farm-trip');
 }
});

test('arrival starts actual observation hold regardless of earlier journey duration',()=>{
 const arrived={...minimush,arrivedAt:140000,started:1000};
 const position={map:'halloween',in:'halloween',x:10,y:633};
 for(const at of [140000,150000,180000,199999]){
  const result=choose(arrived,position,rank(bee,2000000,150),at);
  assert.equal(result.choice.key,minimush.key);
  assert.equal(result.reason,'farm-arrival-observation-hold');
 }
 const switchable=choose(arrived,position,rank(bee,2000000,150),200000);
 assert.equal(switchable.choice.key,bee.key);
 assert.equal(switchable.reason,'evidence-supported-switch');
});

test('ordinary scoring after arrival requires substantial benefit, not 4% position noise',()=>{
 const current={...minimush,arrivedAt:1000,started:0};
 const at={map:'halloween',in:'halloween',x:8,y:630.5};
 const near=choose(current,at,rank(bee,419036,60),100000);
 assert.equal(near.choice.key,minimush.key);
 assert.equal(near.reason,'switch-benefit-unproven');
 const strong=choose(current,at,rank(bee,900000,60),100000);
 assert.equal(strong.choice.key,bee.key);
});

test('the gating applies to ordinary farming across species, not active priority hunts; shell supply obeys location hold',()=>{
 assert.equal(shouldHoldOrdinaryLocation(bee,minimush,'farm'),true);
 assert.equal(shouldHoldOrdinaryLocation(bee,minimush,'hunt'),false);
 assert.equal(shouldHoldOrdinaryLocation(bee,minimush,'achievement'),true,
  'optional tracker milestones must not cause impulsive long-distance farm switches');
 assert.equal(shouldHoldOrdinaryLocation(bee,minimush,'farm',true),true);
 assert.equal(shouldHoldOrdinaryLocation({kind:'hunt',target:'bee'},minimush,'farm'),false);
 assert.equal(shouldHoldOrdinaryLocation(null,minimush,'farm'),false);
 assert.equal(shouldHoldOrdinaryLocation(bee,null,'farm'),false);
});

test('invalid or unsafe existing spawn can still be rejected by caller instead of pinned',()=>{
 const invalidRank=null;
 // The main integration invokes chooseCommittedFarmArea only after valid(current)
 // and an approved currentRank exist. If the current rank is gone, it does not
 // retain that spawn; it returns the newly selected approved candidate.
 const result=chooseCommittedFarmArea({
  current:bee,currentRank:invalidRank,candidate:rank(minimush,500000),
  character:{map:'main',in:'main',x:120,y:20},now:5000
 });
 assert.equal(result.choice.key,minimush.key);
});
