import {approvedLocalScoutHop,insideScoutFarmBoundary} from './local-scout.mjs';
// N05: passive, realm/instance-scoped observed monster calendar.
// No predictions, travel, targeting, combat credit or game mutations.
const MAX_ROWS=64,MAX_HITS=128,MAX_AGE_MS=21600000,MAX_HIT_MS=30000;
// Local scout observation is strictly diagnostic; it cannot request travel.
const SCOUT_WINDOW_MS=300000,SCOUT_MAX_NEGATIVES=12,SCOUT_RADIUS=650;
const cleanName=s=>typeof s==='string'&&s.length>0&&s.length<=100;
const cleanTime=n=>Number.isSafeInteger(n)&&n>0;
const location=(realm,c)=>cleanName(realm)&&cleanName(c?.map)?
 {realm,map:c.map,in:cleanName(c.in)?c.in:c.map}:null;
const same=(a,b)=>!!a&&!!b&&a.realm===b.realm&&
 a.map===b.map&&a.in===b.in;
function validRow(r,realm,now){
 return r&&cleanName(r.id)&&cleanName(r.monster)&&
  cleanName(r.map)&&cleanName(r.in)&&r.realm===realm&&
  cleanTime(r.lastSeenAt)&&r.lastSeenAt<=now&&
  now-r.lastSeenAt<=MAX_AGE_MS&&
  Number.isFinite(r.x)&&Number.isFinite(r.y)&&
  (!r.killedAt||cleanTime(r.killedAt)&&r.killedAt>=r.lastSeenAt&&r.killedAt<=now);
}
export function createRespawnCalendar(bot,{now=()=>Date.now()}={}){
 const {p,me}=bot,key='albot:respawn-calendar:v1:'+me.name;
 const hits=new Map(),rows=new Map(),issuedScoutHops=new Set();
 let activeScoutHop=null,lastScoutHop=null;
 let persisted=true,realm=p.realm(),session=bot.session,lastSample=0;
 const saved=p.read?.(key);
 if(saved?.version===1&&saved.owner===me.name&&saved.realm===realm&&
    Array.isArray(saved.rows)&&saved.rows.length<=MAX_ROWS){
  for(const r of saved.rows)if(validRow(r,realm,now()))
   rows.set(r.id,{id:r.id,monster:r.monster,realm,map:r.map,in:r.in,
    x:r.x,y:r.y,lastSeenAt:r.lastSeenAt,killedAt:r.killedAt??null,
    lastMissingAt:null,missingObservations:0,
    // Reloaded kill evidence cannot restart or extend an old scout lease.
    scoutState:r.killedAt?'historical-unverified':null,
    scoutUntil:null,scoutNegatives:0,resightedAt:null});
 }
 function expire(){
  const time=now(),current=p.realm(),currentSession=bot.session;
  // A session restart invalidates all local sighting/hit/scout evidence,
  // even when the same character remains on the same server and map.
  if(current!==realm||currentSession!==session){
   realm=current;session=currentSession;rows.clear();hits.clear();
   issuedScoutHops.clear();activeScoutHop=null;lastScoutHop=null;
   lastSample=0;persisted=false;
  }
  for(const [id,row] of rows){
   if(time-row.lastSeenAt>MAX_AGE_MS||row.lastSeenAt>time){
    rows.delete(id);continue;
   }
   if(row.scoutState==='observing'&&time>=row.scoutUntil)
    row.scoutState='window-expired';
  }
  for(const [id,hit] of hits)if(time-hit.at>MAX_HIT_MS||hit.at>time)
   hits.delete(id);
 }
 const scoped=entity=>{
  const pos=location(realm,entity);
  return pos&&Number.isFinite(entity.x)&&Number.isFinite(entity.y)&&
   cleanName(entity.id)&&cleanName(entity.mtype)&&
   entity.type==='monster'&&!entity.rip&&entity.hp>0&&!entity.dead?
   pos:null;
 };
 function sample(){
  expire();
  guardScoutMovement();
  if(!bot.running||!cleanName(session))return;
  const time=now(),where=location(realm,p.c);
  // Without a real local observer position, neither a sighting nor a
  // negative line-of-sight sample is admissible evidence.
  if(!where||!Number.isFinite(p.c.x)||!Number.isFinite(p.c.y))return;
  // Bounded polling; local visible entities are sightings, not global spawns.
  // A missing/invalid or truncated array cannot prove any monster absent.
  if(time-lastSample<1500)return;
  const snapshot=bot.monsters?.();
  if(!Array.isArray(snapshot))return;
  const completeSnapshot=snapshot.length<=128;
  lastSample=time;const visible=new Set();
  for(const entity of snapshot.slice(0,128)){
   const scope=scoped(entity);
   if(!scope||!same(scope,where)||
      Math.hypot(entity.x-p.c.x,entity.y-p.c.y)>900)continue;
   visible.add(entity.id);
   const prior=rows.get(entity.id);
   // A just-killed monster can remain rendered as living while the server
   // refreshes the entities collection. Preserve the recorded death until
   // this SAME local observer has first sampled its actual absence.
   // Historical checkpoints also need a new post-kill absence observation.
   if(prior?.killedAt&&prior.monster===entity.mtype&&same(prior,scope)&&
      !(Number.isSafeInteger(prior.lastMissingAt)&&
       prior.lastMissingAt>=prior.killedAt))continue;
   // This is only a verified live re-sighting of the same ID and species,
   // never a server-confirmed spawn timer or permission for a new hunt.
   const reappeared=prior?.killedAt&&prior.monster===entity.mtype&&
    same(prior,scope)&&prior.scoutState==='observing'&&
    prior.scoutNegatives>0&&time<=prior.scoutUntil&&
    prior.scoutNegatives<SCOUT_MAX_NEGATIVES;
   const recentResighting=reappeared||prior?.scoutState==='live-resighting-observed'&&
    prior.monster===entity.mtype&&same(prior,scope)&&
    Number.isSafeInteger(prior.resightedAt)&&time-prior.resightedAt<=SCOUT_WINDOW_MS;
   rows.delete(entity.id);
   rows.set(entity.id,{id:entity.id,monster:entity.mtype,...scope,
    x:entity.x,y:entity.y,lastSeenAt:time,
    killedAt:null,lastMissingAt:null,missingObservations:0,
    scoutState:recentResighting?'live-resighting-observed':null,
    scoutUntil:null,scoutNegatives:recentResighting?
     prior?.scoutNegatives??0:0,
    resightedAt:reappeared?time:recentResighting?prior.resightedAt:null});
   if(rows.size>MAX_ROWS)rows.delete(rows.keys().next().value);
  }
  // Observing only the first 128 of a longer list is enough to affirm
  // visible monsters, but not enough to make any negative observation.
  if(!completeSnapshot)return;
  for(const [id,row] of rows){
   if(visible.has(id)||!same(row,where)||
      !Number.isFinite(p.c.x)||!Number.isFinite(p.c.y)||
      Math.hypot(row.x-p.c.x,row.y-p.c.y)>SCOUT_RADIUS)continue;
   // Negative visibility is not a death or absence proof. A confirmed
   // local kill permits at most twelve strictly local scout samples.
   if(row.killedAt){
    // A local negative observation is needed to distinguish later live
    // evidence from a stale death render. Historical/expired scout leases
    // may collect this observation but do not reopen an executable lease.
    row.lastMissingAt=time;
    if(row.scoutState==='observing'){
     row.scoutNegatives=Math.min(SCOUT_MAX_NEGATIVES,row.scoutNegatives+1);
     if(row.scoutNegatives>=SCOUT_MAX_NEGATIVES)
      row.scoutState='negative-evidence-limit';
    }
    continue;
   }
   row.lastMissingAt=time;
   row.missingObservations=Math.min(99,row.missingObservations+1);
  }
 }
 function hit(data){
  expire();
  if(!bot.running||!cleanName(session)||data?.actor!==me.name||!(data.damage>0)||
     !cleanName(data.target))return;
  const entity=bot.entity?.(data.target),scope=scoped(entity);
  if(!scope||!same(scope,location(realm,p.c)))return;
  hits.set(data.target,{at:now(),session,monster:entity.mtype,...scope,
   x:entity.x,y:entity.y});
  if(hits.size>MAX_HITS)hits.delete(hits.keys().next().value);
  if(data.kill===true)credit(data.target);
 }
 function credit(id){
  expire();
  const hit=hits.get(id);if(!cleanName(session)||!hit||
     hit.session!==session||now()-hit.at>MAX_HIT_MS||
     !same(hit,location(realm,p.c)))return false;
  const time=now();
  const old=rows.get(id);
  // An event without a prior local, real monster sighting cannot certify a
  // kill. This prevents other-character and cross-realm death attribution.
  if(!old||old.killedAt||old.monster!==hit.monster||!same(old,hit)||
     hit.at>time||old.lastSeenAt>time||
     time-old.lastSeenAt>MAX_HIT_MS)return false;
  const row={...old,killedAt:time,lastMissingAt:null,missingObservations:0,
   scoutState:'observing',scoutUntil:time+SCOUT_WINDOW_MS,
   scoutNegatives:0,resightedAt:null};
  rows.delete(id);rows.set(id,row);hits.delete(id);
  const checkpoint={version:1,owner:me.name,realm,at:time,
   rows:[...rows.values()].map(({id,monster,map,in:x,x:posX,y,lastSeenAt,killedAt})=>
    ({id,monster,realm,map,in:x,x:posX,y,lastSeenAt,killedAt}))};
  persisted=p.write?.(key,checkpoint)===true;
  return true;
 }
 function death(data){
  if((data?.actor??data?.hid??data?.killer)!==me.name)return false;
  return cleanName(data?.id)?credit(data.id):false;
 }
 // Shared authorizations for planning AND native dispatch. Movement
 // ownership is deliberately checked only before planning, since the same
 // scout must still own its queued order when this runs at dispatch time.
 function scoutContextSafe(plan){
  return !!(bot.running&&cleanName(session)&&plan&&
   bot.me?.role==='farmer'&&bot.me.name===bot.leader&&
   bot.cfg?.party?.enabled===false&&
   (bot.farmers?.length??1)<=1&&
   !bot.journal&&!bot.inventoryBlocked&&!bot.logistics?.reserved&&
   !bot.strategy?.busy&&!p.c.rip&&!p.c.stand&&
   bot.teamPlan?.valid?.(plan)===true&&
   bot.teamPlan?.heartbeat?.()?.id===plan.id&&
   bot.teamPlan?.allowed?.(plan.target)===true&&
   bot.strategy?.permittedMap?.(plan.map)===true&&
   !p.G?.maps?.[plan.map]?.pvp&&
   Number.isFinite(p.c.hp)&&Number.isFinite(p.c.max_hp)&&
   p.c.max_hp>0&&p.c.hp/p.c.max_hp>=.9&&
   bot.combatAssessment?.emergency?.()?.active!==true&&
   !(bot.monsters?.()??[]).some(m=>m?.hp>0&&!m.dead&&
    (m.target===me.name||m.target&&bot.teamNames?.includes?.(m.target))));
 }
 // Native local reachability is time-dependent: a path that was clear at
 // planning or dispatch can become blocked while a scout is moving.
 // Missing/throwing adapters are not movement permission.
 function scoutRouteClear(point){
  if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return false;
  try{return p.has?.('can_move_to')===true&&
   p.call('can_move_to',point.x,point.y)===true;}catch{return false;}
 }
 function scout(plan){
  expire();
  const time=now();
  if(!scoutContextSafe(plan)||bot.movement?.order||
     bot.movement?.nativeBusy?.()!==false||
     !bot.movement?.local)return false;
  const options=[...rows.values()].filter(row=>row.monster===plan.target)
   .sort((a,b)=>b.killedAt-a.killedAt).slice(0,4);
  for(const row of options){
   const key=row.id+':'+row.killedAt;
   if(issuedScoutHops.has(key))continue;
   const result=approvedLocalScoutHop({row,plan,character:p.c,
    realm,now:time,approved:true,solo:true,safe:true});
   if(!result.allowed)continue;
   if(!scoutRouteClear(result.point))continue;
   // The executor may defer a move until after this tick's action
   // arbitration. Re-evaluate the SAME live kill, plan, bounds, session,
   // team safety and coordinates immediately before the native move call.
   const lease={ownerSession:session,realm,id:row.id,
    killedAt:row.killedAt,planId:plan.id,
    x:result.point.x,y:result.point.y};
   const admitAtDispatch=()=>{
    expire();
    const current=bot.teamPlan?.heartbeat?.(),live=rows.get(lease.id);
    if(session!==lease.ownerSession||realm!==lease.realm||
       bot.movement?.nativeBusy?.()!==false||
       !current||current.id!==lease.planId||
       !scoutContextSafe(current)||!live||
       live.killedAt!==lease.killedAt)return false;
    const next=approvedLocalScoutHop({row:live,plan:current,
     character:p.c,realm,now:now(),
     approved:true,solo:true,safe:true});
    return next.allowed&&next.point.map===result.point.map&&
     next.point.in===result.point.in&&
     next.point.x===lease.x&&next.point.y===lease.y&&
     scoutRouteClear(next.point);
   };
   if(bot.movement.local(result.point.x,result.point.y,'scout',
       admitAtDispatch)!==true)continue;
   issuedScoutHops.add(key);
   if(issuedScoutHops.size>64)
    issuedScoutHops.delete(issuedScoutHops.values().next().value);
   activeScoutHop={...result.witness,at:time,session,point:result.point};
   lastScoutHop={state:'in-flight',id:row.id,monster:row.monster,
    map:row.map,at:time,endedAt:null,executable:false};
   bot.event?.('respawn.localScoutHop',{monster:row.monster,
    id:row.id,map:row.map,reason:result.reason,
    radius:result.point.radius,authority:'approved-current-farm-only'});
   return true;
  }
  return false;
 }
 function guardScoutMovement(){
  const order=bot.movement?.order;
  const finish=state=>{
   if(!activeScoutHop)return;
   lastScoutHop={...lastScoutHop,state,endedAt:now()};
   bot.event?.('respawn.localScoutOutcome',{id:activeScoutHop.id,
    state,authority:'physical-local-observation-only'});
   activeScoutHop=null;
  };
  if(order?.owner!=='scout'){
   if(activeScoutHop){
    const a=activeScoutHop,plan=bot.teamPlan?.heartbeat?.(),r=rows.get(a.id),
     where=location(realm,p.c),point=a.point;
    const arrived=!order&&bot.running&&a.session===session&&
     a.realm===realm&&now()-a.at<=12000&&
     plan?.id===a.planId&&bot.teamPlan?.valid?.(plan)===true&&
     r?.killedAt===a.killedAt&&r.scoutState==='observing'&&
     now()<r.scoutUntil&&plan?.map===point?.map&&
     plan?.in===point?.in&&where?.map===point?.map&&
     where?.in===point?.in&&
     insideScoutFarmBoundary(point,plan?.bounds)&&
     insideScoutFarmBoundary(p.c,plan?.bounds)&&!p.c.rip&&
     Number.isFinite(p.c.x)&&Number.isFinite(p.c.y)&&
     Math.hypot(p.c.x-point.x,p.c.y-point.y)<=12;
    finish(arrived?'local-arrival-observed':'outcome-unverified');
   }
   return;
  }
  const a=activeScoutHop,plan=bot.teamPlan?.heartbeat?.(),r=rows.get(a?.id);
  const invalid=!bot.running||!a||a.session!==session||
   a.realm!==realm||now()-a.at>12000||
   !plan||plan.id!==a.planId||
   bot.teamPlan?.valid?.(plan)!==true||
   !insideScoutFarmBoundary(p.c,plan?.bounds)||
   !insideScoutFarmBoundary(a?.point,plan?.bounds)||
   bot.teamPlan?.allowed?.(plan?.target)!==true||
   bot.strategy?.permittedMap?.(plan?.map)!==true||
   p.G?.maps?.[plan?.map]?.pvp===true||
   order.mode!=='move'||!a?.point||!order.dest||
   order.dest.map!==a.point.map||order.dest.in!==a.point.in||
   !Number.isFinite(order.dest.x)||!Number.isFinite(order.dest.y)||
   Math.hypot(order.dest.x-a.point.x,order.dest.y-a.point.y)>.1||
   bot.me?.role!=='farmer'||bot.me.name!==bot.leader||
   bot.cfg?.party?.enabled!==false||
   (bot.farmers?.length??1)>1||
   bot.journal||bot.inventoryBlocked||bot.logistics?.reserved||
   bot.strategy?.busy||p.c.rip||p.c.stand||
   !Number.isFinite(p.c.hp)||!Number.isFinite(p.c.max_hp)||
   p.c.max_hp<=0||p.c.hp/p.c.max_hp<.9||
   bot.combatAssessment?.emergency?.()?.active===true||
   (bot.monsters?.()??[]).some(m=>m?.hp>0&&!m.dead&&
    (m.target===me.name||m.target&&bot.teamNames?.includes?.(m.target)))||
   !r||r.killedAt!==a.killedAt||r.scoutState!=='observing'||
   now()>=r.scoutUntil||r.scoutNegatives>=SCOUT_MAX_NEGATIVES||
   !same(location(realm,p.c),r)||
   !scoutRouteClear(a?.point);
  if(invalid){
   const timedOut=!!a&&now()-a.at>12000;
   bot.movement.stop?.();
   finish(timedOut?'timeout-aborted':'safety-aborted');
  }
 }
 function status(){
  expire();
  const time=now(),where=location(realm,p.c);
  return {version:1,mode:'passive-observation-only',executable:false,
   predictionAuthorized:false,realm,owner:me.name,
   session:cleanName(session)?session:null,
   persistence:persisted?'best-effort':'unconfirmed',
   localScoutHop:lastScoutHop?{...lastScoutHop}:null,
   rows:[...rows.values()].filter(r=>same(r,where)).slice(-MAX_ROWS)
    .map(r=>({id:r.id,monster:r.monster,map:r.map,in:r.in,
     x:r.x,y:r.y,lastSeenAt:r.lastSeenAt,killedAt:r.killedAt,
     state:r.killedAt?'own-kill-observed':
      r.lastMissingAt?'not-currently-visible':'visible-last-sampled',
     lastMissingAt:r.lastMissingAt,missingObservations:r.missingObservations,
     ageMs:Math.max(0,time-r.lastSeenAt),respawnAt:null,
     scout:{state:r.scoutState??'none',
      negativeObservations:r.scoutNegatives??0,
      until:r.scoutState==='observing'?r.scoutUntil:null,
      resightedAt:r.resightedAt??null,
      authority:'local-visibility-only',executable:false}}))};
 }
 return {sample,hit,death,status,scout,guardScoutMovement,
  close(){hits.clear();issuedScoutHops.clear();
   activeScoutHop=null;lastScoutHop=null;}};
}
