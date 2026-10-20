import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryStockEvidence,reconcileStockEvidence,packInventoryEvidence,unpackInventoryEvidence} from '../src/items/stock-evidence.mjs';

const at=1000000,realm='EUI';
const evidence=(items,reserved=()=>0)=>inventoryStockEvidence(items,{
 owner:'Ranger',session:'ranger-1',realm,at,reserved
});
const ledger=proof=>reconcileStockEvidence({
 owner:'Merchant',session:'merchant-1',realm,now:at,
 local:inventoryStockEvidence([],{owner:'Merchant',session:'merchant-1',realm,at}),
 peers:[{name:'Ranger',session:'ranger-1',realm,received:at,running:true,
  inventoryEvidence:proof}],expected:['Ranger']
});

test('W10/W02 invalid explicit quantities cannot certify complete peer stock',()=>{
 for(const q of [null,0,-1,0.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1]){
  const proof=evidence([{name:'ore',q}]);
  assert.equal(proof.complete,false,String(q));
  const result=ledger(proof);
  assert.equal(result.complete,false,String(q));
  assert.equal(result.quantity('ore'),null);
 }
 const implicit=evidence([{name:'ore'}]);
 assert.equal(implicit.complete,true);
 assert.equal(ledger(implicit).quantity('ore'),1);
});

test('W10 gross reservations are bounded to physical held units in shadow receipts',()=>{
 const proof=evidence([{name:'ore',q:2}],()=>10);
 assert.equal(proof.complete,true);
 assert.equal(proof.rows[0].reservedUnits,2);
 const unpacked=unpackInventoryEvidence(packInventoryEvidence(proof));
 assert.ok(unpacked);
 assert.equal(ledger(unpacked).quantity('ore'),0);
});

test('W10 tampered peer reservations larger than held stock fail closed',()=>{
 const proof=structuredClone(evidence([{name:'ore',q:2}]));
 proof.rows[0].reservedUnits=3;
 assert.equal(ledger(proof).complete,false);
 assert.equal(ledger(proof).quantity('ore'),null);
 assert.equal(unpackInventoryEvidence(packInventoryEvidence(proof)),null);
});
