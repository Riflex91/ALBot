// W12/N12: durable, fail-closed Cave entry lifecycle. This module DOES NOT
// call cave_enter. Persistence must precede any future irreversible RPC,
// whose unknown outcome must never be automatically replayed.
const caveLifecycleHex=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveLifecycleText=(s,max=100)=>typeof s==='string'&&s.length>0&&s.length<=max;
const caveLifecycleTime=n=>Number.isSafeInteger(n)&&n>0;
const caveLifecyclePhase=new Set(['prepared','dispatch-unknown','observed-run']);

export function validCaveLifecycleRecord(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||x.version!==1||
  !caveLifecycleText(x.name)||!caveLifecycleText(x.realm,24)||
  !caveLifecycleText(x.session,120)||!caveLifecycleTime(x.createdAt)||
  !caveLifecyclePhase.has(x.phase)||!['new','resume'].includes(x.mode)||
  !Array.isArray(x.party)||x.party.length<1||x.party.length>3||
  x.party.some(n=>!caveLifecycleText(n))||
  new Set(x.party).size!==x.party.length||!x.party.includes(x.name)||
  (x.mode==='new'?x.run!==null:!caveLifecycleHex(x.run)))
  return false;
 if(x.phase==='prepared')return x.dispatchAt===null&&x.observed===null;
 if(x.phase==='dispatch-unknown')
  return caveLifecycleTime(x.dispatchAt)&&x.dispatchAt>=x.createdAt&&
   x.observed===null;
 // An observed live run need not have been caused by OUR prepared intent.
 // Preserve null dispatchAt until an actual cave_enter send is journaled.
 if(x.dispatchAt!==null&&
    (!caveLifecycleTime(x.dispatchAt)||x.dispatchAt<x.createdAt))
  return false;
 const o=x.observed;
 return !!o&&caveLifecycleHex(o.run)&&
  (x.mode==='new'||x.run===o.run)&&
  Number.isSafeInteger(o.floor)&&o.floor>=0&&o.floor<=7&&
  o.map===`zone_${o.run}_${o.floor}`&&
  caveLifecycleTime(o.at)&&o.at>=x.createdAt;
}

// classify without guessing if the entry was dispatched. A live Cave
// snapshot can prove the actor is currently in a run, not which client call
// caused it. Missing snapshots do not prove an exit or refund.
export function caveLifecycleDisposition(record,{name,realm,live}={}){
 if(record===null||record===undefined)
  return {state:'empty',blocked:false,reason:'no-journal'};
 if(!validCaveLifecycleRecord(record))
  return {state:'corrupt',blocked:true,reason:'invalid-durable-record'};
 if(record.name!==name||record.realm!==realm)
  return {state:'scope-mismatch',blocked:true,reason:'owner-or-realm-changed'};
 if(live&&caveLifecycleHex(live.run)&&
  Number.isSafeInteger(live.floor)&&live.floor>=0&&live.floor<=7&&
  live.map===`zone_${live.run}_${live.floor}`){
  if(record.mode==='resume'&&live.run!==record.run)
   return {state:'conflict',blocked:true,reason:'resume-run-mismatch'};
  if(record.phase==='observed-run'&&live.run!==record.observed.run)
   return {state:'conflict',blocked:true,reason:'observed-run-mismatch'};
  return {state:'live-observed',blocked:true,reason:'current-server-run',
   run:live.run};
 }
 if(record.phase==='observed-run')
  return {state:'run-not-currently-visible',blocked:true,
   reason:'exit-not-proven',run:record.observed.run};
 return {state:record.phase,blocked:true,reason:record.phase==='prepared'?
  'prepared-not-dispatched':'dispatch-outcome-unknown',
  run:record.run};
}

