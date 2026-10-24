import test from 'node:test';
import assert from 'node:assert/strict';
import {captureLocalConfigSafePoint,assessConfigActivationPreflight}
 from '../../src/runtime/config-sync-safe-point.mjs';

const NOW=1792600000000;
const HEX='a'.repeat(64);
function bot(role='farmer'){
 const c={name:'My_Ranger1',rip:false,hp:1000,ctype:'ranger',
  moving:false,target:null};
 const p={headless:false,c,parent:{
  location:{origin:'https://adventure.land'},smart:{moving:false}
 },entities:{
  ally:{type:'character',name:'My_Priest'},
  harmless:{type:'monster',hp:0,dead:true,target:'My_Ranger1'}
 }};
 return {p,me:{name:c.name,role},running:false,target:null,
  teamNames:['My_Ranger1','My_Ranger2','My_Priest'],movement:{order:null},
  exec:{pending:new Map(),frame:null,waiting:new Map()},
  checkpoint:{durable:true},journal:null,inventoryBlocked:false,
  bank:{pending:false},logistics:{reserved:false},gold:{reserved:false},
  lifecycleChanging:false,teamTravel:{blocked:false},
  account:{rotationPending:()=>false}};
}
const stage=()=>({
 mode:'verified-stage-only',configured:true,inFlight:false,stageInFlight:false,
 verified:{target:'ALBot/TestAccount',sequence:2,sha256:HEX,
  expiresAt:NOW+86400000},
 staged:{target:'ALBot/TestAccount',character:'My_Ranger1',
  sequence:2,sha256:HEX,expiresAt:NOW+86400000,memoryVerified:true,
  resumeRequiresReverification:false},appliedHighwater:1
});
const assess=(b,config=stage())=>assessConfigActivationPreflight(
 captureLocalConfigSafePoint(b),config,{now:NOW});

