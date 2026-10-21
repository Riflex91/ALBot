import test from 'node:test';
import assert from 'node:assert/strict';
import {observedGearStatDelta} from '../src/production/gear-fairness.mjs';
import {createGear} from '../src/production/gear.mjs';

const keys=['mainhand','offhand','helmet','chest','pants','shoes',
 'gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
const t=1700000000000;
const slots=()=>Object.fromEntries(keys.map(k=>[k,null]));
const before=()=>({complete:true,realm:'EUI',session:'M:one',
 class:'merchant',level:70,at:t,slots:slots(),
 stats:{attack:100,armor:200,max_hp:1500}});
const after=()=>{const b=before();
 return {...b,at:t+1000,slots:{...b.slots,
  mainhand:{name:'staff',level:1}},stats:{attack:125,armor:204,
  max_hp:1500}};};

test('W05/W08 real one-slot equip and live stat difference form bounded observation only',()=>{
 const proof=observedGearStatDelta(before(),after(),{now:t+1000});
 assert.equal(proof.kind,'observed-live-character-stat-delta');
 assert.equal(proof.slot,'mainhand');
 assert.deepEqual(proof.statDelta,{attack:25,armor:4,max_hp:0});
 assert.equal(proof.directlyObserved,true);
 assert.equal(proof.causalityConfirmed,false);
 assert.equal(proof.priorityAuthorized,false);
 assert.equal(proof.executable,false);
 assert.equal(proof.to.name,'staff');
 assert.equal(proof.from,null);
});

test('W05/W08 a different session, class, level, realm or stale span revokes comparisons',()=>{
 for(const change of [
  {session:'new-run'},{realm:'USI'},{class:'priest'},{level:71},
  {at:t},{at:t+3600001},{at:t+1001}
 ]){
  const end={...after(),...change};
  assert.equal(observedGearStatDelta(before(),end,{now:t+1000}),null,
   JSON.stringify(change));
 }
 assert.equal(observedGearStatDelta(before(),after(),{now:t+1000,
  maxGapMs:0}),null);
});

test('W05/W08 multi-slot gear or stat-only fluctuations cannot be credited as equip',()=>{
 const a=after();
 a.slots.ring1={name:'ring',level:3};
 assert.equal(observedGearStatDelta(before(),a,{now:t+1000}),null);
 const onlyStat=before();onlyStat.at=t+1000;onlyStat.stats.attack=200;
 assert.equal(observedGearStatDelta(before(),onlyStat,{now:t+1000}),null);
 const identical=after();identical.slots.mainhand=null;
 assert.equal(observedGearStatDelta(before(),identical,{now:t+1000}),null);
});

test('W05/W08 invalid, missing and nonnumeric stat readings cannot become a gain',()=>{
 for(const bad of [
  {attack:Infinity,armor:204,max_hp:1500},
  {attack:'125',armor:204,max_hp:1500},
  {attack:125,armor:204},
  {attack:125,armor:204,max_hp:1500,unknown:50},
  {attack:1e12,armor:204,max_hp:1500},
  {attack:NaN,armor:204,max_hp:1500}
 ]){
  assert.equal(observedGearStatDelta(before(),
   {...after(),stats:bad},{now:t+1000}),null,JSON.stringify(bad));
 }
});
test('W05/W08 local refresh records only 16 passive, copy-safe observations',()=>{
 let at=t;
 const character={ctype:'merchant',level:70,slots:{},
  items:[],attack:100,armor:200,max_hp:1500};
 const bot={me:{name:'M',role:'merchant'},session:'M:one',
  teamNames:['M'],cfg:{production:{gear:true,offlineProfiles:false},
   party:{selection:'fixed'},characters:[]},
  p:{c:character,G:{items:{staff:{type:'weapon'},ring:{type:'ring'}}},
   realm:()=> 'EUI'},
  transport:{fresh:()=>null},economy:{}};
 const gear=createGear(bot,{now:()=>at});
 gear.refresh();
 assert.deepEqual(gear.observedPerformance(),[]);
 character.slots.mainhand={name:'staff',level:0};
 character.attack=125;at+=1000;
 gear.refresh();
 const proof=gear.observedPerformance();
 assert.equal(proof.length,1);
 assert.equal(proof[0].statDelta.attack,25);
 proof[0].statDelta.attack=999999;
 assert.equal(gear.observedPerformance()[0].statDelta.attack,25,
  'external status consumers cannot mutate retained observations');
 character.attack=150;at+=1000;gear.refresh();
 assert.equal(gear.observedPerformance().length,1,
  'stat-only changes never create phantom equipment improvements');
 character.slots.ring1={name:'ring',level:0};at+=1000;gear.refresh();
 assert.equal(gear.observedPerformance().length,2);
 assert.equal(gear.observedPerformance()[1].causalityConfirmed,false);
});
