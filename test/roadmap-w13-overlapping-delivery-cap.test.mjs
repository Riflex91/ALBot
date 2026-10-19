import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingDeliveryRuleNeeds} from '../src/production/production.mjs';
import {identity} from '../src/core/policy.mjs';

const dex={stat_type:'dex'},str={stat_type:'str'};
const goal=(recipient,variant,quantity=1,slot='mainhand')=>({
 name:recipient+'-'+slot,item:'sword',level:1,recipient,
 gearSlot:slot,quantity,variant
});
const source=(variant)=>({name:'sword',level:1,...variant});
function needs(goals,physical,delivered=()=>0){
 const available=g=>physical.filter(i=>i.name===g.item&&
  (i.level??0)===g.level&&(!g.variant||
  identity(i)===identity({name:g.item,level:g.level,...g.variant})))
  .reduce((n,i)=>n+(i.q??1),0);
 return pendingDeliveryRuleNeeds(goals,delivered,'Merchant',available);
}
test('W13 generic and exact delivery targets cannot promise one item twice',()=>{
 const stock=[source(dex)];
 const first=needs([goal('A',null),goal('B',dex)],stock);
 assert.deepEqual(first.map(x=>[x.recipient,x.quantity]),[['A',1]]);
 const reversed=needs([goal('B',dex),goal('A',null)],stock);
 assert.deepEqual(reversed.map(x=>[x.recipient,x.quantity]),[['B',1]]);
});
test('W13 distinct exact variants independently serve different physical recipients',()=>{
 const stock=[source(dex),source(str)];
 const rows=needs([goal('A',dex),goal('B',str)],stock);
 assert.deepEqual(rows.map(x=>[x.recipient,x.quantity]),[['A',1],['B',1]]);
 assert.equal(rows[0].variant.stat_type,'dex');
 assert.equal(rows[1].variant.stat_type,'str');
});
test('W13 exact then generic may consume two disjoint copies but generic then exact stays cautious',()=>{
 const stock=[source(dex),source(str)];
 assert.deepEqual(needs([goal('A',dex),goal('B',null)],stock)
  .map(x=>[x.recipient,x.quantity]),[['A',1],['B',1]]);
 assert.deepEqual(needs([goal('B',null),goal('A',dex)],stock)
  .map(x=>[x.recipient,x.quantity]),[['B',1]],
  'earlier generic commitment might have consumed the only dex copy');
});
test('W13 same variant and two gear slots sum only physically available units',()=>{
 const stock=[source(dex),source(dex)];
 const rows=needs([goal('A',dex,1,'mainhand'),
  goal('A',dex,1,'offhand'),goal('B',dex,1)],stock);
 assert.equal(rows.length,1);
 assert.equal(rows[0].recipient,'A');
 assert.equal(rows[0].quantity,2);
 const onlyOne=needs([goal('A',dex,1,'mainhand'),
  goal('A',dex,1,'offhand')],[source(dex)]);
 assert.equal(onlyOne.length,1);
 assert.equal(onlyOne[0].quantity,1);
});
test('W13 delivered recipient stock reduces demand before new rules are created',()=>{
 const stock=[source(dex),source(str)];
 const rows=needs([goal('A',dex),goal('B',str)],stock,
  g=>g.recipient==='A'?1:0);
 assert.deepEqual(rows.map(x=>[x.recipient,x.quantity]),[['B',1]]);
});
test('W13 unverified stock or delivery counters grant no new send rule',()=>{
 const goals=[goal('A',dex)];
 for(const invalid of [NaN,-1,1.5,undefined]){
  const result=pendingDeliveryRuleNeeds(goals,()=>0,'Merchant',
   g=>g.variant?invalid:1);
  assert.deepEqual(result,[]);
 }
 assert.deepEqual(pendingDeliveryRuleNeeds(goals,()=>NaN,
  'Merchant',()=>1),[]);
 assert.deepEqual(pendingDeliveryRuleNeeds(goals,()=>0,
  'Merchant',g=>g.variant?2:1),[]);
 assert.equal(pendingDeliveryRuleNeeds(goals,()=>0,'Merchant').length,1,
  'the historical no-cap callback default remains explicitly unlimited');
});
