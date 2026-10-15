// Deterministic, per-character hunt evidence. Never infer a quest from the
// picture, the current target or a different player's status.
export function normalizedHunt(q){
 if(q===null||q===undefined)return null;
 if(typeof q.id!=='string'||!q.id||!Number.isSafeInteger(q.c)||q.c<0)return undefined;
 const result={id:q.id,c:q.c};
 if(Number.isFinite(q.ms))result.ms=Math.max(0,Math.floor(q.ms));
 if(typeof q.sn==='string'&&q.sn)result.sn=q.sn;
 return result;
}
export function huntForFarmer(name,localName,localStatus,peer,realm){
 if(name===localName)return normalizedHunt(localStatus);
 if(!peer||peer.running!==true||peer.rip||peer.realm!==realm||
   !Object.prototype.hasOwnProperty.call(peer,'monsterhunt'))return undefined;
 const q=normalizedHunt(peer.monsterhunt);
 if(q?.ms!==undefined)q.ms=Math.max(0,q.ms-Math.max(0,Date.now()-(peer.received??Date.now())));
 return q;
}
export function advanceHuntCycle(state,roster,hunt){
 const names=roster.filter(n=>typeof n==='string'&&n);
 const valid=state&&JSON.stringify(state.names)===JSON.stringify(names)&&
   Number.isSafeInteger(state.index)&&state.index>=0&&state.index<names.length;
 const current=valid?{...state}:{names,index:0,phase:'acquire',lastId:null};
 if(!names.length)return {state:current,objective:null,changed:false};
 if(hunt===undefined)return {state:current,objective:{owner:names[current.index],phase:'unknown'},changed:!valid};
 let next={...current};
 // An actual exhausted server timer is never a confirmed turn-in.
 // Suspend that hunt for a bounded period, so three expired quests do not
 // cause a perpetual A->B->C->A rotation on every scheduler tick.
 if(hunt?.ms===0){
  next.skipped={...(next.skipped??{}),[names[next.index]]:{
   id:hunt.id,until:Date.now()+60000}};
  next.index=(next.index+1)%names.length;next.phase='acquire';next.lastId=null;
 }else if(next.phase==='turnin'&&(hunt===null||hunt.c>0)){
  next.index=(next.index+1)%names.length;next.phase='acquire';next.lastId=null;
 }else if(hunt===null&&next.phase==='combat'){
  next.index=(next.index+1)%names.length;next.phase='acquire';next.lastId=null;
 }else if(hunt&&hunt.c===0){next.phase='turnin';next.lastId=hunt.id;}
 else if(hunt&&hunt.c>0){next.phase='combat';next.lastId=hunt.id;}
 const changed=JSON.stringify(next)!==JSON.stringify(state);
 return {state:next,objective:{owner:names[next.index],phase:next.phase},changed};
}


// An active quest is never altered by an unavailable spawn. Suspend its
// prioritization for a bounded interval, then offer the next farmer a turn.
// Only the leader may call this AFTER a complete safe-spawn evaluation.
export function skipHuntWithoutSpawn(state,roster,verified,now=Date.now(),retryMs=300000){
 const names=(roster??[]).filter(n=>typeof n==='string'&&n);
 const index=state?.index;
 if(!names.length||!Number.isInteger(index)||index<0||index>=names.length||
    verified?.safeSpawnChecked!==true||verified?.owner!==names[index]||
    typeof verified?.monster!=='string'||!verified.monster||
    !Number.isSafeInteger(verified.remaining)||verified.remaining<=0||
    !Number.isFinite(now)||retryMs<1000)
  return {state,changed:false};
 const skipped={...(state.skipped??{})};
 skipped[verified.owner]={id:verified.monster,until:now+retryMs};
 const next={...state,skipped,index:(index+1)%names.length,
  phase:'acquire',lastId:null};
 return {state:next,changed:true};
}

// Re-evaluate previously deferred requests only when their time expires or
// their actual quest changes. A complete round of rejected hunts yields one
// stable "blocked" objective rather than endlessly rotating the team.
export function advancePastSkippedHunts(state,roster,lookup,now=Date.now()){
 const names=(roster??[]).filter(n=>typeof n==='string'&&n);
 if(!names.length||!state||!Number.isInteger(state.index)||
    state.index<0||state.index>=names.length)
  return {state,changed:false,allBlocked:false};
 const original=state.index;
 let index=original;
 for(let i=0;i<names.length;i++){
  const name=names[index],q=lookup(name);
  const entry=state.skipped?.[name];
  if(q===undefined||q===null||q.c===0||!entry||
     entry.id!==q.id||!Number.isFinite(entry.until)||entry.until<=now){
   if(index===original)return {state,changed:false,allBlocked:false};
   return {state:{...state,index,phase:'acquire',lastId:null},
    changed:true,allBlocked:false};
  }
  index=(index+1)%names.length;
 }
 return {state,changed:false,allBlocked:true};
}

// The official monsterhunt condition lasts 1,800,000ms. Compare actual
// remaining game-state milliseconds, never a fabricated local countdown.
// Reject a run that cannot reasonably finish AND return to Daisy in time.
export const OFFICIAL_HUNT_DURATION_MS=1800000;
export function huntDeadlineStatus(hunt,realm,estimatedTravelSeconds=0,
 estimatedSecondsPerKill=0,turnInSeconds=45){
 if(!hunt)return {state:'none'};
 if(hunt.ms===undefined)return {state:'unverified',remainingMs:null};
 if(!Number.isFinite(hunt.ms))return {state:'unverified',remainingMs:null};
 if(hunt.ms<=0)return {state:'expired',remainingMs:0};
 if(hunt.sn&&typeof realm==='string'&&
  hunt.sn.replace(/[\s_-]+/g,'').toUpperCase()!==realm.replace(/[\s_-]+/g,'').toUpperCase())
  return {state:'wrong-realm',remainingMs:hunt.ms};
 const neededMs=Math.ceil((Math.max(0,estimatedTravelSeconds)+
  Math.max(0,estimatedSecondsPerKill)*Math.max(0,hunt.c)+
  Math.max(0,turnInSeconds))*1000);
 return {state:hunt.ms<=neededMs?'insufficient-time':'viable',
  remainingMs:hunt.ms,neededMs};
}
