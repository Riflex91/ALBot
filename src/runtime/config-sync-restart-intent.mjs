// Durable, account/character-scoped restart REVIEW fence. Never applies a
// configuration. localStorage can be modified: it is never commit authority,
// rollback evidence, authenticated character ACK or a source of private bytes.
export const createConfigRestartIntentGate=(()=>{
const FORMAT='albot-config-restart-intent/v1';
const TARGET=/^[A-Za-z0-9_.:/-]{1,128}$/;
const CHARACTER=/^[A-Za-z0-9_]{1,100}$/;
const HEX=/^[a-f0-9]{64}$/;
const PIN=/^[A-Za-z0-9_-]{43}$/;
const FIELDS='character,expiresAt,format,pinnedX,pinnedY,preparedAt,sequence,sha256,state,target';
const MAX=850,TTL=7*86400000;
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const keyFor=(target,character)=>'albot:config:restart-intent:v1:'+
 encodeURIComponent(target)+':'+encodeURIComponent(character);
function validateTrust(value,character){
 const p=value?.publicJwk;
 if(!TARGET.test(value?.target??'')||!CHARACTER.test(character??'')||
  !object(p)||p.kty!=='EC'||p.crv!=='P-256'||
  !PIN.test(p.x??'')||!PIN.test(p.y??'')||
  Object.prototype.hasOwnProperty.call(p,'d'))
  throw Error('Independent restart trust unavailable');
 return {target:value.target,character,pinnedX:p.x,pinnedY:p.y};
}
function validRecord(x,t){
 return object(x)&&Object.keys(x).sort().join(',')===FIELDS&&
  x.format===FORMAT&&x.state==='review-pending-no-apply'&&
  x.target===t.target&&x.character===t.character&&
  x.pinnedX===t.pinnedX&&x.pinnedY===t.pinnedY&&
  HEX.test(x.sha256??'')&&Number.isSafeInteger(x.sequence)&&x.sequence>0&&
  Number.isSafeInteger(x.preparedAt)&&x.preparedAt>0&&
  Number.isSafeInteger(x.expiresAt)&&x.expiresAt>x.preparedAt&&
  x.expiresAt-x.preparedAt<=TTL;
}
function readRecord(storage,t){
 const s=storage.getItem(keyFor(t.target,t.character));
 if(s===null)return null;
 if(typeof s!=='string'||s.length>MAX)
  throw Error('Restart intent corrupted');
 let x;try{x=JSON.parse(s);}catch{throw Error('Restart intent corrupted');}
 if(!validRecord(x,t))
  throw Error('Restart intent corrupted or signing key changed');
 return x;
}
function matches(stage,preflight,review,dryRun,t,at){
 const staged=stage?.staged,verified=stage?.verified,entry=review?.review;
 return stage?.mode==='verified-stage-only'&&stage?.configured===true&&
  stage.inFlight===false&&stage.stageInFlight===false&&stage.planning!==true&&
  staged?.memoryVerified===true&&staged.resumeRequiresReverification===false&&
  staged.target===t.target&&staged.character===t.character&&
  HEX.test(staged.sha256??'')&&Number.isSafeInteger(staged.sequence)&&
  staged.sequence>0&&staged.sequence===verified?.sequence&&
  staged.sha256===verified?.sha256&&verified?.target===t.target&&
  Number.isSafeInteger(staged.expiresAt)&&staged.expiresAt>at&&
  staged.expiresAt===verified?.expiresAt&&
  Number.isSafeInteger(stage.appliedHighwater)&&stage.appliedHighwater>=0&&
  stage.appliedHighwater<staged.sequence&&
  preflight?.mode==='read-only-local-preflight'&&
  preflight.character===t.character&&preflight.locallyQuiescent===true&&
  preflight.signedStageVerified===true&&
  Array.isArray(preflight.blockers)&&preflight.blockers.length===0&&
  preflight.stagedSequence===staged.sequence&&
  preflight.readyForActivation===false&&preflight.applied===false&&
  preflight.acknowledged===false&&
  review?.mode==='review-only'&&review.configured===true&&
  entry?.persisted===true&&entry.currentEvidenceValid===true&&
  entry.resumeRequiresReverification===false&&entry.target===t.target&&
  entry.character===t.character&&entry.sequence===staged.sequence&&
  entry.sha256===staged.sha256&&entry.expiresAt===staged.expiresAt&&
  dryRun?.ok===true&&dryRun.mode==='detached-validation-only'&&
  dryRun.character===t.character&&dryRun.sequence===staged.sequence&&
  dryRun.sha256===staged.sha256&&dryRun.restartRequired===true&&
  dryRun.inPlaceSwapSupported===false&&
  dryRun.transactionCommitted===false&&
  dryRun.readyForActivation===false&&dryRun.applied===false&&
  dryRun.acknowledged===false;
}
function createConfigRestartIntentGate({
 readStorage,readTrust,readCharacter,readStage,readPreflight,readReview,
 now=()=>Date.now()
}={}){
 if([readStorage,readTrust,readCharacter,readStage,readPreflight,readReview,now]
  .some(x=>typeof x!=='function'))throw Error('Restart intent capabilities unavailable');
 let disposed=false,busy=false,memory=null,lastError=null;
 function context(){
  if(disposed)throw Error('Restart intent disposed');
  const t=now();
  if(!Number.isSafeInteger(t)||t<=0)throw Error('Restart clock unavailable');
  const trust=validateTrust(readTrust(),readCharacter());
  const storage=readStorage();
  if(!storage||typeof storage.getItem!=='function'||
   typeof storage.setItem!=='function'||typeof storage.removeItem!=='function')
   throw Error('Restart intent storage unavailable');
  return {t,trust,storage};
 }
 function status(){
  let configured=false,reason=null,record=null,evidenceValid=false;
  try{
   const {t,trust,storage}=context();
   record=readRecord(storage,trust);configured=true;
   if(record){
    const stage=readStage(),preflight=readPreflight(),review=readReview();
    const dry={
     ok:true,mode:'detached-validation-only',character:trust.character,
     sequence:record.sequence,sha256:record.sha256,restartRequired:true,
     inPlaceSwapSupported:false,transactionCommitted:false,
     readyForActivation:false,applied:false,acknowledged:false
    };
    evidenceValid=record.expiresAt>t&&
     memory?.preparedAt===record.preparedAt&&
     memory?.sequence===record.sequence&&memory?.sha256===record.sha256&&
     matches(stage,preflight,review,dry,trust,t);
    if(!evidenceValid)memory=null;
   }else memory=null;
  }catch(e){memory=null;reason=String(e?.message??e).slice(0,140);}
  return {format:FORMAT,mode:'restart-review-only',
   configured,reason,busy,
   intent:record?{
    target:record.target,character:record.character,
    sequence:record.sequence,sha256:record.sha256,
    preparedAt:record.preparedAt,expiresAt:record.expiresAt,
    persisted:true,currentEvidenceValid:evidenceValid,
    resumeRequiresReverification:true
   }:null,
   lastError,hasAutomaticRestartAuthority:false,
   readyForActivation:false,transactionCommitted:false,
   applied:false,acknowledged:false,disposed};
 }
 function prepare(dryRun){
  if(disposed||busy)return false;
  busy=true;lastError=null;
  try{
   const {t,trust,storage}=context();
   const first=readRecord(storage,trust);
   const stage=readStage(),preflight=readPreflight(),review=readReview();
   if(!matches(stage,preflight,review,dryRun,trust,t))
    throw Error('Signed, paused review and detached candidate required');
   if(first&&(first.sequence>stage.staged.sequence||
    first.sequence===stage.staged.sequence&&
     (first.sha256!==stage.staged.sha256||memory!==null)))
    throw Error('Restart intent rollback, equivocation or replay');
   const record={format:FORMAT,state:'review-pending-no-apply',
    target:trust.target,character:trust.character,
    sequence:stage.staged.sequence,sha256:stage.staged.sha256,
    expiresAt:stage.staged.expiresAt,preparedAt:t,
    pinnedX:trust.pinnedX,pinnedY:trust.pinnedY};
   const serialized=JSON.stringify(record);
   if(serialized.length>MAX)throw Error('Restart receipt size exceeded');
   const latest=context();
   if(latest.trust.target!==trust.target||
    latest.trust.character!==trust.character||
    latest.trust.pinnedX!==trust.pinnedX||
    latest.trust.pinnedY!==trust.pinnedY||
    !matches(readStage(),readPreflight(),readReview(),
     dryRun,trust,latest.t))
    throw Error('Restart prerequisites changed before persistence');
   // This is the only write in this API: a bounded, non-authoritative receipt.
   // Never write ALBotConfig, bot.cfg, an applied cursor, or a character ACK.
   storage.setItem(keyFor(trust.target,trust.character),serialized);
   if(storage.getItem(keyFor(trust.target,trust.character))!==serialized)
    throw Error('Restart intent persistence unverified');
   memory={sequence:record.sequence,sha256:record.sha256,
    preparedAt:record.preparedAt};
   if(!status().intent?.currentEvidenceValid)
    throw Error('Restart intent invalidated while preparing');
   return true;
  }catch(e){
   memory=null;lastError=String(e?.message??e).slice(0,160);
   return false;
  }finally{busy=false;}
 }
 function discard(){
  if(disposed||busy)return false;
  try{
   const {trust,storage}=context();
   readRecord(storage,trust);
   storage.removeItem(keyFor(trust.target,trust.character));
   if(storage.getItem(keyFor(trust.target,trust.character))!==null)
    throw Error('Restart intent removal unverified');
   memory=null;lastError=null;return true;
  }catch(e){memory=null;lastError=String(e?.message??e).slice(0,160);return false;}
 }
 function dispose(){disposed=true;memory=null;}
 return {prepare,status,discard,dispose};
}
return createConfigRestartIntentGate;
})();
