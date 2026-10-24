import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryStockEvidence} from '../src/items/stock-evidence.mjs';
import {planMaterialQuotas,materialProgressMatchesInventory}
 from '../src/production/material-quotas.mjs';

const now=1730000000000,realm='EUII';
const request={objective:'material:gem0:plan-1',item:'gem0',monster:'goo',quantity:18};
const peer=(name,stock,progress,extras={})=>{
 const session='session-'+name;
 return {name,session,realm,received:now,running:true,rip:false,
  inventoryBlocked:false,free:12,
  materialProgress:[{objective:request.objective,quantity:progress}],
  inventoryEvidence:inventoryStockEvidence(stock,{owner:name,session,realm,at:now}),
  ...extras};
};
const run=(peers,opts={})=>planMaterialQuotas(request,
 ['A','B'],name=>peers[name],realm,{now,ttlMs:10000,freeReserve:4,...opts});

test('W06 physically consistent material receipts allocate only the proven deficit',()=>{
 const peers={A:peer('A',[{name:'gem0',q:6}],6),
  B:peer('B',[{name:'gem0',q:4}],4)};
 assert.deepEqual(run(peers),{remaining:8,quotas:[
  {name:'A',quantity:10},{name:'B',quantity:8}]});
 assert.equal(materialProgressMatchesInventory(peers.A,request,realm,{now}),true);
});

test('W06 a contradictory complete physical inventory freezes all fresh quotas',()=>{
 const peers={A:peer('A',[{name:'gem0',q:6}],0),
  B:peer('B',[{name:'gem0',q:4}],4)};
 assert.deepEqual(run(peers),{remaining:18,quotas:[]});
 peers.A.materialProgress[0].quantity=7;
 assert.deepEqual(run(peers),{remaining:18,quotas:[]});
 peers.A.materialProgress[0].quantity=6;
 assert.equal(run(peers).remaining,8);
});

test('W06 bound same-item stock permits only the observed free-progress interval',()=>{
 const peers={A:peer('A',[
  {name:'gem0',q:4},{name:'gem0',q:3,l:true}],4),
  B:peer('B',[],0)};
 assert.equal(run(peers).remaining,14);
 peers.A.materialProgress[0].quantity=3;
 assert.deepEqual(run(peers),{remaining:18,quotas:[]});
 peers.A.materialProgress[0].quantity=7;
 assert.equal(run(peers).remaining,11,
  'other game protection flags may retain units in raw material progress');
});

test('W06 optional missing inventory evidence is not a fabricated zero',()=>{
 const peers={A:peer('A',[{name:'gem0',q:5}],5,{inventoryEvidence:null}),
  B:peer('B',[{name:'gem0',q:3}],3)};
 assert.deepEqual(run(peers),{remaining:10,quotas:[
  {name:'A',quantity:10},{name:'B',quantity:8}]});
 // Incomplete evidence is a contradictory observable proof, not authority
 // to claim a known-zero physical stock.
 peers.A.inventoryEvidence={...peer('A',[{name:'gem0',q:5}],5).inventoryEvidence,
  complete:false};
 assert.deepEqual(run(peers),{remaining:18,quotas:[]});
});

test('W06 stale, foreign, duplicated or malformed stock proof freezes all quotas',()=>{
 for(const mutate of [
  h=>h.inventoryEvidence.session='previous-session',
  h=>h.inventoryEvidence.owner='Other',
  h=>h.inventoryEvidence.realm='USI',
  h=>h.inventoryEvidence.at=now-20000,
  h=>h.inventoryEvidence.at=now+1,
  h=>h.inventoryEvidence.rows.push({...h.inventoryEvidence.rows[0]}),
  h=>h.inventoryEvidence.rows[0].quantity=Infinity,
  h=>h.inventoryEvidence.rows[0].quantity=-1,
  h=>h.received=now-20000
 ]){
  const peers={A:peer('A',[{name:'gem0',q:6}],6),
   B:peer('B',[{name:'gem0',q:4}],4)};
  mutate(peers.A);
  assert.deepEqual(run(peers),{remaining:18,quotas:[]});
 }
});
