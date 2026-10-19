import test from 'node:test';
import assert from 'node:assert/strict';
import {purposeReservations} from '../src/production/purpose-allocation.mjs';
import {identity} from '../src/core/policy.mjs';

const G={items:{sword:{upgrade:true}}};
const dex={stat_type:'dex'},str={stat_type:'str'};
const item=(variant,level=1)=>({name:'sword',level,...variant});
const goal=(name,variant,quantity=1)=>({enabled:true,name,
 item:'sword',level:1,quantity,variant,recipient:name,gearSlot:'mainhand'});
function plan(goals,physical,other={}){
 const stock=(name,level,variant)=>physical.filter(i=>i.name===name&&
  (i.level??0)===level&&(!variant||
  identity(i)===identity({name,level,...variant})))
  .reduce((sum,i)=>sum+(i.q??1),0);
 return purposeReservations({G,goals,stock,...other});
}
function quantity(rows,level,variant){
 return rows.filter(r=>r.item==='sword'&&r.level===level&&
  JSON.stringify(r.variant??null)===JSON.stringify(variant??null))
  .reduce((sum,r)=>sum+r.quantity,0);
}
test('W10 distinct exact gear variants use two actually separate physical copies',()=>{
 const result=plan([goal('Ranger',dex),goal('Warrior',str)],
  [item(dex),item(str)]);
 assert.equal(result.blocked,false);
 assert.equal(quantity(result.rows,1,dex),1);
 assert.equal(quantity(result.rows,1,str),1);
 assert.equal(quantity(result.rows,0,dex),0,
  'dex must not cause another upgrade when own copy is already held');
 assert.equal(quantity(result.rows,0,str),0,
  'str uses another physical copy rather than a shared stock counter');
 assert.equal(result.quantity(item(dex)),1);
 assert.equal(result.quantity(item(str)),1);
});
test('W10 same exact variant shared by two recipients still never reuses one physical copy',()=>{
 const result=plan([goal('Ranger',dex),goal('Other',dex)],
  [item(dex)]);
 assert.equal(result.blocked,false);
 assert.equal(quantity(result.rows,1,dex),2);
 assert.equal(quantity(result.rows,0,dex),1,
  'only one physical +1 copy exists, so other goal needs a separate input');
});
test('W10 generic stock and exact variants share a single gross physical inventory',()=>{
 const physical=[item(dex),item(str)];
 const a=plan([goal('Ranger',dex),goal('Economy',null)],physical);
 assert.equal(a.blocked,false);
 assert.equal(quantity(a.rows,0,dex),0);
 assert.equal(quantity(a.rows,0,null),0,
  'the generic goal consumes only the remaining physical copy');
 const b=plan([goal('Economy',null),goal('Ranger',dex)],physical);
 assert.equal(b.blocked,false);
 assert.equal(quantity(b.rows,0,dex),1,
  'an earlier generic consumption may have used dex; do not double count it');
 assert.equal(b.rows.filter(x=>x.level===0)
  .reduce((sum,x)=>sum+x.quantity,0),1);
});
test('W10 missing exact variant does not borrow a different available variant',()=>{
 const result=plan([goal('Ranger',dex),goal('Warrior',str)],
  [item(dex),item(dex)]);
 assert.equal(result.blocked,false);
 assert.equal(quantity(result.rows,0,dex),0);
 assert.equal(quantity(result.rows,0,str),1,
  'the str goal must not claim either dex copy as str stock');
});
test('W10 invalid or contradictory inventory counters fail closed',()=>{
 const goals=[goal('Ranger',dex)];
 for(const bad of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
  const result=purposeReservations({G,goals,
   stock:(name,level,variant)=>variant?1:bad});
  assert.equal(result.blocked,true);
  assert.equal(result.quantity(item(dex)),Infinity);
  assert.deepEqual(result.rows,[]);
 }
 const contradictory=purposeReservations({G,goals,
  stock:(name,level,variant)=>variant?2:1});
 assert.equal(contradictory.blocked,true);
 assert.equal(contradictory.reason,'unverified-stock');
});
test('W10 gross reservation sum exceeding safe integer remains blocked',()=>{
 const tooBig=[goal('Ranger',dex,Number.MAX_SAFE_INTEGER),
  goal('Warrior',dex,2)];
 const result=plan(tooBig,[]);
 assert.equal(result.blocked,true);
 assert.equal(result.quantity(item(dex)),Infinity);
});
