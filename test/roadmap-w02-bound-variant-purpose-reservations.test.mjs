import test from 'node:test';
import assert from 'node:assert/strict';
import {purposeReservations} from '../src/production/purpose-allocation.mjs';
import {identity} from '../src/core/policy.mjs';

const G={items:{sword:{upgrade:true},gem:{}}};
const goal=(variant,options={})=>({
 enabled:true,name:'Ranger sword',item:'sword',level:1,quantity:1,
 recipient:'Ranger',gearSlot:'mainhand',variant,...options
});
function testPlan(goals,physical=[],extra={}){
 return purposeReservations({G,goals,
  stock:(name,level,variant)=>physical.filter(i=>i?.name===name&&
   (i.level??0)===level&&(!variant||
    identity(i)===identity({name,level,...variant})))
   .reduce((n,i)=>n+(i.q??1),0),...extra});
}
const assertBlocked=(result,label)=>{
 assert.equal(result.blocked,true,label);
 assert.deepEqual(result.rows,[]);
 assert.equal(result.quantity({name:'sword',level:1}),Infinity);
};

test('W02 exact purpose goal cannot override the source item or level',()=>{
 const physical=[{name:'sword',level:1,stat_type:'dex'},
  {name:'gem',level:1,stat_type:'dex'}];
 for(const variant of [
  {name:'gem',stat_type:'dex'},
  {name:null,stat_type:'dex'},
  {level:2,stat_type:'dex'},
  {level:0,stat_type:'dex'},
  {name:'sword',level:2,stat_type:'dex'}
 ]){
  const r=testPlan([goal(variant)],physical);
  assertBlocked(r,'spoofed explicit variant must never free a sword');
  assert.equal(r.reason,'invalid-purpose-variant');
 }
});

test('W02 exact variant data must be bounded, serializable and object shaped',()=>{
 const cycle={stat_type:'dex'};cycle.self=cycle;
 for(const variant of [
  cycle, {data:{token:1n}},[],false,'dex',13,
  {data:{notes:'x'.repeat(2100)}}
 ]){
  const r=testPlan([goal(variant)],[]);
  assertBlocked(r,'malformed variant cannot silently become generic demand');
 }
});

test('W02 zero or fully satisfied goal cannot use a spoofed exact variant',()=>{
 for(const options of [
  {quantity:0},
  {quantity:1}
 ]){
  const g=goal({name:'gem',stat_type:'dex'},options);
  const r=testPlan([g],[],{delivered:()=>1});
  assertBlocked(r,'a fulfilled goal cannot launder a spoofed variant');
 }
});

test('W02 generic and exact stocks retain bounded physical separation',()=>{
 const phys=[{name:'sword',level:1,stat_type:'dex'},
  {name:'sword',level:1,stat_type:'str'}];
 const plans=[
  testPlan([goal({stat_type:'dex'}),goal(null,{name:'Other',recipient:'Other'})],phys),
  testPlan([goal(null),goal({stat_type:'dex'},{name:'Other',recipient:'Other'})],phys)
 ];
 for(const p of plans){
  assert.equal(p.blocked,false);
  assert.equal(p.quantity({name:'sword',level:1,stat_type:'dex'}),2);
  assert.equal(p.quantity({name:'sword',level:1,stat_type:'str'}),1);
 }
 const exact=testPlan([goal({stat_type:'dex'})],phys);
 assert.equal(exact.blocked,false);
 assert.equal(exact.quantity({name:'sword',level:1,stat_type:'dex'}),1);
 assert.equal(exact.quantity({name:'sword',level:1,stat_type:'str'}),0);
});

test('W02 malformed physical variant has maximum reservation instead of an exception',()=>{
 const r=testPlan([goal({stat_type:'dex'})],[{name:'sword',level:1,stat_type:'dex'}]);
 assert.equal(r.blocked,false);
 const cycle={seed:1};cycle.parent=cycle;
 for(const damaged of [
  {name:'sword',level:1,data:cycle},
  {name:'sword',level:1,data:{big:1n}},
  {name:'sword',level:1,data:{notes:'x'.repeat(600)}},
  {name:'sword',level:NaN},{name:'sword',level:1.5},null
 ]){
  assert.doesNotThrow(()=>r.quantity(damaged));
  assert.equal(r.quantity(damaged),Infinity,
   'corrupt queried item must not become unreserved surplus');
 }
});

test('W02 malformed delivered counter and goals block all purpose reservations',()=>{
 const phys=[{name:'sword',level:1,stat_type:'dex'}],g=goal({stat_type:'dex'});
 for(const invalid of [-1,NaN,Infinity,1.25,'0']){
  assertBlocked(testPlan([g],phys,{delivered:()=>invalid}));
 }
 for(const invalid of [null,{},[{...g,quantity:-1}],[{...g,quantity:0.5}],
  [{...g,item:''}],[{...g,level:Infinity}]]){
  assertBlocked(testPlan(invalid,phys));
 }
});

test('W02 formerly overfulfilled goal does not deny unrelated valid new demand',()=>{
 const a=goal({stat_type:'dex'},{quantity:1}),
  b=goal({stat_type:'str'},{name:'Warrior sword',recipient:'Warrior'});
 const r=testPlan([a,b],[
  {name:'sword',level:1,stat_type:'str'},
  {name:'sword',level:1,stat_type:'dex'}],{
  delivered:g=>g.recipient==='Ranger'?3:0
 });
 assert.equal(r.blocked,false);
 assert.equal(r.quantity({name:'sword',level:1,stat_type:'dex'}),0);
 assert.equal(r.quantity({name:'sword',level:1,stat_type:'str'}),1);
});

test('W02 completely unknown stock callback cannot authorize unreserved value actions',()=>{
 const g=goal({stat_type:'dex'});
 assertBlocked(purposeReservations({G,goals:[g],stock:()=>{throw Error('unavailable inventory');}}));
 assertBlocked(purposeReservations({G,goals:[g],stock:()=>1,delivered:()=>{throw Error('unavailable receipt');}}));
 const safe=testPlan([g],[{name:'sword',level:1,stat_type:'dex'}]);
 assert.equal(safe.blocked,false);
 assert.equal(safe.quantity({name:'sword',level:1,stat_type:'dex'}),1);
});
