// Verified, character-scoped staging building block; exposed via popup preview.
// Not an activation or ACK path.
// Stores ONLY a bounded receipt of verification in localStorage. The private
// Full-v1 profile remains ephemeral in memory, and is never applied or ACKed.
import {configPreviewVerify} from './config-sync-preview.mjs';
import {FULL_DESCRIPTOR} from '../config/full.mjs';
import {validateProfile} from '../../editor/lib/contract.mjs';
import {evaluateDetachedConfigCandidate} from './config-sync-detached-candidate.mjs';
import {simulateDetachedRestartRecovery} from './config-sync-recovery-rehearsal.mjs';

export const createVerifiedConfigStaging=(()=>{
const TARGET=/^[A-Za-z0-9_.:/-]{1,128}$/;
const CHARACTER=/^[A-Za-z0-9_]{1,100}$/;
const HEX=/^[a-f0-9]{64}$/;
const PIN=/^[A-Za-z0-9_-]{43}$/;
const FORMAT='albot-config-stage/v1';
const MAX_RECEIPT_LENGTH=850;
const maxAge=7*86400000;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const keyFor=(target,character)=>'albot:config:stage:v1:'+
 encodeURIComponent(target)+':'+encodeURIComponent(character);
const cursorKey=target=>'albot:config:applied:v1:'+target;
function object(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function checkTrust(trust,character){
 const j=trust?.publicJwk;
 if(!TARGET.test(trust?.target??'')||!CHARACTER.test(character??'')||
  !object(j)||j.kty!=='EC'||j.crv!=='P-256'||!PIN.test(j.x??'')||
  !PIN.test(j.y??'')||own(j,'d'))throw Error('Independent account/character P-256 trust required');
 return {target:trust.target,character,pinnedPublicJwk:j};
}
function checkApplied(storage,target){
 const raw=storage.getItem(cursorKey(target));
 if(raw===null)return 0;
 if(typeof raw!=='string'||raw.length>512)throw Error('Applied rollback journal corrupted');
 let parsed;try{parsed=JSON.parse(raw);}catch{throw Error('Applied rollback journal corrupted');}
 if(!object(parsed)||parsed.target!==target||!Number.isSafeInteger(parsed.sequence)||
  parsed.sequence<1||!HEX.test(parsed.sha256??''))
  throw Error('Applied rollback journal corrupted');
 return parsed.sequence;
}
function receiptShape(x,trust){
 return object(x)&&Object.keys(x).sort().join(',')===
  'character,expiresAt,format,issuedAt,pinnedX,pinnedY,sequence,sha256,target,verifiedAt'&&
  x.format===FORMAT&&x.target===trust.target&&x.character===trust.character&&
  x.pinnedX===trust.pinnedPublicJwk.x&&x.pinnedY===trust.pinnedPublicJwk.y&&
  HEX.test(x.sha256??'')&&Number.isSafeInteger(x.sequence)&&x.sequence>=1&&
  Number.isSafeInteger(x.issuedAt)&&Number.isSafeInteger(x.expiresAt)&&
  Number.isSafeInteger(x.verifiedAt)&&x.issuedAt<=x.verifiedAt&&
  x.verifiedAt<x.expiresAt&&x.expiresAt-x.issuedAt<=maxAge;
}
function readReceipt(storage,trust){
 const raw=storage.getItem(keyFor(trust.target,trust.character));
 if(raw===null)return null;
 if(typeof raw!=='string'||raw.length>MAX_RECEIPT_LENGTH)
  throw Error('Staging receipt corrupted');
 let r;try{r=JSON.parse(raw);}catch{throw Error('Staging receipt corrupted');}
 if(!receiptShape(r,trust))throw Error('Staging receipt corrupted or trust pin changed');
 return r;
}
function createVerifiedConfigStaging({
 readStorage,readTrust,readCharacter,cryptoObject=globalThis.crypto,
 now=()=>Date.now()
}={}){
 if(typeof readStorage!=='function'||typeof readTrust!=='function'||
  typeof readCharacter!=='function'||typeof now!=='function'||
  typeof cryptoObject?.subtle?.verify!=='function')
  throw Error('Browser staging capabilities unavailable');
 let memory=null,inFlight=false,disposed=false,lastError=null,planning=false;
 const current=()=>{
  if(disposed)throw Error('Staging disposed');
  const trust=checkTrust(readTrust(),readCharacter());
  const storage=readStorage();
  if(!storage||typeof storage.getItem!=='function'||
   typeof storage.setItem!=='function'||typeof storage.removeItem!=='function')
   throw Error('Durable staging receipt storage unavailable');
  return {trust,storage,applied:checkApplied(storage,trust.target)};
 };
 function state(){
  let configured=false,reason=null,record=null,appliedHighwater=null,active=false;
  try{
   const {trust,storage,applied}=current();
   appliedHighwater=applied;
   record=readReceipt(storage,trust);
   configured=true;
   if(memory){
    active=!!record&&receiptShape(memory.receipt,trust)&&
     record.sequence===memory.receipt.sequence&&
     record.sha256===memory.receipt.sha256&&
     record.verifiedAt===memory.receipt.verifiedAt&&
     now()<record.expiresAt&&applied<record.sequence;
    if(!active){memory=null;lastError='Staged revision invalidated by expiry, trust, journal or storage change';}
   }
   if(record&&(now()>=record.expiresAt||applied>=record.sequence)){
    record=null;memory=null;
    lastError='Stored staging receipt expired or superseded';
   }
  }catch(e){reason=String(e?.message??e).slice(0,140);memory=null;}
  return {mode:'stage-only',configured,reason,inFlight,planning,appliedHighwater,
   staged:record?{
    sequence:record.sequence,sha256:record.sha256,character:record.character,
    target:record.target,verifiedAt:record.verifiedAt,expiresAt:record.expiresAt,
    memoryVerified:active,resumeRequiresReverification:!active
   }:null,
   lastError,readyForActivation:false,applied:false,acknowledged:false,disposed};
 }
 async function stage(release){
  if(inFlight||planning||disposed)return false;
  inFlight=true;const alreadyVerified=!!memory;memory=null;lastError=null;
  try{
   const {trust,storage,applied}=current();
   const existing=readReceipt(storage,trust);
   if(existing&&(existing.sequence>release?.sequence||
    existing.sequence===release?.sequence&&
     (existing.sha256!==release?.sha256||alreadyVerified)))
    throw Error('Staging replay or rollback rejected');
   const clock=now();
   if(!Number.isSafeInteger(clock)||clock<=0)
    throw Error('Invalid verification clock');
   // The same independent game-side verifier used for the popup checks the
   // full canonical profile and P-256 signature again before any write.
   const checked=await configPreviewVerify(release,trust.pinnedPublicJwk,
    trust.target,applied,clock,cryptoObject.subtle);
   const validation=validateProfile(FULL_DESCRIPTOR,release.profile.config);
   if(validation.length)throw Error('Full-v1 profile validation failed');
   if(!release.profile.config.characters.some(x=>x.name===trust.character&&x.enabled===true))
    throw Error('Signed profile does not enable the current character');
   // Recheck all mutable preconditions after async signature verification.
   const after=current();
   if(after.trust.target!==trust.target||
    after.trust.character!==trust.character||
    after.trust.pinnedPublicJwk.x!==trust.pinnedPublicJwk.x||
    after.trust.pinnedPublicJwk.y!==trust.pinnedPublicJwk.y||
    after.applied>=checked.sequence||now()>=release.expiresAt)
    throw Error('Trust, time, character or applied cursor changed during verification');
   const latest=readReceipt(after.storage,after.trust);
   if(latest&&(latest.sequence>checked.sequence||
    latest.sequence===checked.sequence&&
     (latest.sha256!==checked.sha256||alreadyVerified)))
    throw Error('Staging sequence changed concurrently');
   const receipt={format:FORMAT,target:trust.target,character:trust.character,
    sequence:checked.sequence,sha256:checked.sha256,
    issuedAt:release.issuedAt,expiresAt:release.expiresAt,
    verifiedAt:clock,pinnedX:trust.pinnedPublicJwk.x,pinnedY:trust.pinnedPublicJwk.y};
   const serialized=JSON.stringify(receipt);
   if(serialized.length>MAX_RECEIPT_LENGTH)
    throw Error('Staging receipt exceeds bounded size');
   after.storage.setItem(keyFor(trust.target,trust.character),serialized);
   if(after.storage.getItem(keyFor(trust.target,trust.character))!==serialized)
    throw Error('Staging receipt write could not be verified');
   // Do not persist private signed profile bytes in localStorage.
   memory={receipt,release:structuredClone(release)};
   if(!state().staged?.memoryVerified)throw Error('Staging invalidated immediately');
   return true;
  }catch(e){memory=null;lastError=String(e?.message??e).slice(0,160);return false;}
  finally{inFlight=false;}
 }
 // Dry-run cannot authorize or modify active controllers. Signed bytes are
 // reverified against the independently pinned key on every invocation.
 async function dryRun(activeConfig){
  if(disposed||inFlight||planning)return {
   ok:false,reason:'staging unavailable or concurrent operation',
   readyForActivation:false,applied:false,acknowledged:false};
  planning=true;
  try{
   const before=state();
   if(before.configured!==true||!before.staged?.memoryVerified||
    !memory?.release||!Number.isSafeInteger(before.appliedHighwater))
    throw Error('Staged release not freshly verified in memory');
   const {trust,applied}=current(),release=structuredClone(memory.release);
   const t=now();
   if(!Number.isSafeInteger(t)||t<=0||t>=release.expiresAt)
    throw Error('Signed release expired');
   const checked=await configPreviewVerify(release,trust.pinnedPublicJwk,
    trust.target,applied,t,cryptoObject.subtle);
   if(checked.sequence!==before.staged.sequence||
    checked.sha256!==before.staged.sha256)
    throw Error('Signed staging identity changed during dry run');
   const report=evaluateDetachedConfigCandidate(
    release.profile,activeConfig,trust.character);
   const after=state(),again=current();
   if(!after.staged?.memoryVerified||
    after.staged.sequence!==checked.sequence||
    after.staged.sha256!==checked.sha256||
    again.trust.target!==trust.target||
    again.trust.character!==trust.character||
    again.trust.pinnedPublicJwk.x!==trust.pinnedPublicJwk.x||
    again.trust.pinnedPublicJwk.y!==trust.pinnedPublicJwk.y||
    again.applied!==applied||now()>=release.expiresAt)
    throw Error('Trust, staging or applied cursor changed during dry run');
   return {ok:true,sequence:checked.sequence,sha256:checked.sha256,...report};
  }catch(error){
   lastError=String(error?.message??error).slice(0,160);
   return {ok:false,reason:lastError,mode:'detached-validation-only',
    readyForActivation:false,applied:false,acknowledged:false};
  }finally{planning=false;}
 }
 // Rehearses only throwaway Full-v1 graphs derived from in-memory signed
 // staging. No game action, browser config update, durable journal or ACK.
 // The signer is reverified by dryRun() before this obtains profile bytes.
 async function rehearse(activeConfig){
  const first=state();
  if(disposed||!first.staged?.memoryVerified||!memory?.release)
   return {ok:false,mode:'detached-sandbox-only',reason:'Verified stage unavailable',
    readyForActivation:false,transactionCommitted:false,applied:false,
    acknowledged:false};
  const dry=await dryRun(activeConfig);
  if(!dry.ok)return {ok:false,mode:'detached-sandbox-only',
   reason:'Signed Full-v1 dry-run failed',
   readyForActivation:false,transactionCommitted:false,applied:false,
   acknowledged:false};
  try{
   const currentStage=state(),ctx=current(),release=memory?.release;
   if(!release||!currentStage.staged?.memoryVerified||
    currentStage.staged.sequence!==dry.sequence||
    currentStage.staged.sha256!==dry.sha256||
    currentStage.staged.target!==ctx.trust.target||
    currentStage.staged.character!==ctx.trust.character||
    now()>=currentStage.staged.expiresAt||
    ctx.applied>=dry.sequence)
    throw Error('Signed staging invalidated before sandbox reconstruction');
   const report=simulateDetachedRestartRecovery({
    activeConfig,profile:release.profile,character:ctx.trust.character
   });
   const faults=simulateDetachedRestartRecovery.allowedFaults.map(faultAt=>{
    const result=simulateDetachedRestartRecovery({
     activeConfig,profile:release.profile,character:ctx.trust.character,
     faultAt
    });
    return {fault:faultAt,phase:result.phase,
     liveConfigUntouched:result.liveConfigUntouched,
     sandboxRollbackVerified:result.sandboxRollbackVerified,
     restartAuthorized:result.restartAuthorized};
   });
   const after=state(),again=current();
   if(!after.staged?.memoryVerified||
    after.staged.sequence!==dry.sequence||
    after.staged.sha256!==dry.sha256||
    again.trust.target!==ctx.trust.target||
    again.trust.character!==ctx.trust.character||
    again.trust.pinnedPublicJwk.x!==ctx.trust.pinnedPublicJwk.x||
    again.trust.pinnedPublicJwk.y!==ctx.trust.pinnedPublicJwk.y||
    again.applied!==ctx.applied||now()>=release.expiresAt)
    throw Error('Signed staging changed during fault rehearsal');
   const isolated=faults.every(x=>x.liveConfigUntouched===true&&
    x.restartAuthorized===false);
   return { ...report,ok:report.ok&&isolated,
    sequence:dry.sequence,sha256:dry.sha256,
    faultCases:faults,
    faultContainmentObserved:isolated,
    sandboxFaultsAllRestored:faults.every(x=>x.sandboxRollbackVerified===true),
    actualRollbackCertified:false,
    controllerReconstructionTested:false,remoteAccountRollbackVerified:false,
    restartAuthorized:false,transactionCommitted:false,
    readyForActivation:false,applied:false,acknowledged:false};
  }catch(e){
   return {ok:false,mode:'detached-sandbox-only',
    reason:String(e?.message??e).slice(0,130),
    actualRollbackCertified:false,restartAuthorized:false,
    transactionCommitted:false,readyForActivation:false,
    applied:false,acknowledged:false};
  }
 }
 function discard(){
  try{
   const {trust,storage}=current();
   storage.removeItem(keyFor(trust.target,trust.character));
   if(storage.getItem(keyFor(trust.target,trust.character))!==null)
    throw Error('Staging receipt removal failed');
   memory=null;lastError=null;return true;
  }catch(e){memory=null;lastError=String(e?.message??e).slice(0,160);return false;}
 }
 function dispose(){memory=null;disposed=true;}
 return {stage,dryRun,rehearse,status:state,discard,dispose};
}
return createVerifiedConfigStaging;
})();
