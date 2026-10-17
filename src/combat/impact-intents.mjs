// Session-scoped, read-only outgoing hit/heal intents. Never mutate game
// entities, synthesize dead mobs, block skills or re-dispatch value actions.
// In-flight confirmations are advisory until live evidence validates timing.
export function createImpactIntents({
 name,session,realm,now=()=>Date.now(),limit=48,ttlMs=2500
}={}){
 const pending=new Map(),events=[];
 let counter=0,confirmed=0,confirmedHeals=0,expired=0,failed=0;
 let observedDamage=0,observedHealing=0;
 const observedLatencies=[];
 const observedEventIds=new Set();
 const validId=id=>typeof id==='string'&&id.length>0&&id.length<128;
 const bounded=Array.isArray([])&&Math.max(4,Math.min(64,limit));
 const ttl=Math.max(250,Math.min(10000,ttlMs));
 const keepEvent=e=>{events.push(e);if(events.length>24)events.shift();};
 const keepLatency=p=>{
  const elapsed=Math.max(0,Math.min(ttl,now()-p.at));
  observedLatencies.push(elapsed);
  if(observedLatencies.length>32)observedLatencies.shift();
 };
 const latencyP95=()=>{
  if(!observedLatencies.length)return null;
  const sorted=[...observedLatencies].sort((a,b)=>a-b);
  return sorted[Math.ceil(sorted.length*.95)-1];
 };
 function prune(){for(const [id,p] of pending)
  if(now()>=p.expires){pending.delete(id);expired++;keepEvent({result:'ttl-expired',action:p.action});}}
 function launched(action,targets,{kind='damage',damage=null}={}){
  prune();
  if(!validId(action)||!['damage','heal'].includes(kind)||!Array.isArray(targets)||
     !targets.length||targets.length>5||targets.some(t=>!validId(t))||
     new Set(targets).size!==targets.length||!validId(session)||!validId(realm))
   return null;
  const id=session+':intent:'+(++counter);
  const budgets=kind==='damage'&&damage&&typeof damage==='object'?
   Object.fromEntries(targets.filter(t=>Number.isSafeInteger(damage[t])&&
     damage[t]>0&&damage[t]<=10000000).map(t=>[t,damage[t]])):{};
  const row={id,action,targets:[...targets],kind,actor:name,session,realm,
   at:now(),expires:now()+ttl,confirmed:[],damage:budgets};
  if(pending.size>=bounded)pending.delete(pending.keys().next().value);
  pending.set(id,row);
  return id;
 }
 // Preserve the public legacy damage confirmation API. The live game event
 // handler uses observe() below, which rejects hit notifications lacking an
 // explicit positive damage/heal field.
 function confirmedHit(event){
  prune();
  const actor=typeof event?.actor==='string'?event.actor:event?.actor?.name;
  const target=typeof event?.target==='string'?event.target:event?.target?.id;
  if(actor!==name||!validId(target)||event?.realm&&event.realm!==realm)return false;
  for(const [id,p] of pending){
   if(p.kind!=='damage'||!p.targets.includes(target)||p.confirmed.includes(target))continue;
   p.confirmed.push(target);confirmed++;
   keepLatency(p);
   const amount=Number.isFinite(event.damage)&&event.damage>0&&
    event.damage<=10000000?event.damage:null;
   if(amount!==null)observedDamage+=amount;
   keepEvent({action:p.action,result:'observed-hit',target,
    amount,latencyMs:Math.max(0,Math.min(ttl,now()-p.at))});
   if(p.confirmed.length===p.targets.length)pending.delete(id);
   return true;
  }
  return false;
 }
 function confirmedHeal(event){
  prune();
  const actor=typeof event?.actor==='string'?event.actor:event?.actor?.name;
  const target=typeof event?.target==='string'?event.target:
   event?.target?.name??event?.target?.id;
  if(actor!==name||!validId(target)||!Number.isFinite(event?.heal)||
   event.heal<=0||event.heal>10000000||event?.realm&&event.realm!==realm)
   return false;
  for(const [id,p] of pending){
   if(p.kind!=='heal'||!p.targets.includes(target)||p.confirmed.includes(target))
    continue;
   p.confirmed.push(target);confirmedHeals++;
   keepLatency(p);
   observedHealing+=event.heal;
   keepEvent({action:p.action,result:'observed-heal',target,
    amount:event.heal,latencyMs:Math.max(0,Math.min(ttl,now()-p.at))});
   if(p.confirmed.length===p.targets.length)pending.delete(id);
   return true;
  }
  return false;
 }
 // A single server hit event must not be credited twice, nor can healing
 // be mistaken for damage. Unidentified duplicate server callbacks are only
 // advisory and never authorize actions. Bounded ID cache is per session.
 function observe(event){
  const eventId=typeof event?.id==='string'&&event.id.length<=128?
   event.id:null;
  if(eventId&&observedEventIds.has(eventId))return false;
  // Do not decide whether a mixed damage/healing server record describes a
  // projectile hit or an independently launched heal without a distinct ID.
  if(Number.isFinite(event?.damage)&&event.damage>0&&
     Number.isFinite(event?.heal)&&event.heal>0)return false;
  const result=Number.isFinite(event?.heal)&&event.heal>0?
   confirmedHeal(event):Number.isFinite(event?.damage)&&event.damage>0?
   confirmedHit(event):false;
  if(result&&eventId){
   if(observedEventIds.size>=64)observedEventIds.delete(observedEventIds.values().next().value);
   observedEventIds.add(eventId);
  }
  return result;
 }
 function settle(id,result){
  prune();const p=pending.get(id);if(!p)return false;
  if(['rejected','unknown','timeout','superseded'].includes(result)){
   pending.delete(id);failed++;keepEvent({action:p.action,result});return true;
  }
  // 'returned' is NOT a confirmed projectile impact or heal.
  return false;
 }
 function snapshot(){prune();return {mode:'shadow-only',
  session,realm,active:pending.size,confirmed,confirmedHeals,expired,failed,
  observedDamage,observedHealing,observedLatencyP95Ms:latencyP95(),
  observedLatencySamples:observedLatencies.length,
  recent:[...pending.values()].slice(-8).map(p=>({
   action:p.action,kind:p.kind,targets:p.targets,
   remainingMs:Math.max(0,p.expires-now()),confirmed:p.confirmed.length
  })),events:events.slice(-8)};}
 function heartbeat(){prune();return [...pending.values()].slice(-3).map(p=>{
  const outstanding=p.targets.filter(id=>!p.confirmed.includes(id)).slice(0,5);
  return {action:p.action,kind:p.kind,targets:outstanding,
   at:p.at,expires:p.expires,session:p.session,realm:p.realm,
   damage:Object.fromEntries(outstanding.filter(id=>p.damage?.[id]>0)
    .map(id=>[id,p.damage[id]]))};
 });}
 return {launched,confirmedHit,confirmedHeal,observe,settle,snapshot,heartbeat,prune,
  close(){pending.clear();observedEventIds.clear();observedLatencies.length=0;}};
}
