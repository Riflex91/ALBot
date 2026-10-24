import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {envelope,importProfile} from '../../editor/lib/contract.mjs';
import {signer,preparePrivateRelease} from '../worker/private-config-release.mjs';
import {simulateDetachedRestartRecovery}
 from '../../src/runtime/config-sync-recovery-rehearsal.mjs';
import {createVerifiedConfigStaging}
 from '../../src/runtime/config-sync-stage.mjs';

const TIME=1792600000000;
const profile=envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,
 JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'))));
const CHARACTER=profile.config.characters.find(x=>x.enabled===true)?.name;
assert.ok(CHARACTER);
function sim(faultAt=null,source=profile,active=profile.config){
 return simulateDetachedRestartRecovery({activeConfig:active,
  profile:source,character:CHARACTER,faultAt});
}
test('full valid Full-v1 sandbox always restores independent active graph and never claims a commit',()=>{
 const source=structuredClone(profile),active=structuredClone(profile.config);
 const original=structuredClone(active),originalProfile=structuredClone(source);
 const r=sim(null,source,active);
 assert.equal(r.format,'albot-config-recovery-rehearsal/v1');
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.phase,'restored');
 assert.deepEqual(r.phases,['snapshot','build-detached-graph',
  'sandbox-cutover','sandbox-restore']);
 assert.equal(r.snapshotVerified,true);
 assert.equal(r.sandboxRollbackVerified,true);
 assert.equal(r.liveConfigUntouched,true);
 assert.equal(r.cutoverReached,true);
 assert.equal(r.controllerReconstructionTested,false);
 assert.equal(r.remoteAccountRollbackVerified,false);
 assert.equal(r.restartAuthorized,false);
 assert.equal(r.transactionCommitted,false);
 assert.equal(r.readyForActivation,false);
 assert.equal(r.applied,false);
 assert.equal(r.acknowledged,false);
 assert.deepEqual(active,original);
 assert.deepEqual(source,originalProfile);
 assert.equal(JSON.stringify(r).includes('"config"'),false);
 assert.equal(JSON.stringify(r).includes('"profile"'),false);
 assert.equal(JSON.stringify(r).includes('"characters"'),false);
});
test('all synthetic failures keep LIVE active config unchanged; failed sandbox recovery is unproven',()=>{
 for(const faultAt of simulateDetachedRestartRecovery.allowedFaults){
  const active=structuredClone(profile.config),copy=structuredClone(active);
  const r=sim(faultAt,profile,active);
  assert.equal(r.ok,false,faultAt);
  assert.equal(r.fault,faultAt);
  assert.equal(r.liveConfigUntouched,true,faultAt);
  assert.equal(r.transactionCommitted,false,faultAt);
  assert.equal(r.restartAuthorized,false,faultAt);
  assert.equal(r.readyForActivation,false,faultAt);
  assert.equal(r.applied,false,faultAt);
  assert.deepEqual(active,copy);
  if(['after-build','after-sandbox-cutover',
   'before-sandbox-restore'].includes(faultAt)){
   assert.equal(r.sandboxRollbackVerified,true,faultAt);
   assert.equal(r.phase,'failed-and-restored',faultAt);
  }
  if(faultAt==='sandbox-restore-failure'){
   assert.equal(r.sandboxRollbackVerified,false);
   assert.equal(r.phase,'sandbox-recovery-unproven');
  }
 }
});
test('schema mismatch, disabled or unknown target, unsupported fault and invalid input fail closed',()=>{
 const changes=[
  x=>{x.schemaId='forged';},
  x=>{x.config.characters.find(c=>c.name===CHARACTER).enabled=false;},
  x=>{x.config.characters[0].role='invalid-role';}
 ];
 for(const change of changes){
  const value=structuredClone(profile);change(value);
  const before=structuredClone(value);
  const r=sim(null,value);
  assert.equal(r.ok,false,change.toString());
  assert.equal(r.transactionCommitted,false);
  assert.equal(r.applied,false);
  assert.deepEqual(value,before);
 }
 assert.equal(sim('unknown synthetic fault').ok,false);
 assert.equal(sim(null,{},null).ok,false);
 assert.equal(sim(null,profile,{nested:()=>42}).ok,false);
});
async function signedSetup(){
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},
  true,['sign','verify']);
 const identity=await signer({CONFIG_SIGNING_TARGET:'ALBot/TestAccount',
  CONFIG_SIGNING_JWK:JSON.stringify(
   await webcrypto.subtle.exportKey('jwk',pair.privateKey))},webcrypto.subtle);
 const release=await preparePrivateRelease({profile,identity,now:TIME});
 const ctx={time:TIME,character:CHARACTER,pin:{
  target:identity.target,publicJwk:identity.publicJwk},records:{}};
 const storage={getItem:k=>Object.hasOwn(ctx.records,k)?ctx.records[k]:null,
  setItem:(k,v)=>{ctx.records[k]=v;},removeItem:k=>{delete ctx.records[k];}};
 const stage=createVerifiedConfigStaging({readStorage:()=>storage,
  readTrust:()=>ctx.pin,readCharacter:()=>ctx.character,
  cryptoObject:webcrypto,now:()=>ctx.time});
 return {stage,identity,release,ctx};
}
test('freshly signed real P-256 stage runs all sandbox failures with no localStorage or cursor mutation',async()=>{
 const x=await signedSetup();
 assert.equal(await x.stage.stage(x.release),true);
 const receipts=structuredClone(x.ctx.records);
 const report=await x.stage.rehearse(profile.config);
 assert.equal(report.ok,true,JSON.stringify(report));
 assert.equal(report.sequence,x.release.sequence);
 assert.equal(report.sha256,x.release.sha256);
 assert.equal(report.faultCases.length,
  simulateDetachedRestartRecovery.allowedFaults.length);
 assert.equal(report.faultContainmentObserved,true);
 assert.equal(report.actualRollbackCertified,false);
 assert.equal(report.controllerReconstructionTested,false);
 assert.equal(report.remoteAccountRollbackVerified,false);
 assert.equal(report.restartAuthorized,false);
 assert.equal(report.transactionCommitted,false);
 assert.equal(report.applied,false);
 assert.equal(report.acknowledged,false);
 assert.deepEqual(x.ctx.records,receipts);
 assert.equal(Object.keys(x.ctx.records).length,1);
 assert.equal(JSON.stringify(report).includes(x.release.signature),false);
 assert.equal(JSON.stringify(report).includes('pinnedPublicJwk'),false);
 x.stage.dispose();
});
test('expired, changed key or new actor after signing blocks real P256 stage rehearsal',async()=>{
 for(const drift of [
  x=>{x.ctx.time=x.release.expiresAt;},
  x=>{x.ctx.character='My_Merchant';},
  x=>{x.ctx.pin={...x.ctx.pin,target:'ALBot/OtherAccount'};},
  x=>{x.ctx.records['albot:config:applied:v1:'+x.identity.target]=
   JSON.stringify({target:x.identity.target,sequence:x.release.sequence,
    sha256:x.release.sha256});}
 ]){
  const x=await signedSetup();
  assert.equal(await x.stage.stage(x.release),true);
  drift(x);
  const report=await x.stage.rehearse(profile.config);
  assert.equal(report.ok,false,drift.toString());
  assert.equal(report.applied,false);
  assert.equal(report.acknowledged,false);
  x.stage.dispose();
 }
});
test('public ALBot entry point requires manual restart review, local paused preflight and post-await gate',async()=>{
 const ui=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
 const a=ui.indexOf('rehearseConfigRestartRecovery:async()=>');
 assert.ok(a>0);
 const s=ui.slice(a,ui.indexOf('discardConfigRestartIntent:',a));
 assert.match(s,/configRestartIntent\.status\(\)/);
 assert.match(s,/configActivationPreflight\(\)/);
 assert.match(s,/configActivationReview\?\.status\(\)/);
 assert.match(s,/configStaging\.rehearse\(bot\.cfg\)/);
 assert.match(s,/bot\.running/);
 assert.match(s,/safeAfter\.blockers\?\.length!==0/);
 assert.match(s,/result\.sha256!==before\.intent\.sha256/);
 assert.doesNotMatch(s,/ALBotConfig\s*=|bot\.cfg\s*=|checkpoint\.write|applyProfile/);
});
