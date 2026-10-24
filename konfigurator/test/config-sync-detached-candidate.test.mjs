import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {envelope,importProfile} from '../../editor/lib/contract.mjs';
import {signer,preparePrivateRelease} from '../worker/private-config-release.mjs';
import {createVerifiedConfigStaging} from '../../src/runtime/config-sync-stage.mjs';
import {evaluateDetachedConfigCandidate} from '../../src/runtime/config-sync-detached-candidate.mjs';

const NOW=1792600000000;
const profile=envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,
 JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'))));
const CHARACTER=profile.config.characters.find(c=>c.enabled===true)?.name;
assert.ok(CHARACTER);
async function signed(){
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},
  true,['sign','verify']);
 const identity=await signer({
  CONFIG_SIGNING_JWK:JSON.stringify(
   await webcrypto.subtle.exportKey('jwk',pair.privateKey)),
  CONFIG_SIGNING_TARGET:'ALBot/TestAccount'
 },webcrypto.subtle);
 return {identity,release:await preparePrivateRelease({
  profile,identity,now:NOW})};
}
function setup(identity,{clock=NOW,character=CHARACTER,stored={},config=profile.config}={}){
 const data={clock,character,pin:{target:identity.target,publicJwk:identity.publicJwk}};
 const storage={
  getItem:key=>Object.hasOwn(stored,key)?stored[key]:null,
  setItem:(key,value)=>{stored[key]=value;},
  removeItem:key=>{delete stored[key];}
 };
 const stage=createVerifiedConfigStaging({
  readTrust:()=>data.pin,readCharacter:()=>data.character,
  readStorage:()=>storage,cryptoObject:webcrypto,now:()=>data.clock
 });
 return {data,stored,storage,stage,config,
  cursorKey:'albot:config:applied:v1:'+identity.target};
}
test('real signed P256 stage produces detached normalized Full-v1 feasibility report without config leakage or write',async()=>{
 const {identity,release}=await signed(),box=setup(identity);
 assert.equal(await box.stage.stage(release),true);
 const active=structuredClone(box.config);
 const signedSnapshot=structuredClone(release);
 const storedBefore=structuredClone(box.stored);
 const result=await box.stage.dryRun(active);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.sequence,release.sequence);
 assert.equal(result.sha256,release.sha256);
 assert.equal(result.character,CHARACTER);
 assert.equal(result.format,'albot-config-detached-candidate/v1');
 assert.equal(result.mode,'detached-validation-only');
 assert.equal(result.restartRequired,true);
 assert.equal(result.inPlaceSwapSupported,false);
 assert.equal(result.transactionCommitted,false);
 assert.equal(result.readyForActivation,false);
 assert.equal(result.applied,false);
 assert.equal(result.acknowledged,false);
 assert.ok(Array.isArray(result.changedSections));
 assert.deepEqual(active,box.config);
 assert.deepEqual(release,signedSnapshot);
 assert.deepEqual(box.stored,storedBefore);
 assert.equal(box.stored[box.cursorKey],undefined);
 assert.equal(JSON.stringify(result).includes('"config"'),false);
 assert.equal(JSON.stringify(result).includes('"profile"'),false);
 assert.equal(JSON.stringify(result).includes(release.signature),false);
 box.stage.dispose();
});
test('detached candidate recognizes changes without altering source or active state',()=>{
 const active=structuredClone(profile.config),other=structuredClone(profile);
 const changed=other.config.characters.find(c=>c.name===CHARACTER);
 const before=structuredClone(other);
 const result=evaluateDetachedConfigCandidate(other,active,CHARACTER);
 assert.equal(result.readyForActivation,false);
 assert.equal(result.transactionCommitted,false);
 assert.deepEqual(other,before);
 assert.deepEqual(active,profile.config);
 assert.ok(result.enabledCharacters>=1);
});
test('invalid roster, merchant owner, recipient, character and schema always reject before touching caller data',()=>{
 const cases=[
  x=>{x.config.characters.find(c=>c.name===CHARACTER).enabled=false;},
  x=>{x.config.characters[0].group='OtherGroup';},
  x=>{x.config.party.merchant='IncorrectMerchant';},
  x=>{x.format='fake';},
  x=>{x.schemaId='albot.legacy';},
  x=>{x.config.characters[0].role='unknown';}
 ];
 for(const change of cases){
  const value=structuredClone(profile);change(value);
  const frozen=structuredClone(value);
  assert.throws(()=>evaluateDetachedConfigCandidate(value,profile.config,CHARACTER),
   /Detached Full-v1 candidate rejected/);
  assert.deepEqual(value,frozen);
 }
 assert.throws(()=>evaluateDetachedConfigCandidate(profile,null,CHARACTER),
  /rejected/);
 assert.throws(()=>evaluateDetachedConfigCandidate(profile,profile.config,'UnknownName'),
  /rejected/);
});
test('restart requires fresh signature; changed applied high-water, trust or expiry abort detached plan',async()=>{
 const {identity,release}=await signed();
 for(const drift of [
  b=>{b.data.clock=release.expiresAt;},
  b=>{b.stored[b.cursorKey]=JSON.stringify({
   target:identity.target,sequence:release.sequence,sha256:release.sha256});},
  b=>{b.data.character='OtherCharacter';},
  b=>{b.data.pin={...b.data.pin,target:'ALBot/OtherAccount'};},
  b=>{b.data.pin={...b.data.pin,publicJwk:{
   ...b.data.pin.publicJwk,x:'z'.repeat(43)}};}
 ]){
  const box=setup(identity);
  assert.equal(await box.stage.stage(release),true);
  drift(box);
  const report=await box.stage.dryRun(profile.config);
  assert.equal(report.ok,false);
  assert.equal(report.readyForActivation,false);
  assert.equal(report.applied,false);
  assert.equal(report.transactionCommitted,undefined);
  box.stage.dispose();
 }
 const box=setup(identity),initial=box.stage;
 assert.equal(await initial.stage(release),true);
 initial.dispose();
 const restarted=setup(identity,{stored:box.stored});
 assert.equal((await restarted.stage.dryRun(profile.config)).ok,false);
 assert.equal(await restarted.stage.stage(release),true);
 assert.equal((await restarted.stage.dryRun(profile.config)).ok,true);
 restarted.stage.dispose();
});
