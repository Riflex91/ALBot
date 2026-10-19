// N05: passive, realm/instance-scoped observed monster calendar.
// No predictions, travel, targeting, combat credit or game mutations.
const MAX_ROWS=64,MAX_HITS=128,MAX_AGE_MS=21600000,MAX_HIT_MS=30000;
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
 const hits=new Map(),rows=new Map();
 let persisted=true,realm=p.realm(),lastSample=0;
 const saved=p.read?.(key);
 if(saved?.version===1&&saved.owner===me.name&&saved.realm===realm&&
    Array.isArray(saved.rows)&&saved.rows.length<=MAX_ROWS){
  for(const r of saved.rows)if(validRow(r,realm,now()))
   rows.set(r.id,{id:r.id,monster:r.monster,realm,map:r.map,in:r.in,
    x:r.x,y:r.y,lastSeenAt:r.lastSeenAt,killedAt:r.killedAt??null,
    lastMissingAt:null,missingObservations:0});
 }
 function expire(){
  const time=now(),current=p.realm();
  if(current!==realm){realm=current;rows.clear();hits.clear();
   lastSample=0;persisted=false;}
  for(const [id,row] of rows)if(time-row.lastSeenAt>MAX_AGE_MS||row.lastSeenAt>time)
   rows.delete(id);
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
  if(!bot.running)return;
  const time=now(),where=location(realm,p.c);if(!where)return;
  // Bounded polling; local visible entities are sightings, not global spawns.
  if(time-lastSample<1500)return;
  lastSample=time;const visible=new Set();
  for(const entity of (bot.monsters?.()??[]).slice(0,128)){
   const scope=scoped(entity);
   if(!scope||!same(scope,where)||
      Math.hypot(entity.x-p.c.x,entity.y-p.c.y)>900)continue;
   visible.add(entity.id);
   rows.delete(entity.id);
   rows.set(entity.id,{id:entity.id,monster:entity.mtype,...scope,
    x:entity.x,y:entity.y,lastSeenAt:time,
    // A fresh live sighting is not a still-dead entity. Never continue
    // displaying an earlier kill as the current state of a live monster.
    killedAt:null,
    lastMissingAt:null,missingObservations:0});
   if(rows.size>MAX_ROWS)rows.delete(rows.keys().next().value);
  }
  for(const [id,row] of rows){
   if(visible.has(id)||row.killedAt||!same(row,where)||
      Math.hypot(row.x-p.c.x,row.y-p.c.y)>650)continue;
   // A missing render is only negative VISIBILITY evidence. Never death.
   row.lastMissingAt=time;
   row.missingObservations=Math.min(99,row.missingObservations+1);
  }
 }
 function hit(data){
  expire();
  if(!bot.running||data?.actor!==me.name||!(data.damage>0)||
     !cleanName(data.target))return;
  const entity=bot.entity?.(data.target),scope=scoped(entity);
  if(!scope||!same(scope,location(realm,p.c)))return;
  hits.set(data.target,{at:now(),monster:entity.mtype,...scope,
   x:entity.x,y:entity.y});
  if(hits.size>MAX_HITS)hits.delete(hits.keys().next().value);
  if(data.kill===true)credit(data.target);
 }
 function credit(id){
  expire();
  const hit=hits.get(id);if(!hit||now()-hit.at>MAX_HIT_MS||
     !same(hit,location(realm,p.c)))return false;
  const time=now();
  const old=rows.get(id);
  // An event without a prior local, real monster sighting cannot certify a
  // kill. This prevents other-character and cross-realm death attribution.
  if(!old||old.monster!==hit.monster||!same(old,hit)||
     time-old.lastSeenAt>MAX_HIT_MS)return false;
  const row={...old,killedAt:time,lastMissingAt:null,missingObservations:0};
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
 function status(){
  expire();
  const time=now(),where=location(realm,p.c);
  return {version:1,mode:'passive-observation-only',executable:false,
   predictionAuthorized:false,realm,owner:me.name,
   persistence:persisted?'best-effort':'unconfirmed',
   rows:[...rows.values()].filter(r=>same(r,where)).slice(-MAX_ROWS)
    .map(r=>({id:r.id,monster:r.monster,map:r.map,in:r.in,
     x:r.x,y:r.y,lastSeenAt:r.lastSeenAt,killedAt:r.killedAt,
     state:r.killedAt?'own-kill-observed':
      r.lastMissingAt?'not-currently-visible':'visible-last-sampled',
     lastMissingAt:r.lastMissingAt,missingObservations:r.missingObservations,
     ageMs:Math.max(0,time-r.lastSeenAt),respawnAt:null}))};
 }
 return {sample,hit,death,status,close(){hits.clear();}};
}