test('paused, reconciled farmer and merchant can be locally quiescent but NEVER activation-authorized',()=>{
 for(const role of ['farmer','merchant']){
  const b=bot(role),before=JSON.stringify(b.p.c),r=assess(b);
  assert.equal(r.format,'albot-config-activation-preflight/v1');
  assert.equal(r.locallyQuiescent,true);
  assert.equal(r.signedStageVerified,true);
  assert.equal(r.stagedSequence,2);
  assert.deepEqual(r.blockers,[]);
  assert.equal(r.readyForActivation,false);
  assert.equal(r.applied,false);
  assert.equal(r.acknowledged,false);
  assert.equal(r.activationBlockers.length,3);
  assert.equal(JSON.stringify(b.p.c),before);
  assert.equal(JSON.stringify(r).includes('"config"'),false);
  assert.equal(JSON.stringify(r).includes('signature'),false);
 }
});
test('each actionable local risk blocks safe-point assessment even if signed stage is present',()=>{
 const failures=[
  ['runtime-not-paused',b=>{b.running=true;}],
  ['character-dead-or-changing',b=>{b.p.c.rip=true;}],
  ['active-combat-target',b=>{b.p.c.target='monster';}],
  ['nearby-team-threat',b=>{b.p.entities.aggro={
   type:'monster',hp:100,dead:false,target:'My_Priest'};}],
  ['character-still-moving',b=>{b.p.c.moving=true;}],
  ['smart-route-still-active',b=>{b.p.parent.smart.moving=true;}],
  ['execution-jobs-pending',b=>{b.exec.pending.set('upgrade',{resources:['items']});}],
  ['execution-jobs-pending',b=>{b.exec.frame=[];}],
  ['inventory-checkpoint-not-durable',b=>{b.checkpoint.durable=false;}],
  ['inventory-journal-open',b=>{b.journal={kind:'bank.store'};}],
  ['inventory-journal-open',b=>{b.inventoryBlocked=true;}],
  ['bank-operation-pending',b=>{b.bank.pending={kind:'withdraw'};}],
  ['logistics-reservation-pending',b=>{b.logistics.reserved=true;}],
  ['gold-reservation-pending',b=>{b.gold.reserved=true;}],
  ['lifecycle-transfer-pending',b=>{b.lifecycleChanging=true;}],
  ['lifecycle-transfer-pending',b=>{b.account.rotationPending=()=>true;}],
  ['live-character-unverified',b=>{b.p.c.name='OtherAccountCharacter';}],
  ['game-origin-unverified',b=>{b.p.parent.location.origin='https://evil.test';}],
  ['game-origin-unverified',b=>{b.p.headless=true;}]
 ];
 for(const [reason,change] of failures){
  const b=bot();change(b);
  const r=assess(b);
  assert.equal(r.locallyQuiescent,false,reason);
  assert.equal(r.readyForActivation,false,reason);
  assert.ok(r.blockers.includes(reason),reason+' '+JSON.stringify(r.blockers));
 }
});
test('unknown state is never silently interpreted as paused or risk-free',()=>{
 for(const mutate of [
  b=>{b.p.entities=null;},
  b=>{b.p.c.moving=undefined;},
  b=>{b.p.parent.smart=undefined;},
  b=>{b.checkpoint=null;},
  b=>{b.exec=null;},
  b=>{b.exec.frame=undefined;},
  b=>{b.exec.waiting=null;},
  b=>{b.logistics=null;},
  b=>{delete b.p.c.rip;},
  b=>{b.p.c.hp=NaN;},
  b=>{b.p.c=null;}
 ]){
  const b=bot();mutate(b);
  const r=assess(b);
  assert.equal(r.locallyQuiescent,false,JSON.stringify(r));
  assert.equal(r.readyForActivation,false);
  assert.ok(r.blockers.length>0);
 }
 const exploding=bot();
 Object.defineProperty(exploding.p,'entities',{get(){throw Error('game data not ready');}});
 const failed=assess(exploding);
 assert.equal(failed.locallyQuiescent,false);
 assert.equal(failed.readyForActivation,false);
});
test('signed staging must match live character, unexpired release, sequence and applied cursor',()=>{
 const b=bot();
 const variants=[
  s=>{s.mode='preview-only';},
  s=>{s.staged.memoryVerified=false;},
  s=>{s.staged.resumeRequiresReverification=true;},
  s=>{s.staged.character='My_Ranger2';},
  s=>{s.staged.target='ALBot/EvilAccount';},
  s=>{s.staged.sha256='b'.repeat(64);},
  s=>{s.staged.sequence=3;},
  s=>{s.staged.expiresAt=NOW;},
  s=>{s.appliedHighwater=2;},
  s=>{s.appliedHighwater=NaN;},
  s=>{s.verified=null;},
  s=>{s.inFlight=true;},
  s=>{s.stageInFlight=true;},
  s=>{s.configured=false;}
 ];
 for(const change of variants){
  const state=stage();change(state);
  const r=assess(b,state);
  assert.equal(r.locallyQuiescent,true);
  assert.equal(r.signedStageVerified,false);
  assert.equal(r.stagedSequence,null);
  assert.ok(r.blockers.includes('signed-character-staging-unverified'));
  assert.equal(r.readyForActivation,false);
 }
 const missing=assess(b,null);
 assert.ok(missing.blockers.includes('signed-character-staging-unverified'));
});
test('all state reports remain inspection-only under forged flags and invalid clock',()=>{
 const b=bot(),snapshot=captureLocalConfigSafePoint(b);
 const forged={...snapshot,flags:Object.fromEntries([
  'officialOrigin','liveCharacter','paused','alive','targetIdle','noThreats',
  'movementIdle','routeIdle','executorIdle','checkpointDurable',
  'inventoryIdle','bankIdle','logisticsIdle','goldIdle','lifecycleIdle'
 ].map(key=>[key,true]))};
 const report=assessConfigActivationPreflight(forged,stage(),{now:NOW});
 assert.equal(report.locallyQuiescent,true);
 assert.equal(report.readyForActivation,false);
 assert.deepEqual(report.activationBlockers,[
  'authoritative-account-rollback-anchor-missing',
  'atomic-full-profile-apply-and-rollback-unimplemented',
  'authenticated-per-character-ack-unimplemented']);
 const weird=assessConfigActivationPreflight(forged,stage(),{now:NaN});
 assert.equal(weird.locallyQuiescent,false);
 assert.equal(weird.signedStageVerified,false);
 assert.ok(weird.blockers.includes('verification-clock-unavailable'));
 assert.equal(weird.readyForActivation,false);
});
