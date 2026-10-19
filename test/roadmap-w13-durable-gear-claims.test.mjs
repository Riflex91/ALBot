import test from 'node:test';
import assert from 'node:assert/strict';
import {createGearAllocation,unclaimedGearUnits} from '../src/production/allocation.mjs';
import {fingerprint,identity} from '../src/core/policy.mjs';

function fixture({initial=[],inventory=null}={}){
 const writes=new Map(),events=[];
 const item={name:'staff',level:3,stat_type:'int'};
 const items=inventory??[{...item}];
 const peer={name:'Priest',running:true,rip:false,realm:'EUI',
  session:'r1',gear:{slots:{mainhand:null}}};
 const goal={name:'Starter Priest',recipient:'Priest',item:'staff',
  level:3,gearSlot:'mainhand',priority:1000,enabled:true};
 let goals=[goal],realm='EUI',persist=true;
 const key='albot:gear:Merchant:allocations';writes.set(key,structuredClone(initial));
 const bot={me:{name:'Merchant',role:'merchant'},
  cfg:{general:{messageTtlMs:10000},party:{merchant:'Merchant'}},
  p:{c:{items},read:k=>writes.get(k)??null,
   write:(k,v)=>{if(!persist)return false;writes.set(k,structuredClone(v));return true;},
   realm:()=>realm},
  transport:{fresh:()=>peer},
  gear:{goals:()=>goals},event:(...args)=>events.push(args)};
 const allocation=createGearAllocation(bot);
 function job(overrides={}){
  const live=items[0],gear={goal:goal.name,slot:'mainhand',
   expected:fingerprint(peer.gear.slots.mainhand),item};
  return {id:'session:1',to:'Priest',session:peer.session,
   slot:0,item:{...live},fingerprint:fingerprint(live),
   gear,gearAck:gear.expected,quantity:1,receipt:false,...overrides};
 }
 return {bot,allocation,item,items,peer,goal,job,writes,
  setGoals:g=>{goals=g;},setRealm:r=>{realm=r;},
  setPersist:x=>{persist=x;}};
}
test('W13 one physically carried copy minus a durable unresolved claim grants no second gear promise',()=>{
 const f=fixture();
 const j=f.job();
 assert.equal(f.allocation.offer(f.item,'Priest')?.slot,'mainhand');
 assert.equal(f.allocation.guard(j),true,'first in-range offer may enter reserve');
 assert.equal(f.allocation.reserve(j),true);
 assert.equal(f.allocation.guard(j),true,'reserved job remains dispatchable');
 assert.equal(f.allocation.settle(j,'unknown'),true);
 assert.equal(f.allocation.status()[0].state,'unresolved');
 assert.equal(f.allocation.offer(f.item,'Priest'),false);
 const next=f.job({id:'session:2'});
 assert.equal(f.allocation.reserve(next),false);
 assert.equal(f.allocation.guard(next),false);
 assert.equal(f.allocation.status().length,1);
});
test('W13 two genuinely independent physical copies permit one new claim after an unknown first',()=>{
 const f=fixture({inventory:[
  {name:'staff',level:3,stat_type:'int'},
  {name:'staff',level:3,stat_type:'int'}]});
 const j=f.job();
 assert.equal(f.allocation.reserve(j),true);
 assert.equal(f.allocation.settle(j,'unknown'),true);
 assert.equal(f.allocation.offer(f.item,'Priest')?.slot,'mainhand');
 const j2=f.job({id:'session:2',slot:1,item:{...f.items[1]},
  fingerprint:fingerprint(f.items[1])});
 assert.equal(f.allocation.reserve(j2),true);
 assert.equal(f.allocation.guard(j2),true);
 assert.equal(f.allocation.status().length,2);
 assert.equal(f.allocation.offer(f.item,'Priest'),false);
});
test('W13 missing current target never authorizes an old accepted gear dispatch',()=>{
 const f=fixture(),j=f.job();
 assert.equal(f.allocation.guard(j),true);
 f.setGoals([]);
 assert.equal(f.allocation.guard(j),false);
 assert.equal(f.allocation.reserve(j),false);
 assert.equal(f.allocation.offer(f.item,'Priest'),null);
});
test('W13 changed peer session, receiving equipment and realm reject gear reservation',()=>{
 for(const change of [
  f=>{f.peer.session='restarted';},
  f=>{f.peer.gear.slots.mainhand={name:'staff',level:3};},
  f=>{f.items[0].level=4;}
 ]){
  const f=fixture(),j=f.job();change(f);
  assert.equal(f.allocation.guard(j),false);
  assert.equal(f.allocation.reserve(j),false);
 }
 const f=fixture(),j=f.job();assert.equal(f.allocation.reserve(j),true);
 f.setRealm('USI');
 assert.equal(f.allocation.guard(j),false);
});
test('W13 persist failure must not create accepted gear claim or allow confirmed dispatch',()=>{
 const f=fixture(),j=f.job();
 f.setPersist(false);
 assert.equal(f.allocation.reserve(j),false);
 assert.deepEqual(f.allocation.status(),[]);
 assert.equal(f.allocation.guard(j),true,'pre-reserve guard is not a persisted claim');
});
test('W13 reservation replay must match the exact recipient, variant, quantity and slot',()=>{
 const f=fixture(),j=f.job();
 assert.equal(f.allocation.reserve(j),true);
 assert.equal(f.allocation.reserve(j),true);
 for(const changed of [
  {to:'Other'},{quantity:2},{slot:1},{session:'reboot'},
  {fingerprint:'stale'}
 ]){
  assert.equal(f.allocation.reserve({...j,...changed}),false);
 }
 assert.equal(f.allocation.status().length,1);
});
test('W13 protected and malformed inventory stock or malformed pending claim fail closed',()=>{
 const item={name:'staff',level:3,stat_type:'int'};
 const id=identity(item);
 assert.equal(unclaimedGearUnits([], [item],item),1);
 assert.equal(unclaimedGearUnits([], [{...item,l:'s'}],item),0);
 assert.equal(unclaimedGearUnits([], [{...item,q:0}],item),0);
 assert.equal(unclaimedGearUnits([], [{...item,q:1.5}],item),0);
 assert.equal(unclaimedGearUnits([{id:'a',state:'unresolved',variant:id,quantity:1}],
  [item],item),0);
 assert.equal(unclaimedGearUnits([{id:'a',state:'unresolved',variant:id,quantity:2}],
  [item,item],item),0);
 assert.equal(unclaimedGearUnits([{id:'a',state:'unresolved',variant:id,quantity:null}],
  [item],item),0);
 assert.equal(unclaimedGearUnits([{id:'a',state:'delivered',variant:id,quantity:1}],
  [item],item),1);
});
test('W13 completed gear transfer releases live physical claim without erasing its history',()=>{
 const f=fixture(),j=f.job();
 assert.equal(f.allocation.reserve(j),true);
 assert.equal(f.allocation.settle({...j,receipt:true},'confirmed'),true);
 assert.equal(f.allocation.status()[0].state,'delivered');
 assert.equal(f.allocation.offer(f.item,'Priest')?.slot,'mainhand',
  'a second genuinely available copy is not permanently blocked by a delivered record');
});

