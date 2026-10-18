import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {completeStartupConfig,startupDescriptor} from '../src/main.mjs';
import {validateProfile,defaultsFor} from '../editor/lib/contract.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {LIVE_DESCRIPTOR} from '../src/config/live-a.mjs';

// Exercise the exact personalized CODE settings that caused immediate
// "Pflichtfeld fehlt" reports on 0.10.6, rather than a synthetic minimum.
function personalConfig(){
 const content=readFileSync(new URL('../bot.js',import.meta.url),'utf8');
 const start=content.indexOf('globalThis.ALBotConfig=');
 const runtime=content.indexOf('/* ALBot ',start);
 assert.ok(start>=0&&runtime>start,'recognized personal CODE + runtime boundary');
 return JSON.parse(content.slice(start+'globalThis.ALBotConfig='.length,runtime).trim().replace(/;$/,''));
}

test('personal CODE carries the requested account-loss policy and validates new storage settings',()=>{
 const config=personalConfig();
 assert.equal(config.merchant.budgetMode,'account-loss');
 assert.equal(config.merchant.accountLossWindowMs,900000);
 assert.deepEqual(config.merchant.offlineGoldBalances.map(r=>r.gold),[0,0,0,0]);
 assert.equal(config.merchant.preventiveStorage,true);assert.equal(config.farming.maxAggro,12);
 assert.equal(startupDescriptor(config),FULL_DESCRIPTOR);
 assert.deepEqual(validateProfile(FULL_DESCRIPTOR,config),[]);
});

test('old saved personalized CODE starts after missing merchant fields are completed',()=>{
 const old=personalConfig();
 for(const key of ['budgetMode','accountLossWindowMs','offlineGoldBalances'])
  delete old.merchant[key];
 const before=structuredClone(old);
 assert.equal(validateProfile(FULL_DESCRIPTOR,old).some(s=>s.includes('budgetMode')),true,
  'previous CODE used to fail at startup');
 const repaired=completeStartupConfig(old);
 assert.deepEqual(old,before,'startup migration does not mutate user source config');
 assert.equal(repaired.merchant.budgetMode,'bounded');
 assert.equal(repaired.merchant.accountLossWindowMs,900000);
 assert.deepEqual(repaired.merchant.offlineGoldBalances,[]);
 assert.deepEqual(validateProfile(FULL_DESCRIPTOR,repaired),[]);
 const expected=personalConfig();expected.merchant.budgetMode='bounded';expected.merchant.accountLossWindowMs=900000;expected.merchant.offlineGoldBalances=[];
 expected.general.callCostCeiling=160;expected.world.eventGraceMs=2500;expected.world.seasonalBuff=true;expected.world.boosters=false;expected.world.activateBoosters=false;
 // New W02 field is optional in saved CODE. Startup normalization adds
 // the conservative `hold` default without rewriting personal settings.
 for(const rule of expected.items??[])if(!Object.hasOwn(rule,'excessAction'))
  rule.excessAction='hold';
 assert.deepEqual(repaired,expected,
  'no existing custom farmer, merchant or world settings are changed');
});

test('defaults migration never silently blesses invalid explicit budget or gold evidence',()=>{
 const old=personalConfig();
 old.merchant.budgetMode='unlimited';
 old.merchant.accountLossWindowMs=-1;
 old.merchant.offlineGoldBalances=[{name:'O',gold:-10}];
 const normalized=completeStartupConfig(old);
 assert.equal(normalized.merchant.budgetMode,'unlimited');
 assert.equal(normalized.merchant.accountLossWindowMs,-1);
 assert.deepEqual(normalized.merchant.offlineGoldBalances,[{name:'O',gold:-10}]);
 const errors=validateProfile(FULL_DESCRIPTOR,normalized);
 assert.ok(errors.length>=3,errors.join('; '));
});

test('non-FULL legacy startup uses its own schema, without adding unrelated merchant defaults',()=>{
 const old=defaultsFor(LIVE_DESCRIPTOR.schema);
 assert.equal(old.general.testLogging,undefined);
 assert.equal(startupDescriptor(old),LIVE_DESCRIPTOR);
 const normalized=completeStartupConfig(old);
 assert.equal(normalized.merchant?.budgetMode,undefined);
 assert.deepEqual(normalized,old);
});
