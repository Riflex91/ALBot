// W12/N12/G06/G07: evidence from the OFFICIAL cave_info() visit response
// and from the character's server-published cave snapshot. This adapter is
// read-only: a visit, vote, reset clock or resumed session is NOT permission
// to enter, vote, spend currencies, leave, or route through generated maps.
const hexRun=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const safeTime=n=>Number.isSafeInteger(n)&&n>0;
const amount=n=>Number.isSafeInteger(n)&&n>=0;
const label=s=>typeof s==='string'&&s.length>0&&s.length<=100;

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
     typeof m.left!=='boolean'||typeof m.disconnected!=='boolean')
   return null;
  names.add(m.name);
  roster.push({name:m.name,left:m.left,disconnected:m.disconnected});
 }
 if(!names.has(name)||roster.find(m=>m.name===name)?.left)return null;
 let choice=null;
 if(raw.choice!==undefined&&raw.choice!==null){
  const c=raw.choice;
  if(!c||typeof c!=='object'||!label(c.id)||
     typeof c.resolved!=='boolean'||!Array.isArray(c.options)||
     c.options.length>16)return null;
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
  choice={id:c.id,resolved:c.resolved,options};
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
 const invalidate=()=>{
  const r=p.realm(),s=bot.session;
  if(r===realm&&s===session)return;
  realm=r;session=s;generation++;
  visit=null;visitAt=0;requestedAt=0;pending=false;error=null;
  lastRun=null;lastRunAt=0;
 };
 function sample(){
  invalidate();
  if(closed||!bot.running)return;
  const current=verifiedCaveSnapshot(p.c?.cave,{
   name:me.name,map:p.c?.map,now:now()});
  if(current){lastRun=current;lastRunAt=now();}
 }
 function refreshVisit(){
  invalidate();
  const at=now();
  // No automatic cave API polling: callers explicitly opt into a bounded
  // read. An unresolved call is NOT retried or assumed to have failed.
  if(closed||!bot.running||pending||
     !Number.isSafeInteger(at)||at<=0||
     requestedAt&&at-requestedAt<60000||
     typeof p.has!=='function'||p.has('cave_info')!==true||
     typeof p.call!=='function')return false;
  const token=++generation;
  requestedAt=at;pending=true;error=null;
  let answer;
  try{answer=p.call('cave_info');}
  catch{pending=false;error='request-failed';return false;}
  Promise.resolve(answer).then(data=>{
   if(!validContext()||token!==generation)return;
   pending=false;
   const result=verifiedCaveVisit(data,{now:now()});
   if(!result){error='invalid-or-stale-visit';return;}
   visit=result;visitAt=now();error=null;
  },()=>{
   if(validContext()&&token===generation){
    pending=false;error='request-failed';
   }
  });
  return true;
 }
 function status(){
  invalidate();
  const time=now(),fresh=visit&&time-visitAt<=120000&&
   time>=visitAt&&validContext();
  const live=bot.running?verifiedCaveSnapshot(p.c?.cave,{
   name:me.name,map:p.c?.map,now:time}):null;
  if(live){lastRun=live;lastRunAt=time;}
  return {version:1,mode:'read-only-cave-evidence',executable:false,
   canEnter:false,canResume:false,canVote:false,canExit:false,
   realm,session,
   visit:fresh?{...visit,observedAt:visitAt}:null,
   visitPending:pending,visitError:error,
   live:live?{...live,observedAt:time}:null,
   lastObservedRun:lastRun?{run:lastRun.run,floor:lastRun.floor,
    observedAt:lastRunAt,confirmedExited:false}:null,
   reason:live?'observed-current-instance':
    lastRun?'no-current-instance-proof':'no-current-instance-proof'};
 }
 return {sample,refreshVisit,status,close(){
  closed=true;generation++;pending=false;
 }};
}
