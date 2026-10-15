// Session-scoped, read-only outgoing hit/heal intents. Never mutate game
// entities, synthesize dead mobs, block skills or re-dispatch value actions.
// In-flight confirmations are advisory until live evidence validates timing.
export function createImpactIntents({
 name,session,realm,now=()=>Date.now(),limit=48,ttlMs=2500
}={}){
 const pending=new Map(),events=[];
 let counter=0,confirmed=0,expired=0,failed=0;
 const validId=id=>typeof id==='string'&&id.length>0&&id.length<128;
 const bounded=Array.isArray([])&&Math.max(4,Math.min(64,limit));
 const ttl=Math.max(250,Math.min(10000,ttlMs));
 const keepEvent=e=>{events.push(e);if(events.length>24)events.shift();};
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
 function confirmedHit(event){
  prune();
  const actor=typeof event?.actor==='string'?event.actor:event?.actor?.name;
  const target=typeof event?.target==='string'?event.target:event?.target?.id;
  if(actor!==name||!validId(target))return false;
  for(const [id,p] of pending){
   if(p.kind!=='damage'||!p.targets.includes(target)||p.confirmed.includes(target))continue;
   p.confirmed.push(target);confirmed++;
   keepEvent({action:p.action,result:'observed-hit',target});
   if(p.confirmed.length===p.targets.length)pending.delete(id);
   return true;
  }
  return false;
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
  session,realm,active:pending.size,confirmed,expired,failed,
  recent:[...pending.values()].slice(-8).map(p=>({
   action:p.action,kind:p.kind,targets:p.targets,
   remainingMs:Math.max(0,p.expires-now()),confirmed:p.confirmed.length
  })),events:events.slice(-8)};}
 function heartbeat(){prune();return [...pending.values()].slice(-3).map(p=>({
  action:p.action,kind:p.kind,targets:p.targets.slice(0,5),
  at:p.at,expires:p.expires,session:p.session,realm:p.realm,damage:p.damage
 }));}
 return {launched,confirmedHit,settle,snapshot,heartbeat,prune,
  close(){pending.clear();}};
}
