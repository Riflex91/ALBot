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

test('W02 malformed transmitted variant identifiers fail closed before and after transport',()=>{
 const valid=evidence([{name:'ore',q:4,acc:1,rid:'listing-1'}]);
 assert.equal(valid.complete,true);
 const packed=packInventoryEvidence(valid);
 assert.ok(packed);
 assert.equal(ledger(unpackInventoryEvidence(packed)).quantity('ore'),4);
 for(const [field,index] of [['acc',5],['rid',6]]){
  for(const value of [-1,1.25,Infinity,NaN,Number.MAX_SAFE_INTEGER+1,'x'.repeat(81)]){
   const forged=structuredClone(valid);
   forged.rows[0].item[field]=value;
   assert.equal(ledger(forged).complete,false,field+':'+String(value));
   assert.equal(packInventoryEvidence(forged),null,
    'unserializable identities cannot turn into omitted/null fields');
   const wire=structuredClone(packed);
   wire.x[0][index]=value;
   assert.equal(unpackInventoryEvidence(wire),null,field+':'+String(value));
  }
 }
});
