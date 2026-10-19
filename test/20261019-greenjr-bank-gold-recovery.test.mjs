import test from 'node:test';
import assert from 'node:assert/strict';
import {bankGoldRecoverySnapshot} from '../src/core/recovery.mjs';
import {shouldDeferBossReadiness} from '../src/combat/bosses.mjs';
import {fingerprint} from '../src/core/policy.mjs';

test('greenjr: assembling and shield phases wait without a failed-target quarantine',()=>{
 assert.equal(shouldDeferBossReadiness({safe:false,phase:'ASSEMBLE',reason:'Bossgruppe unvollständig'}),true);
 assert.equal(shouldDeferBossReadiness({safe:false,phase:'WAIT',reason:'Schutzphase abwarten'}),true);
 assert.equal(shouldDeferBossReadiness({safe:false,phase:'ABORT',reason:'Burst-/Add-Schaden zu hoch'}),false);
 assert.equal(shouldDeferBossReadiness({safe:true,phase:'ENGAGE'}),false);
});

const at=1792352236635;
const item={name:'hpot0',level:0,q:4};
const j={kind:'bank.gold',quantity:118480,before:318480,cost:0,loss:0,
 slots:[],at,evidence:{realm:'EUII',gold:318480,inventory:[fingerprint(item),null]}};
const live={map:'bank',gold:547120,bank:{gold:275000},items:[item,null]};

test('bank.gold: current on-bank balances may be reconciled without asserting the old transfer outcome',()=>{
 const result=bankGoldRecoverySnapshot(j,live,'EUII','bank',at+120001);
 assert.equal(result.eligible,true);
 assert.equal(result.wallet,547120);
 assert.equal(result.bankGold,275000);
 assert.ok(result.signature);
});

test('bank.gold: age, live bank access, and full unchanged inventory are required',()=>{
 assert.equal(bankGoldRecoverySnapshot(j,live,'EUII','bank',at+119999).eligible,false);
 assert.equal(bankGoldRecoverySnapshot(j,{...live,map:'main'},'EUII','bank',at+200000).eligible,false);
 assert.equal(bankGoldRecoverySnapshot(j,{...live,bank:{gold:null}},'EUII','bank',at+200000).eligible,false);
 assert.equal(bankGoldRecoverySnapshot(j,{...live,items:[{...item,q:3},null]},'EUII','bank',at+200000).reason,'inventory-changed-since-bank-gold-intent');
 assert.equal(bankGoldRecoverySnapshot({...j,quantity:-2},live,'EUII','bank',at+200000).eligible,false);
 assert.equal(bankGoldRecoverySnapshot(j,live,'USI','bank',at+200000).eligible,false);
 assert.equal(bankGoldRecoverySnapshot({...j,kind:'bank.store'},live,'EUII','bank',at+200000).eligible,false);
});
