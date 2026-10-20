import {caveEntryPreflight,cavePartyObservation} from './cave-admission.mjs';

// W12/N12/G06/G07: evidence from the OFFICIAL cave_info() visit response
// and from the character's server-published cave snapshot. This adapter is
// read-only: a visit, vote, reset clock or resumed session is NOT permission
// to enter, vote, spend currencies, leave, or route through generated maps.
const hexRun=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const safeTime=n=>Number.isSafeInteger(n)&&n>0;
const amount=n=>Number.isSafeInteger(n)&&n>=0;
const label=s=>typeof s==='string'&&s.length>0&&s.length<=100;
// A cave_info response is only a read. The server RPC can remain unresolved;
// do not mistake an indefinitely pending request for a valid admission.
const VISIT_REQUEST_TIMEOUT_MS=15000;
const VISIT_REQUEST_COOLDOWN_MS=60000;
const VISIT_EVIDENCE_TTL_MS=120000;

export function verifiedCaveVisit(raw,{now=Date.now()}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    typeof raw.available!=='boolean'||!safeTime(raw.server_time)||
    !safeTime(raw.resets)||!label(raw.home)||
    !safeTime(now)||Math.abs(now-raw.server_time)>300000||
    raw.resets<=raw.server_time||raw.resets-raw.server_time>172800000)
  return null;
 let resume=null;
 if(raw.resume!==undefined&&raw.resume!==null){
  const r=raw.resume;
  if(!r||typeof r!=='object'||Array.isArray(r)||
     !hexRun(r.run)||!label(r.server)||r.server.length>32||
     (r.remaining_ms!==undefined&&
      (!amount(r.remaining_ms)||r.remaining_ms>86400000)))return null;
  resume={run:r.run,server:r.server,
   remainingMs:r.remaining_ms??null};
 }
 return {available:raw.available,home:raw.home,
  resetsAt:raw.resets,serverTime:raw.server_time,resume};
}

export function verifiedCaveSnapshot(raw,{name,map,now=Date.now()}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    !hexRun(raw.run)||!Number.isSafeInteger(raw.floor)||
    raw.floor<0||raw.floor>7||
    !label(name)||map!==`zone_${raw.run}_${raw.floor}`||
    !safeTime(raw.server_time)||!safeTime(now)||
    Math.abs(now-raw.server_time)>300000||
    !amount(raw.remaining_ms)||raw.remaining_ms>86400000||
    typeof raw.paused!=='boolean'||!amount(raw.gold)||
    !amount(raw.amber)||!Array.isArray(raw.roster)||
    raw.roster.length<1||raw.roster.length>3)return null;
 const names=new Set(),roster=[];
 for(const m of raw.roster){
  if(!m||!label(m.name)||names.has(m.name)||
     (m.left!==undefined&&typeof m.left!=='boolean')||
     typeof m.disconnected!=='boolean')
   return null;
  names.add(m.name);
  roster.push({name:m.name,left:m.left===true,disconnected:m.disconnected});
 }
 if(!names.has(name)||roster.find(m=>m.name===name)?.left)return null;
 let choice=null;
 if(raw.choice!==undefined&&raw.choice!==null){
  const c=raw.choice;
  if(!c||typeof c!=='object'||!label(c.id)||
     typeof c.resolved!=='boolean'||!Array.isArray(c.options)||
     c.options.length>16||
     (c.danger!==undefined&&typeof c.danger!=='boolean')||
     (c.kind!==undefined&&c.kind!==null&&!label(c.kind)))return null;
  const ids=new Set(),options=[];
  for(const o of c.options){
   if(!o||!label(o.id)||ids.has(o.id)||
      !amount(o.cost)||!amount(o.amber)||
      (o.unavailable!==null&&o.unavailable!==undefined&&
       typeof o.unavailable!=='string'))return null;
   ids.add(o.id);
   options.push({id:o.id,goldCost:o.cost,amberCost:o.amber,
    available:o.unavailable===null||o.unavailable===undefined});
  }
  // Earlier clients omitted these fields. Keep their snapshots usable
  // for reading a Cave run, but NEVER claim that their vote is actionable.
  // Current server snapshots provide both an absolute deadline and votes
  // indexed by original party-member names.
  let deadline=null,votes=null;
  if(c.deadline!==undefined&&c.deadline!==null){
   if(!safeTime(c.deadline))return null;
   deadline=c.deadline;
  }
  if(c.votes!==undefined&&c.votes!==null){
   if(typeof c.votes!=='object'||Array.isArray(c.votes))return null;
   const entries=Object.entries(c.votes);
   for(const [voter,id] of entries){
    if(!names.has(voter)||!label(id)||!ids.has(id))return null;
   }
   // Preserve original server vote keys without the __proto__ setter
   // semantics of assigning arbitrary player names into {}.
   votes=Object.fromEntries(entries);
  }
  // Official cave_snapshot() derives 'danger' from its encounter group.
  // FALSE is only an absence of this flag, not a proof of safety.
  choice={id:c.id,resolved:c.resolved,options,deadline,votes,
   danger:c.danger??null,kind:c.kind??null};
 }
 return {run:raw.run,floor:raw.floor,map,
  serverTime:raw.server_time,remainingMs:raw.remaining_ms,
  paused:raw.paused,gold:raw.gold,amber:raw.amber,roster,choice};
}

