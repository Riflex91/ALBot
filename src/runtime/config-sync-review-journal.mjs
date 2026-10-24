// Durable local *review intent* for a future signed Full-v1 activation.
// This is not a transaction commit, trusted rollback anchor or game ACK.
// localStorage is attacker-editable: never treat this metadata as authority.
export const createConfigActivationReviewJournal=(()=>{
const FORMAT='albot-config-activation-review/v1';
const TARGET=/^[A-Za-z0-9_.:/-]{1,128}$/;
const CHARACTER=/^[A-Za-z0-9_]{1,100}$/;
const HEX=/^[a-f0-9]{64}$/;
const PIN=/^[A-Za-z0-9_-]{43}$/;
const LIMIT=850;
const FIELDS='character,expiresAt,format,pinnedX,pinnedY,sequence,sha256,state,target,writtenAt';
const keyFor=(target,character)=>'albot:config:review:v1:'+
 encodeURIComponent(target)+':'+encodeURIComponent(character);
const validObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validateTrust(trust,character){
 const jwk=trust?.publicJwk;
 if(!TARGET.test(trust?.target??'')||!CHARACTER.test(character??'')||
  !validObject(jwk)||jwk.kty!=='EC'||jwk.crv!=='P-256'||
  !PIN.test(jwk.x??'')||!PIN.test(jwk.y??'')||
  Object.prototype.hasOwnProperty.call(jwk,'d'))
  throw Error('Independent account/character trust unavailable');
 return {target:trust.target,character,pinnedX:jwk.x,pinnedY:jwk.y};
}
function validateRecord(value,trust){
 return validObject(value)&&Object.keys(value).sort().join(',')===FIELDS&&
  value.format===FORMAT&&value.state==='review-only'&&
  value.target===trust.target&&value.character===trust.character&&
  value.pinnedX===trust.pinnedX&&value.pinnedY===trust.pinnedY&&
  HEX.test(value.sha256??'')&&
  Number.isSafeInteger(value.sequence)&&value.sequence>0&&
  Number.isSafeInteger(value.writtenAt)&&value.writtenAt>0&&
  Number.isSafeInteger(value.expiresAt)&&
  value.expiresAt>value.writtenAt&&value.expiresAt-value.writtenAt<=7*86400000;
}
function readRecord(storage,trust){
 const raw=storage.getItem(keyFor(trust.target,trust.character));
 if(raw===null)return null;
 if(typeof raw!=='string'||raw.length>LIMIT)throw Error('Review intent corrupted');
 let value;try{value=JSON.parse(raw);}catch{throw Error('Review intent corrupted');}
 if(!validateRecord(value,trust))
  throw Error('Review intent corrupted or trust changed');
 return value;
}
function preflightMatches(report,stage,trust,t){
 const seen=stage?.staged,verified=stage?.verified;
 return report?.format==='albot-config-activation-preflight/v1'&&
  report?.mode==='read-only-local-preflight'&&
  report?.character===trust.character&&
  report?.locallyQuiescent===true&&report?.signedStageVerified===true&&
  Array.isArray(report.blockers)&&report.blockers.length===0&&
  report?.readyForActivation===false&&report.applied===false&&
  report.acknowledged===false&&
  stage?.mode==='verified-stage-only'&&stage?.configured===true&&
  stage.inFlight===false&&stage.stageInFlight===false&&
  seen?.memoryVerified===true&&
  seen.resumeRequiresReverification===false&&
  seen.target===trust.target&&seen.character===trust.character&&
  verified?.target===trust.target&&
  Number.isSafeInteger(seen.sequence)&&seen.sequence>0&&
  seen.sequence===verified?.sequence&&
  seen.sequence===report.stagedSequence&&
  HEX.test(seen.sha256??'')&&seen.sha256===verified?.sha256&&
  Number.isSafeInteger(seen.expiresAt)&&seen.expiresAt>t&&
  seen.expiresAt===verified?.expiresAt&&
  Number.isSafeInteger(stage.appliedHighwater)&&
  stage.appliedHighwater>=0&&stage.appliedHighwater<seen.sequence;
}
function createConfigActivationReviewJournal({
 readStorage,readTrust,readCharacter,readStage,readPreflight,
 now=()=>Date.now()
}={}){
 if([readStorage,readTrust,readCharacter,readStage,readPreflight,now]
  .some(fn=>typeof fn!=='function'))throw Error('Review journal capabilities unavailable');
 let disposed=false,inMemory=null,lastError=null,inProgress=false;
 function context(){
  if(disposed)throw Error('Review journal disposed');
  const t=now();
  if(!Number.isSafeInteger(t)||t<=0)throw Error('Review clock unavailable');
  const trust=validateTrust(readTrust(),readCharacter());
  const storage=readStorage();
  if(!storage||typeof storage.getItem!=='function'||
   typeof storage.setItem!=='function'||typeof storage.removeItem!=='function')
   throw Error('Durable review metadata storage unavailable');
  return {t,trust,storage};
 }
 function inspect(){
  let record=null,configured=false,reason=null,localEvidence=false;
  let currentProof=false;
  try{
   const {t,trust,storage}=context();
   record=readRecord(storage,trust);
   configured=true;
   if(record){
    const stage=readStage(),preflight=readPreflight();
    localEvidence=preflightMatches(preflight,stage,trust,t)&&
     record.target===stage.staged.target&&
     record.character===stage.staged.character&&
     record.sequence===stage.staged.sequence&&
     record.sha256===stage.staged.sha256&&
     record.expiresAt===stage.staged.expiresAt&&t<record.expiresAt;
    currentProof=localEvidence&&inMemory!==null&&
     inMemory.sequence===record.sequence&&inMemory.sha256===record.sha256&&
     inMemory.writtenAt===record.writtenAt;
    if(!currentProof)inMemory=null;
   }else inMemory=null;
  }catch(e){
   inMemory=null;
   reason=String(e?.message??e).slice(0,140);
  }
  return {format:FORMAT,mode:'review-only',configured,reason,inProgress,
   review:record?{target:record.target,character:record.character,
    sequence:record.sequence,sha256:record.sha256,writtenAt:record.writtenAt,
    expiresAt:record.expiresAt,persisted:true,
    currentEvidenceValid:localEvidence&&currentProof,
    resumeRequiresReverification:!currentProof}:null,
   lastError,readyForActivation:false,applied:false,acknowledged:false,
   disposed};
 }
 function prepare(){
  if(disposed||inProgress)return false;
  inProgress=true;lastError=null;
  try{
   const {t,trust,storage}=context();
   const stage=readStage(),preflight=readPreflight();
   if(!preflightMatches(preflight,stage,trust,t))
    throw Error('Paused safe-point and independently verified stage required');
   const previous=readRecord(storage,trust);
   if(previous&&(previous.sequence>stage.staged.sequence||
    previous.sequence===stage.staged.sequence&&
     (previous.sha256!==stage.staged.sha256||inMemory!==null)))
    throw Error('Review replay or conflicting revision rejected');
   const record={format:FORMAT,state:'review-only',
    target:trust.target,character:trust.character,
    sequence:stage.staged.sequence,sha256:stage.staged.sha256,
    expiresAt:stage.staged.expiresAt,writtenAt:t,
    pinnedX:trust.pinnedX,pinnedY:trust.pinnedY};
   const data=JSON.stringify(record);
   if(data.length>LIMIT)throw Error('Review receipt exceeds size limit');
   // Recheck after creating the record and immediately before the only write.
   const before=context();
   if(before.trust.target!==trust.target||
    before.trust.character!==trust.character||
    before.trust.pinnedX!==trust.pinnedX||
    before.trust.pinnedY!==trust.pinnedY||
    !preflightMatches(readPreflight(),readStage(),trust,before.t))
    throw Error('Trust or local safe-point changed before intent write');
   // One bounded metadata record; NEVER writes the existing applied cursor.
   storage.setItem(keyFor(trust.target,trust.character),data);
   if(storage.getItem(keyFor(trust.target,trust.character))!==data)
    throw Error('Review intent persistence could not be verified');
   inMemory={sequence:record.sequence,sha256:record.sha256,
    writtenAt:record.writtenAt};
   if(!inspect().review?.currentEvidenceValid)
    throw Error('Review intent invalidated during persistence');
   return true;
  }catch(e){
   inMemory=null;lastError=String(e?.message??e).slice(0,160);return false;
  }finally{inProgress=false;}
 }
 function discard(){
  if(disposed||inProgress)return false;
  try{
   const {trust,storage}=context();
   // Never delete other characters' staging or applied checkpoints.
   readRecord(storage,trust);
   storage.removeItem(keyFor(trust.target,trust.character));
   if(storage.getItem(keyFor(trust.target,trust.character))!==null)
    throw Error('Review intent removal unverified');
   inMemory=null;lastError=null;
   return true;
  }catch(e){
   inMemory=null;lastError=String(e?.message??e).slice(0,160);
   return false;
  }
 }
 function dispose(){disposed=true;inMemory=null;}
 return {prepare,status:inspect,discard,dispose};
}
return createConfigActivationReviewJournal;
})();
