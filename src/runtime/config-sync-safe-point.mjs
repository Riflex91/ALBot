// Read-only local safe-point evidence for a future signed Full-v1 apply.
// No mutation, reset, journal write, profile install, authorization, or ACK.
// A single browser/character snapshot can never prove global atomicity or
// give a trustworthy anti-rollback anchor.
const FORMAT='albot-config-activation-preflight/v1';
const HEX=/^[a-f0-9]{64}$/;
const TARGET=/^[A-Za-z0-9_.:/-]{1,128}$/;
const CHARACTER=/^[A-Za-z0-9_]{1,100}$/;
const OBSERVATIONS=[
 ['game-origin-unverified','officialOrigin'],
 ['live-character-unverified','liveCharacter'],
 ['runtime-not-paused','paused'],
 ['character-dead-or-changing','alive'],
 ['active-combat-target','targetIdle'],
 ['nearby-team-threat','noThreats'],
 ['character-still-moving','movementIdle'],
 ['smart-route-still-active','routeIdle'],
 ['execution-jobs-pending','executorIdle'],
 ['inventory-checkpoint-not-durable','checkpointDurable'],
 ['inventory-journal-open','inventoryIdle'],
 ['bank-operation-pending','bankIdle'],
 ['logistics-reservation-pending','logisticsIdle'],
 ['gold-reservation-pending','goldIdle'],
 ['lifecycle-transfer-pending','lifecycleIdle']
];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const basic=value=>value&&typeof value==='object'&&!Array.isArray(value);

export function captureLocalConfigSafePoint(bot,{disposed=false}={}){
 try{
  const p=bot?.p,c=p?.c,exec=bot?.exec;
  const entities=p?.entities;
  const team=bot?.teamNames;
  const officialOrigin=p?.parent?.location?.origin;
  // A missing monster dictionary is unknown, not evidence of no threats.
  const hasEntities=basic(entities)&&Array.isArray(team)&&
   team.includes(bot?.me?.name);
  let threatFree=false;
  if(hasEntities)threatFree=!Object.values(entities).some(e=>
   e&&typeof e==='object'&&e.type==='monster'&&
   e.hp>0&&!e.dead&&!e.rip&&
   typeof e.target==='string'&&team.includes(e.target));
  const ready=!!c&&!!bot?.me&&
   c.name===bot.me.name&&CHARACTER.test(c.name??'')&&
   ['farmer','merchant'].includes(bot.me.role);
  const flags={
   officialOrigin:!p?.headless&&
    ['https://adventure.land','https://www.adventure.land'].includes(officialOrigin),
   liveCharacter:ready&&!disposed,
   paused:bot?.running===false,
   alive:c?.rip===false&&Number.isFinite(c?.hp)&&c.hp>0,
   targetIdle:ready&&(c.target===null||c.target===undefined)&&
    bot.target===null,
   noThreats:threatFree,
   // Unknown movement flags fail closed; this is a local observation only.
   movementIdle:ready&&c.moving===false&&
    !!bot?.movement&&bot.movement.order==null,
   routeIdle:p?.parent?.smart?.moving===false,
   executorIdle:exec?.pending instanceof Map&&exec.pending.size===0&&
    exec.frame===null&&exec.waiting instanceof Map&&exec.waiting.size===0,
   checkpointDurable:bot?.checkpoint?.durable===true,
   inventoryIdle:bot?.inventoryBlocked===false&&bot.journal===null,
   bankIdle:bot?.bank?.pending===undefined||bot?.bank?.pending===false||
    bot?.bank?.pending===null,
   logisticsIdle:!!bot?.logistics&&bot.logistics.reserved===false,
   goldIdle:!bot?.gold||bot.gold.reserved===false,
   lifecycleIdle:bot?.lifecycleChanging!==true&&bot?.teamTravel?.blocked!==true&&
    bot?.account?.rotationPending?.()!==true
  };
  return {character:ready?c.name:null,role:ready?bot.me.role:null,
   flags:Object.fromEntries(Object.entries(flags).map(([key,value])=>[key,value===true]))};
 }catch{
  return {character:null,role:null,flags:{}};
 }
}

export function assessConfigActivationPreflight(evidence,staging,{now=Date.now()}={}){
 const reasons=[];
 const push=reason=>{if(!reasons.includes(reason))reasons.push(reason);};
 const snapshot=basic(evidence)&&basic(evidence.flags)?evidence:null;
 for(const [reason,name] of OBSERVATIONS)
  if(snapshot?.flags[name]!==true)push(reason);
 const seen=staging?.staged,verified=staging?.verified;
 const valid=Number.isSafeInteger(now)&&now>0;
 if(!valid)push('verification-clock-unavailable');
 const stageReady=staging?.mode==='verified-stage-only'&&
  staging?.configured===true&&staging.inFlight===false&&
  staging.stageInFlight===false&&basic(seen)&&basic(verified)&&
  seen.memoryVerified===true&&seen.resumeRequiresReverification===false&&
  CHARACTER.test(seen.character??'')&&seen.character===snapshot?.character&&
  TARGET.test(seen.target??'')&&seen.target===verified.target&&
  Number.isSafeInteger(seen.sequence)&&seen.sequence>0&&
  seen.sequence===verified.sequence&&
  HEX.test(seen.sha256??'')&&seen.sha256===verified.sha256&&
  Number.isSafeInteger(seen.expiresAt)&&seen.expiresAt===verified.expiresAt&&
  valid&&now<seen.expiresAt&&
  Number.isSafeInteger(staging.appliedHighwater)&&
  staging.appliedHighwater>=0&&staging.appliedHighwater<seen.sequence;
 if(!stageReady)push('signed-character-staging-unverified');
 const localQuiescent=OBSERVATIONS.every(([,key])=>snapshot?.flags[key]===true);
 // Never claim a production authorization merely because locally quiescent.
 // Signed account high-water, atomic Full-v1 state swap, rollback recovery
 // and authenticated game-character ACK are not available.
 return {
  format:FORMAT,mode:'read-only-local-preflight',scope:'single-character',
  checkedAt:valid?now:null,character:snapshot?.character??null,
  role:snapshot?.role??null,
  locallyQuiescent:localQuiescent&&valid,
  signedStageVerified:stageReady===true,
  stagedSequence:stageReady?seen.sequence:null,
  blockers:reasons,
  activationBlockers:[
   'authoritative-account-rollback-anchor-missing',
   'atomic-full-profile-apply-and-rollback-unimplemented',
   'authenticated-per-character-ack-unimplemented'
  ],
  readyForActivation:false,applied:false,acknowledged:false
 };
}
