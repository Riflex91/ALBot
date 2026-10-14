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
      Number.isFinite(row[0])&&row[0]>score&&row[0]>0)
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
export function createAchievementScores(bot,clock=()=>Date.now()){
 const {p}=bot,interval=120000,ttl=600000,timeout=15000;
 let socket=null,lastRequestAt=0,pendingAt=0,receivedAt=0,entries=null,
  reason='not-observed',closed=false;
 function receive(data){
  if(!pendingAt||closed)return false;
  pendingAt=0;
  const rows=verifiedTrackerScores(data,p.G);
  if(!rows){reason='invalid-server-reply';return false;}
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
  const carrier=carriedAchievementCarrier(p.c?.items);
  if(carrier==='unknown'){reason='inventory-unknown';return false;}
  if(!carrier){reason='carrier-not-held';pendingAt=0;return false;}
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
  const carrier=carriedAchievementCarrier(p.c?.items),now=clock();
  const current=receivedAt>0&&now>=receivedAt&&now-receivedAt<=ttl;
  const rows=current&&carrier?entries??[]:[];
  return {state:carrier==='unknown'?'inventory-unknown':!carrier?'carrier-not-held':
    !current&&receivedAt>0?'stale':reason,
   carrier,observedAt:current?receivedAt:null,
   observedMonsters:rows.length,
   // An actual server score, not an estimate. Limited diagnostic output and
   // no use in automatic farm ordering until live evidence is validated.
   closestMilestones:rows.filter(r=>r.gap!==null)
    .sort((a,b)=>a.gap-b.gap||a.monster.localeCompare(b.monster))
    .slice(0,12)};
 }
 return {poll,status,close(){closed=true;pendingAt=0;detach();}};
}