export function createCaveEvidence(bot,{now=()=>Date.now()}={}){
 const {p,me}=bot;
 let realm=p.realm(),session=bot.session,generation=0,closed=false;
 let visit=null,visitAt=0,requestedAt=0,pending=false,error=null;
 let lastRun=null,lastRunAt=0;
 const validContext=()=>!closed&&realm===p.realm()&&
  session===bot.session;
 // Polling the local clock is read-only. Retire timed-out request tokens
 // both on status/sample and on a late Promise resolution: no timer, no
 // automatic retry and no old admission evidence can be resurrected.
 function expirePending(at=now()){
  if(!pending)return false;
  if(!safeTime(at)||at<requestedAt||
     at-requestedAt>=VISIT_REQUEST_TIMEOUT_MS){
   pending=false;generation++;visit=null;visitAt=0;
   error='request-timeout';
   return true;
  }
  return false;
 }
 const invalidate=()=>{
  const r=p.realm(),s=bot.session;
  if(r===realm&&s===session)return;
  realm=r;session=s;generation++;
  visit=null;visitAt=0;requestedAt=0;pending=false;error=null;
  lastRun=null;lastRunAt=0;
 };
 function sample(){
  invalidate();expirePending();
  if(closed||!bot.running)return;
  const current=verifiedCaveSnapshot(p.c?.cave,{
   name:me.name,map:p.c?.map,now:now()});
  if(current){lastRun=current;lastRunAt=now();}
 }
 function refreshVisit(){
  invalidate();
  const at=now();expirePending(at);
  // No automatic cave API polling: only an explicit request, no retry
  // even after a timeout. An unresolved old request consumes its 60s
  // cooldown and its eventual reply remains invalidated.
  if(closed||!bot.running||pending||
     !safeTime(at)||
     requestedAt&&at-requestedAt<VISIT_REQUEST_COOLDOWN_MS||
     typeof p.has!=='function'||typeof p.call!=='function')return false;
  try{if(p.has('cave_info')!==true)return false;}
  catch{return false;}
  const token=++generation;
  requestedAt=at;pending=true;error=null;
  // A fresh query invalidates even a previously successful but possibly
  // changed available/resume reading. Failures must not reveal old rights.
  visit=null;visitAt=0;
  let answer;
  try{answer=p.call('cave_info');}
  catch{pending=false;error='request-failed';return false;}
  Promise.resolve(answer).then(data=>{
   if(!validContext()||token!==generation)return;
   if(expirePending()||token!==generation)return;
   pending=false;
   const result=verifiedCaveVisit(data,{now:now()});
   if(!result){error='invalid-or-stale-visit';return;}
   visit=result;visitAt=now();error=null;
  },()=>{
   if(!validContext()||token!==generation)return;
   if(expirePending()||token!==generation)return;
   pending=false;error='request-failed';
  });
  return true;
 }
 function status(){
  invalidate();expirePending();
  const time=now(),fresh=bot.running&&visit&&time-visitAt<=VISIT_EVIDENCE_TTL_MS&&
   time>=visitAt&&validContext();
  const live=bot.running?verifiedCaveSnapshot(p.c?.cave,{
   name:me.name,map:p.c?.map,now:time}):null;
  if(live){lastRun=live;lastRunAt=time;}
  const currentVisit=fresh?{...visit,observedAt:visitAt}:null;
  const observedParty=cavePartyObservation({
   name:me.name,party:p.c?.party,partyMap:p.parent?.party});
  const names=observedParty.verified?observedParty.names:null;
  const localMembers=(names??[me.name]).map(n=>
   n===me.name?p.c:bot.entity?.(n)).filter(Boolean);
  const entryPreflight=caveEntryPreflight({
   visit:currentVisit,realm,name:me.name,actor:p.c,
   partyNames:names,members:localMembers,
   allowedNames:bot.teamNames,priorRun:lastRun,now:time});
  return {version:1,mode:'read-only-cave-evidence',executable:false,
   canEnter:false,canResume:false,canVote:false,canExit:false,
   realm,session,entryPreflight,
   visit:currentVisit,
   visitPending:pending,visitError:error,
   live:live?{...live,observedAt:time}:null,
   lastObservedRun:lastRun?{run:lastRun.run,floor:lastRun.floor,
    observedAt:lastRunAt,confirmedExited:false}:null,
   reason:live?'observed-current-instance':
    lastRun?'no-current-instance-proof':'no-current-instance-proof'};
 }
 // Only the durable Cave lifecycle may call this AFTER proving a positive
 // exit response plus newer no-resume cave_info, and AFTER it has cleared
 // the durable journal. The caller supplies the exact exited run ID.
 function acknowledgeConfirmedExit(run){
  invalidate();
  if(closed||!bot.running||!hexRun(run)||
     verifiedCaveSnapshot(p.c?.cave,{
      name:me.name,map:p.c?.map,now:now()}))return false;
  if(lastRun&&lastRun.run!==run)return false;
  lastRun=null;lastRunAt=0;
  return true;
 }
 return {sample,refreshVisit,status,acknowledgeConfirmedExit,close(){
  closed=true;generation++;pending=false;
 }};
}