export function createCaveLifecycle(bot,{now=()=>Date.now()}={}){
 const {p,me}=bot;
 const key='albot:cave-lifecycle:'+me.name;
 let readFailed=false,writeFailed=false,closed=false;
 let record=null;
 try{const value=p.read(key);if(value!==null&&value!==undefined)
   record=value;}catch{readFailed=true;}
 const clone=x=>JSON.parse(JSON.stringify(x));
 const live=()=>bot.cave?.status?.()?.live??null;
 function status(){
  if(readFailed||writeFailed)return {version:1,blocked:true,
   state:'storage-uncertain',reason:readFailed?'journal-read-failed':'journal-write-failed',
   journal:validCaveLifecycleRecord(record)?clone(record):null,
   executable:false};
  const decision=caveLifecycleDisposition(record,{
   name:me.name,realm:p.realm(),live:live()});
  return {version:1,...decision,
   journal:validCaveLifecycleRecord(record)?clone(record):null,
   executable:false};
 }
 function durable(next){
  if(closed||readFailed||writeFailed)return false;
  try{
   if(p.write(key,next)!==true){writeFailed=true;return false;}
   const saved=p.read(key);
   if(JSON.stringify(saved)!==JSON.stringify(next)){
    writeFailed=true;return false;
   }
   record=next?clone(next):null;
   return true;
  }catch{writeFailed=true;return false;}
 }
 function prepare(){
  if(closed||!bot.running||status().blocked)return false;
  const preflight=bot.cave?.status?.()?.entryPreflight;
  const at=now();
  if(!caveLifecycleTime(at)||!preflight||
   preflight.localConditionsMet!==true||
   preflight.requiresJournal!==true||
   preflight.executable!==false||
   preflight.serverVerified!==false||
   !['new','resume'].includes(preflight.mode)||
   !Array.isArray(preflight.party)||
   !caveLifecycleText(bot.session,120)||
   (preflight.mode==='resume'?!caveLifecycleHex(preflight.run):
    preflight.run!==null))return false;
  const next={version:1,name:me.name,realm:p.realm(),session:bot.session,
   createdAt:at,mode:preflight.mode,run:preflight.run,
   party:[...preflight.party],phase:'prepared',
   dispatchAt:null,observed:null};
  return validCaveLifecycleRecord(next)&&durable(next);
 }
 // Future executor integration only: MUST durably write BEFORE a single
 // cave_enter RPC. The current runtime deliberately NEVER calls this method.
 function markDispatchUnknown(){
  if(closed||!bot.running||writeFailed||readFailed||
   !validCaveLifecycleRecord(record)||record.phase!=='prepared'||
   record.session!==bot.session||record.realm!==p.realm()||
   !bot.cave?.status?.()?.entryPreflight?.localConditionsMet)return false;
  const at=now();
  if(!caveLifecycleTime(at)||at<record.createdAt)return false;
  return durable({...record,phase:'dispatch-unknown',dispatchAt:at});
 }
 function sample(){
  if(closed||readFailed||writeFailed||
   !validCaveLifecycleRecord(record)||record.realm!==p.realm()||
   record.name!==me.name||record.phase==='observed-run')return;
  const observed=live(),at=now();
  if(!observed||!caveLifecycleHex(observed.run)||
   (record.mode==='resume'&&record.run!==observed.run)||
   !caveLifecycleTime(at)||at<record.createdAt)return;
  // Prepared may not have dispatched: only claim the actual server run
  // was observed, never that this particular intent caused it.
  const next={...record,phase:'observed-run',
   dispatchAt:record.dispatchAt,
   observed:{run:observed.run,floor:observed.floor,
    map:observed.map,at}};
  if(validCaveLifecycleRecord(next))durable(next);
 }
 // It is safe to discard ONLY an un-dispatched intent from the current
 // session, with no cave currently observed. Unknown send/exit states
 // are never cleared by an untrusted clock or a missing map.
 function discardPrepared(){
  if(closed||!bot.running||readFailed||writeFailed||
   !validCaveLifecycleRecord(record)||record.phase!=='prepared'||
   record.session!==bot.session||record.realm!==p.realm()||
   live()!==null)return false;
  return durable(null);
 }
 return {prepare,markDispatchUnknown,sample,discardPrepared,status,
  close(){closed=true;}};
}