test('W13 gear offer requires verified live and addressed receiver in same realm',()=>{
 for(const change of [
  p=>{p.name='Other';},
  p=>{p.running=false;},
  p=>{p.rip=true;},
  p=>{p.realm='USV';},
  p=>{p.realm=null;},
  p=>{p.session='';},
  p=>{delete p.name;}
 ]){
  const f=fixture();change(f.peer);
  assert.equal(f.allocation.offer(f.item,'Priest'),false);
  assert.equal(f.allocation.reserve(f.job()),false);
 }
});

test('W13 prepared gear reservations cannot dispatch after recipient loss or realm travel',()=>{
 for(const change of [
  p=>{p.running=false;},
  p=>{p.rip=true;},
  p=>{p.realm='USV';},
  p=>{p.name='Unknown';},
  p=>{p.session='restarted';}
 ]){
  const f=fixture(),j=f.job();
  assert.equal(f.allocation.reserve(j),true);
  assert.equal(f.allocation.guard(j),true);
  change(f.peer);
  assert.equal(f.allocation.guard(j),false);
  assert.equal(f.allocation.reserve(j),false,
   'a stored reservation is never executable on stale recipient evidence');
  assert.equal(f.allocation.status()[0].state,'reserved',
   'the durable claim must not be silently cleared or resent');
 }
});

test('W13 a previously reserved gear claim cannot be reused in another realm',()=>{
 const f=fixture(),j=f.job();
 assert.equal(f.allocation.reserve(j),true);
 f.setRealm('USV');
 f.peer.realm='USV';
 assert.equal(f.allocation.guard(j),false);
 assert.equal(f.allocation.reserve(j),false);
 assert.equal(f.allocation.status()[0].state,'reserved');
});
