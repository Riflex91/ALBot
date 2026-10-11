import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingDeliveryRuleNeeds,needsProductionStock} from '../src/production/production.mjs';

test('identical elixirs create independent delivery demand for all three farmers',()=>{
 const goals=['My_Ranger1','My_Ranger2','My_Rogue'].map(recipient=>({name:'Elixir for '+recipient,recipient,item:'elixirdex0',level:0,quantity:1}));
 const pending=pendingDeliveryRuleNeeds(goals,()=>0,'My_Merchant');
 assert.deepEqual(pending.map(x=>x.recipient),['My_Ranger1','My_Ranger2','My_Rogue']);
 assert.deepEqual(pending.map(x=>x.quantity),[1,1,1]);
});

test('two identical ring slot demands are counted without suppressing other recipients',()=>{
 const goals=[{recipient:'My_Rogue',item:'ringsj',level:1,quantity:1,gearSlot:'ring1'},
  {recipient:'My_Rogue',item:'ringsj',level:1,quantity:1,gearSlot:'ring2'},
  {recipient:'My_Ranger1',item:'ringsj',level:1,quantity:1,gearSlot:'ring1'}];
 const received=goal=>goal.gearSlot==='ring1'&&goal.recipient==='My_Rogue'?1:0;
 const pending=pendingDeliveryRuleNeeds(goals,received,'My_Merchant');
 assert.equal(pending.length,2);
 assert.deepEqual(pending.map(g=>[g.recipient,g.quantity]),[['My_Rogue',1],['My_Ranger1',1]]);
});

test('fulfilled local inventory is dispatched separately and must not pin production goal',()=>{
 assert.equal(needsProductionStock(1,1),false);
 assert.equal(needsProductionStock(3,2),false);
 assert.equal(needsProductionStock(0,1),true);
});
