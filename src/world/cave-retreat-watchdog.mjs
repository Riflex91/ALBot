// W12/N12: fail-closed, read-only watchdog for a STAGED Cave retreat.
// This module never makes or grants a movement call. Its peer abort receipt
// and pure arrival verifier are prerequisites for a future native executor.
const caveRetreatWatchFinite=n=>Number.isFinite(n);
const caveRetreatWatchTime=n=>Number.isSafeInteger(n)&&n>0;
const caveRetreatWatchDist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const caveRetreatWatchDeny=(reason,more={})=>({
 version:1,mode:'cave-retreat-watchdog',ready:false,phase:'blocked',
 canMove:false,canAttack:false,canHeal:false,canPull:false,
 executable:false,arrived:false,reason,...more
});
const caveRetreatWatchNames=xs=>Array.isArray(xs)&&xs.length===3&&
 xs.every(n=>typeof n==='string'&&n.length>0&&n.length<=100)&&
 new Set(xs).size===3;
const caveRetreatWatchCopy=(x)=>({
 name:x.name,x:x.x,y:x.y,toX:x.toX,toY:x.toY
});
export function caveRetreatArrivalEvidence({
 proof,run,floor,map,participants,waypoints,observations,
 now=Date.now(),startedAt=null,deadlineMs=6000
}={}){
 const no=(reason,details={})=>({
  version:1,mode:'cave-retreat-arrival-evidence',ready:false,
  complete:false,canMove:false,executable:false,
  phase:'unverified',reason,...details
 });
 // No source in production currently issues the required native
 // per-character retreat dispatch acknowledgments. Synthetic tests
 // can inspect the future protocol contract without enabling it.
 if(typeof proof!=='string'||!proof||proof.length>1300||
    typeof run!=='string'||!/^[a-f0-9]{24}$/.test(run)||
    !Number.isSafeInteger(floor)||floor<0||floor>7||
    map!==`zone_${run}_${floor}`||
    !caveRetreatWatchNames(participants)||
    !Array.isArray(waypoints)||waypoints.length!==3||
    !Array.isArray(observations)||observations.length!==3||
    !caveRetreatWatchTime(now)||!caveRetreatWatchTime(startedAt)||
    startedAt>now||!Number.isSafeInteger(deadlineMs)||
    deadlineMs<1000||deadlineMs>10000)
  return no('immutable-three-party-execution-receipts-required');
 const original=new Map(),seen=new Set();
 for(const p of waypoints){
  if(!p||!participants.includes(p.name)||original.has(p.name)||
     ![p.x,p.y,p.toX,p.toY].every(caveRetreatWatchFinite)||
     !(caveRetreatWatchDist({x:p.x,y:p.y},{x:p.toX,y:p.toY})>=23.99&&
       caveRetreatWatchDist({x:p.x,y:p.y},{x:p.toX,y:p.toY})<=24.01))
   return no('original-waypoints-contradictory');
  original.set(p.name,p);
 }
 const arrived=[],waiting=[];
 for(const m of observations){
  if(!m||!participants.includes(m.name)||seen.has(m.name)||
     m.map!==map||m.in!==undefined&&m.in!==map||
     m.run!==run||m.floor!==floor||
     m.rip===true||m.running!==true||
     ![m.x,m.y,m.hp].every(caveRetreatWatchFinite)||m.hp<=0||
     !caveRetreatWatchTime(m.received)||m.received>now||
     now-m.received>3000)
   return no('live-arrival-observation-unconfirmed');
  seen.add(m.name);
  const w=original.get(m.name),ack=m.retreatDispatch;
  if(!w||!ack||ack.v!==1||ack.owner!=='cave-retreat'||
     ack.proof!==proof||ack.run!==run||
     ack.floor!==floor||ack.map!==map||
     !caveRetreatWatchTime(ack.at)||ack.at<startedAt||
     ack.at>now||ack.at>startedAt+deadlineMs||
     ![ack.x,ack.y,ack.toX,ack.toY].every(caveRetreatWatchFinite)||
     caveRetreatWatchDist({x:ack.x,y:ack.y},w)>.001||
     caveRetreatWatchDist({x:ack.toX,y:ack.toY},
      {x:w.toX,y:w.toY})>.001)
   return no('native-dispatch-receipt-missing-or-divergent');
  const destination={x:w.toX,y:w.toY};
  const dist=caveRetreatWatchDist(m,destination);
  if(!caveRetreatWatchFinite(dist)||dist>26)
   return no('observed-character-outside-bounded-retreat', {member:m.name});
  if(dist<=3)arrived.push(m.name);else waiting.push(m.name);
 }
 if(seen.size!==3)return no('original-roster-not-complete');
 if(now-startedAt>deadlineMs)
  return no('arrival-deadline-expired',{arrived:arrived.sort(),waiting:waiting.sort()});
 return {...no(waiting.length?'awaiting-original-trio-arrival':
    'three-independent-native-arrivals-observed',{
    arrived:arrived.sort(),waiting:waiting.sort(),deadlineAt:startedAt+deadlineMs}),
   ready:true,complete:waiting.length===0,
   phase:waiting.length?'observing':'arrived'};
}
export function createCaveRetreatWatchdog(bot,{now=()=>Date.now()}={}){
 let staged=null,aborted=null,checks=0,stageCount=0;
 const local=()=>bot.caveRetreatPrepare?.status?.();
 function peerAbort(stagedProof,at){
  for(const name of staged?.participants??[]){
   if(name===bot.p?.c?.name)continue;
   const peer=bot.transport?.fresh?.(name),message=peer?.retreatAbort;
   if(!peer||peer.name!==name||peer.running!==true||
      peer.rip===true||peer.realm!==bot.p.realm?.()||
      peer.map!==staged.map||
      !caveRetreatWatchTime(peer.received)||
      peer.received>at||at-peer.received>3000)
    return 'staged-peer-heartbeat-lost';
   if(message?.v===1&&message.actor===name&&
      message.run===staged.run&&message.floor===staged.floor&&
      message.proof===staged.proof&&
      caveRetreatWatchTime(message.at)&&message.at<=at&&
      at-message.at<=10000)
    return 'peer-aborted-retreat';
  }
  return null;
 }
 function examine(at){
  if(aborted&&at>=aborted.at&&at-aborted.at<=10000)
   return caveRetreatWatchDeny('latched-retreat-abort',{
    phase:'aborted',abortReason:aborted.reason,proof:aborted.proof,
    checks,stageCount});
  const p=local();
  if(!staged){
   return caveRetreatWatchDeny(
    p?.ready===true?'prepared-awaiting-watchdog-arm':
     'current-two-round-preparation-required',{checks,stageCount});
  }
  const scope={run:staged.run,floor:staged.floor,proof:staged.proof,
   checks,stageCount};
  if(!caveRetreatWatchTime(at)||at<staged.at||
     at-staged.at>2500)
   return caveRetreatWatchDeny('stage-deadline-expired',scope);
  if(p?.ready!==true||p.prepared!==true||
     p.proofKey!==staged.proof||p.run!==staged.run||
     p.floor!==staged.floor||p.phase!=='prepared'||
     !caveRetreatWatchNames(p.participants)||
     p.participants.join('|')!==staged.participants.join('|'))
   return caveRetreatWatchDeny('unanimous-preparation-no-longer-valid',scope);
  const movement=bot.movement?.order;
  if(movement||bot.movement?.nativeBusy?.()||bot.p.c?.moving)
   return caveRetreatWatchDeny('unsanctioned-native-movement-before-start',scope);
  const risk=bot.caveCriticalResponse?.status?.();
  if(risk?.ready!==true||risk.critical!==true||
     risk.run!==staged.run||risk.floor!==staged.floor)
   return caveRetreatWatchDeny('critical-encounter-state-changed',scope);
  const peerReason=peerAbort(staged.proof,at);
  if(peerReason)return caveRetreatWatchDeny(peerReason,scope);
  // Status reads are pure; this is a still-armed observation, not an
  // execution lease. There is no native arrival to claim yet.
  return {...caveRetreatWatchDeny('three-client-retreat-staged-observation-only',scope),
   ready:true,phase:'staged',participants:[...staged.participants],
   executable:false,canMove:false};
 }
 function heartbeat(){
  const at=now();checks++;
  const report=examine(at);
  if(staged&&!report.ready&&!aborted){
   aborted={v:1,actor:bot.p.c.name,run:staged.run,
    floor:staged.floor,proof:staged.proof,at,
    reason:report.reason};
   staged=null;
  }else if(!staged&&!aborted){
   const prep=local();
   if(prep?.ready===true&&prep.prepared===true&&
      typeof prep.proofKey==='string'&&prep.proofKey.length<=1300&&
      caveRetreatWatchNames(prep.participants)&&
      prep.run&&Number.isSafeInteger(prep.floor)){
    const participants=[...prep.participants].sort();
    const peer=participants.every(n=>n===bot.p.c.name||
     !!bot.transport?.fresh?.(n));
    if(peer){
     staged={at,run:prep.run,floor:prep.floor,map:`zone_${prep.run}_${prep.floor}`,
      proof:prep.proofKey,participants};
     stageCount++;
    }
   }
  }
  if(aborted){
   if(at>=aborted.at&&at-aborted.at<=10000)
    return {...aborted};
   aborted=null;
  }
  // No heartbeat of this class can ever be interpreted as an authorizing
  // move, arrival or distributed transaction.
  return null;
 }
 function status(){
  return examine(now());
 }
 return {heartbeat,status};
}
