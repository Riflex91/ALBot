import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedMluckNeed} from '../src/merchant/service-plan.mjs';
const peer={name:'Ranger',running:true,rip:false,realm:'EUII',merchantName:'Merchant'};
test('no mluck round-trip on unknown telemetry or confirmed active buff',()=>{
 assert.equal(confirmedMluckNeed({...peer},'EUII'),false);
 assert.equal(confirmedMluckNeed({...peer,mluck:{ms:500000,f:'Merchant'}},'EUII'),false);
 assert.equal(confirmedMluckNeed({...peer,mluck:{strong:true,ms:10000,f:'Other'}},'EUII'),false);
});
test('explicit missing or near-expiring buff is actionable, cross-realm is not',()=>{
 assert.equal(confirmedMluckNeed({...peer,mluck:null},'EUII'),true);
 assert.equal(confirmedMluckNeed({...peer,mluck:{ms:40000,f:'Merchant'}},'EUII'),true);
 assert.equal(confirmedMluckNeed({...peer,mluck:null,realm:'USI'},'EUII'),false);
});
