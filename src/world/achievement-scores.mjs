import {carriedAchievementCarrier} from '../items/achievement-utility.mjs';

// Official server tracker response: data.max.monsters[type] =
// [account-highest score, other counters]. Account achievement stat bonuses
// use that MAXIMUM, never a sum of character scores or an inferred kill rate.
export function verifiedTrackerScores(data,G,{limit=512}={}){
 const max=data?.max?.monsters,defs=G?.monsters;
 if(!max||typeof max!=='object'||Array.isArray(max)||
    !defs||typeof defs!=='object'||Array.isArray(defs))return null;
 const rows=[];
 for(const id of Object.keys(defs).sort().slice(0,limit)){
  if(!Object.prototype.hasOwnProperty.call(max,id))continue;
  const entry=max[id],score=Array.isArray(entry)?entry[0]:null;
  if(!Number.isFinite(score)||score<0||score>Number.MAX_SAFE_INTEGER)continue;
  // Achievement definitions, not a guessed universal threshold, determine
  // the next milestone for this exact monster in the current G.
  const levels=Array.isArray(defs[id]?.achievements)?
    defs[id].achievements.filter(row=>Array.isArray(row)&&
      Number.isSafeInteger(row[0])&&row[0]>score&&row[0]>0)
      .sort((a,b)=>a[0]-b[0]):[];
  const next=levels[0],threshold=next?.[0]??null;
  rows.push({monster:id,score,nextThreshold:threshold,
   gap:threshold===null?null:Math.max(0,threshold-score),
   nextReward:next?.[1]==='stat'&&typeof next?.[2]==='string'&&
     Number.isFinite(next?.[3])?
     {stat:next[2],value:next[3]}:null});
 }
 return rows;
}
// Verified proximity to the NEXT stat milestone is worth at most 4% of a
// normal safe FarmPlan's utility. This never creates a new monster candidate,
// guesses kill-credit rates or overrides a material-production objective.
export function achievementMilestoneBias(row){
 if(!row||!Number.isFinite(row.score)||row.score<0||
    !Number.isSafeInteger(row.nextThreshold)||row.nextThreshold<=row.score||
    !Number.isFinite(row.gap)||row.gap!==row.nextThreshold-row.score||
    !row.nextReward||typeof row.nextReward.stat!=='string'||
    !Number.isFinite(row.nextReward.value)||row.nextReward.value<=0)return 0;
 return row.gap<25?Math.min(.04,.04*(25-row.gap)/25):0;
}
export function createAchievementScores(bot,clock=()=>Date.now()){
 const {p}=bot,interval=120000,ttl=600000,timeout=15000;
 let socket=null,lastRequestAt=0,pendingAt=0,receivedAt=0,entries=null,
  reason='not-observed',closed=false;
 function carrier(){
  const held=carriedAchievementCarrier(p.c?.items);
  if(!held||held==='unknown'){
   // A carrier gap invalidates account-score proof. An old response or
   // re-equipped carrier must not resurrect stale achievement priorities.
   entries=null;receivedAt=0;pendingAt=0;
  }
  return held;
 }
 function receive(data){
  if(!pendingAt||closed||!carrier()||carrier()==='unknown')return false;
  pendingAt=0;
  const rows=verifiedTrackerScores(data,p.G);
  if(!rows){
   // A malformed new response invalidates the old snapshot. Never reuse
   // previously confirmed scores after a failed refresh.
   entries=null;receivedAt=0;reason='invalid-server-reply';return false;
  }
  entries=rows;receivedAt=clock();reason='verified-account-max';return true;
 }
 function detach(){
  if(socket){
   try{if(typeof socket.off==='function')socket.off('tracker',receive);
    else socket.removeListener?.('tracker',receive);}catch{}
   socket=null;
  }
 }
 function poll(){
  if(closed||!bot.running)return false;
  const held=carrier();
  if(held==='unknown'){reason='inventory-unknown';return false;}
  if(!held){reason='carrier-not-held';pendingAt=0;return false;}
  const now=clock();
  if(pendingAt&&now-pendingAt<timeout)return false;
  if(pendingAt){pendingAt=0;reason='server-timeout';}
  if(lastRequestAt&&now-lastRequestAt<interval)return false;
  const live=p.trackerSocket?.();
  if(!live||typeof live.on!=='function'||typeof live.emit!=='function'||
     !(typeof live.off==='function'||typeof live.removeListener==='function')){
    reason='tracker-socket-unavailable';return false;
  }
  if(socket!==live){detach();try{live.on('tracker',receive);socket=live;}
    catch{socket=null;reason='tracker-listener-failed';return false;}}
  lastRequestAt=now;pendingAt=now;reason='requested';
  try{live.emit('tracker');return true;}
  catch{pendingAt=0;reason='tracker-request-failed';return false;}
 }
 function status(){
  const held=carrier(),now=clock();
  const current=receivedAt>0&&now>=receivedAt&&now-receivedAt<=ttl;
  const rows=current&&held&&held!=='unknown'?entries??[]:[];
  return {state:held==='unknown'?'inventory-unknown':!held?'carrier-not-held':
    !current&&receivedAt>0?'stale':reason,
   carrier:held,observedAt:current?receivedAt:null,
   observedMonsters:rows.length,
   // An actual server score, not an estimate. Limited diagnostic output and
   // no use in automatic farm ordering until live evidence is validated.
   closestMilestones:rows.filter(r=>r.gap!==null)
    .sort((a,b)=>a.gap-b.gap||a.monster.localeCompare(b.monster))
    .slice(0,12)};
 }
 function bonus(monster){
  if(!bot.running||!carrier()||
     !receivedAt||clock()<receivedAt||clock()-receivedAt>ttl||
     typeof monster!=='string')return 0;
  return achievementMilestoneBias(entries?.find(row=>row.monster===monster));
 }
 return {poll,status,bonus,close(){closed=true;pendingAt=0;detach();}};
}
