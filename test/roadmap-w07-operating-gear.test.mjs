import test from 'node:test';
import assert from 'node:assert/strict';
import {mutationPreservesOperationalGear} from '../src/production/production.mjs';

function fixture(){
 const now=1700000000000;
 const items=[{name:'staff',level:0},{name:'sword',level:0},
  {name:'hpot0',q:100}];
 const profiles={
  P:{running:true,realm:'EUI',gear:{complete:true,class:'priest',
   level:50,at:now,slots:{mainhand:null,offhand:null}}},
  W:{running:true,realm:'EUI',gear:{complete:true,class:'warrior',
   level:50,at:now,slots:{mainhand:null,offhand:null}}}
 };
 const bot={p:{c:{items},realm:()=> 'EUI',G:{
  classes:{priest:{mainhand:{staff:1},doublehand:{},offhand:{}},
   warrior:{mainhand:{sword:1},doublehand:{},offhand:{}}},
  items:{staff:{type:'weapon',wtype:'staff'},sword:{type:'weapon',wtype:'sword'},
   hpot0:{type:'pot'}}
 }},me:{name:'M',role:'merchant'},farmers:['P','W'],
  transport:{fresh:name=>profiles[name]},
  economy:{safe:i=>!!i&&!i.l&&!i.b}};
 return {bot,items,profiles,now,
  check:slots=>mutationPreservesOperationalGear(bot,slots,{now})};
}
test('W07 last compatible physical mainhand is not a sacrificial mutation input',()=>{
 const f=fixture();
 assert.deepEqual(f.check([0]),{allowed:false,
  reason:'last-observed-functional-mainhand',before:2,after:1,unarmed:2});
 assert.equal(f.check([1]).allowed,false);
 assert.equal(f.check([2]).allowed,true,'potions do not affect mainhand coverage');
 assert.equal(f.check([0,1]).allowed,false);
});
test('W07 actual second usable copy permits mutation without weakening another class',()=>{
 const f=fixture();f.items.push({name:'staff',level:0});
 assert.equal(f.check([0]).allowed,true);
 assert.equal(f.check([0,3]).allowed,false,'all usable copies would be consumed');
 f.items[3].l=true;
 assert.equal(f.check([0]).allowed,false,'locked stack is not a substitute');
});
test('W07 a single weapon is never assigned to two unarmed farmers',()=>{
 const f=fixture();
 f.profiles.W.gear.class='priest';
 f.items.splice(1,1);
 const check=slots=>mutationPreservesOperationalGear(f.bot,slots,{now:f.now});
 assert.deepEqual(check([0]),{allowed:false,
  reason:'last-observed-functional-mainhand',before:1,after:0,unarmed:2});
});
test('W07 worn gear, stale peer, another realm and unknown gear do not create fictitious demand',()=>{
 for(const change of [
  f=>{f.profiles.P.gear.slots.mainhand={name:'staff',level:0};},
  f=>{f.profiles.P.gear.at=f.now-130000;},
  f=>{f.profiles.P.realm='USI';},
  f=>{f.profiles.P.gear.complete=false;}
 ]){
  const f=fixture();change(f);
  assert.equal(f.check([0]).allowed,true);
 }
});
test('W07 malformed input slot sets fail closed, without creating a supply permission',()=>{
 const f=fixture();
 for(const slots of [[-1],[0,0],[99],[1,1]])assert.equal(f.check(slots).allowed,false);
});
test('W07 late observed gear recovery changes the final admissibility decision',()=>{
 const f=fixture(),planned=[0];
 assert.equal(f.check(planned).allowed,false);
 f.items.push({name:'staff',level:1});
 assert.equal(f.check(planned).allowed,true);
 f.items[3]={name:'staff',level:0,l:true};
 assert.equal(f.check(planned).allowed,false);
});

test('W07 malformed spare weapon quantities cannot justify consuming the last real staff',()=>{
 for(const q of [null,0,-1,1.5,NaN,Infinity,
  Number.MAX_SAFE_INTEGER+1,2]){
  const f=fixture();
  f.items.push({name:'staff',q});
  assert.deepEqual(f.check([0]),{
   allowed:false,reason:'last-observed-functional-mainhand',
   before:2,after:1,unarmed:2
  },String(q));
  assert.equal(f.check([1]).allowed,false,
   'invalid copy does not affect independent sword demand');
 }
});

test('W07 ordinary absent q or exactly one staff remain usable spare evidence',()=>{
 for(const spare of [{name:'staff'},{name:'staff',q:1}]){
  const f=fixture();
  f.items.push(spare);
  assert.equal(f.check([0]).allowed,true,
   'real distinct safe staff remains after consumption');
  assert.equal(f.check([0,3]).allowed,false,
   'both real staves cannot be sacrificed');
 }
});

test('W07 malformed nonweapon quantities do not fabricate or veto a weapon',()=>{
 const f=fixture();
 f.items[2]={name:'hpot0',q:null};
 assert.equal(f.check([0]).allowed,false);
 assert.equal(f.check([2]).allowed,true,
  'operational weapon gate does not prohibit unrelated potions');
});
