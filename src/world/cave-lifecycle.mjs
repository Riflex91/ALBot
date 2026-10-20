// W12/N12: durable, fail-closed Cave entry lifecycle. This module DOES NOT
// call cave_enter. Persistence must precede any future irreversible RPC,
// whose unknown outcome must never be automatically replayed.
const caveLifecycleHex=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveLifecycleText=(s,max=100)=>typeof s==='string'&&s.length>0&&s.length<=max;
const caveLifecycleTime=n=>Number.isSafeInteger(n)&&n>0;
const caveLifecyclePhase=new Set(['prepared','dispatch-unknown','observed-run','exit-dispatch-unknown']);

export function validCaveLifecycleRecord(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||x.version!==1||
  !caveLifecycleText(x.name)||!caveLifecycleText(x.realm,24)||
  !caveLifecycleText(x.session,120)||!caveLifecycleTime(x.createdAt)||
  !caveLifecyclePhase.has(x.phase)||!['new','resume','observed'].includes(x.mode)||
  !Array.isArray(x.party)||x.party.length<1||x.party.length>3||
  x.party.some(n=>!caveLifecycleText(n))||
  new Set(x.party).size!==x.party.length||!x.party.includes(x.name)||
  (x.mode==='new'?x.run!==null:!caveLifecycleHex(x.run))||
  (x.mode==='observed'&&x.phase!=='observed-run'))
  return false;
 if(x.serverReply!==undefined&&x.serverReply!==null){
  const reply=x.serverReply;
  if(x.phase==='prepared'||!caveLifecycleTime(x.dispatchAt)||
     !reply||!caveLifecycleHex(reply.run)||
     (x.mode==='resume'&&reply.run!==x.run)||
     !caveLifecycleTime(reply.at)||reply.at<x.dispatchAt||
     !caveLifecycleTime(reply.expires)||reply.expires<=x.dispatchAt||
     !Number.isSafeInteger(reply.level)||reply.level<1||reply.level>999)
   return false;
 }
 if(x.phase==='prepared')return x.dispatchAt===null&&x.observed===null&&
  (x.serverReply===undefined||x.serverReply===null);
 if(x.phase==='dispatch-unknown')
  return caveLifecycleTime(x.dispatchAt)&&x.dispatchAt>=x.createdAt&&
   x.observed===null;
 if(x.phase==='exit-dispatch-unknown'&&
    (!caveLifecycleTime(x.exitAt)||!caveLifecycleText(x.exitSession,120)||
     !caveLifecycleHex(x.exitRun)||!x.observed||
     x.exitRun!==x.observed.run||x.exitAt<x.observed.at))
  return false;
 if(x.exitReply!==undefined&&x.exitReply!==null){
  const reply=x.exitReply;
  if(x.phase!=='exit-dispatch-unknown'||reply.exited!==true||
     !caveLifecycleTime(reply.at)||reply.at<x.exitAt)
   return false;
 }
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
 if(record.phase==='exit-dispatch-unknown'){
  if(live?.run&&live.run!==record.exitRun)
   return {state:'conflict',blocked:true,reason:'exit-run-mismatch'};
  return {state:record.exitReply?'exit-reply-observed':'exit-outcome-unknown',
   blocked:true,reason:record.exitReply?
    'await-fresh-post-exit-info':'exit-outcome-unknown',run:record.exitRun};
 }
 if(live&&caveLifecycleHex(live.run)&&
  Number.isSafeInteger(live.floor)&&live.floor>=0&&live.floor<=7&&
  live.map===`zone_${live.run}_${live.floor}`){
  if(record.mode==='resume'&&live.run!==record.run)
   return {state:'conflict',blocked:true,reason:'resume-run-mismatch'};
  if(record.serverReply&&live.run!==record.serverReply.run)
   return {state:'conflict',blocked:true,reason:'server-reply-run-mismatch'};
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
 // Only strict reads may prove a Cave attempt absent. The general
 // compatibility get() deliberately converts corrupt storage into null.
 const readJournal=()=>{
  if(typeof p.readCaveJournal!=='function')
   throw Error('Strict Cave journal reader unavailable');
  return p.readCaveJournal(key);
 };
 let record=null;
 try{const value=readJournal();if(value!==null&&value!==undefined)
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
   // Detect a second runner updating the same durable slot. This is not
   // a distributed CAS, but never knowingly overwrite a changed journal.
   const current=readJournal();
   if(JSON.stringify(current??null)!==JSON.stringify(record)){
    writeFailed=true;return false;
   }
   if(p.write(key,next)!==true){writeFailed=true;return false;}
   const saved=readJournal();
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
 // The official cave_enter() Promise may resolve before an actual map
 // change. A positive response is a distinct durable server reply; it does
 // NOT prove that a character was transported, and never clears the journal.
 function noteServerReply(reply){
  if(closed||readFailed||writeFailed||!bot.running||
   !validCaveLifecycleRecord(record)||
   !['dispatch-unknown','observed-run'].includes(record.phase)||
   !caveLifecycleTime(record.dispatchAt)||
   record.name!==me.name||record.realm!==p.realm()||
   record.session!==bot.session||record.serverReply)return false;
  if(!reply||typeof reply!=='object'||
   reply.success!==true||reply.failed===true||
   (reply.place!==undefined&&reply.place!=='enter')||
   !caveLifecycleHex(reply.run)||
   (record.mode==='resume'&&reply.run!==record.run)||
   !caveLifecycleTime(reply.expires)||
   reply.expires<=record.dispatchAt||
   !Number.isSafeInteger(reply.level)||reply.level<1||reply.level>999)return false;
  const at=now();
  if(!caveLifecycleTime(at)||at<record.dispatchAt)return false;
  const next={...record,serverReply:{run:reply.run,
   expires:reply.expires,level:reply.level,at}};
  return validCaveLifecycleRecord(next)&&durable(next);
 }
 // Explicit one-shot send only. No scheduler calls this. The value action
 // occupies Executor resources, consumes ordinary action-admission budget
 // and cannot be retried after its dispatch-unknown record is committed.
 function requestEntry(){
  if(closed||!bot.running||readFailed||writeFailed||
   typeof bot.exec?.dispatch!=='function'||
   typeof p.has!=='function'||typeof p.call!=='function')return false;
  const guard=()=>{
   if(bot.journal||bot.inventoryBlocked||
      bot.bank?.pending||bot.logistics?.reserved||
      bot.teamTravel?.blocked||bot.lifecycleChanging||
      bot.account?.rotationPending?.()||
      bot.exec?.pending?.size>0)return false;
   const state=status(),preflight=bot.cave?.status?.()?.entryPreflight;
   if(state.state!=='prepared'||!state.blocked||
      !validCaveLifecycleRecord(record)||
      record.phase!=='prepared'||record.session!==bot.session||
      record.realm!==p.realm()||
      !preflight||preflight.localConditionsMet!==true||
      preflight.requiresJournal!==true||
      preflight.executable!==false||preflight.serverVerified!==false||
      preflight.mode!==record.mode||
      preflight.run!==record.run||
      !Array.isArray(preflight.party)||
      preflight.party.length!==record.party.length||
      preflight.party.some((n,i)=>n!==record.party[i])||
      bot.cave?.status?.()?.live)return false;
   return true;
  };
  if(!guard())return false;
  try{if(p.has('cave_enter')!==true)return false;}catch{return false;}
  const mode=record.mode,expectedRun=record.run;
  return bot.exec.dispatch('cave.enter.once',
   ['lifecycle','movement','account'],guard,
   ()=>{
    // This durable write is the irreversible point. Even if p.call throws,
    // the request may have reached the server and its outcome is unknown.
    if(!markDispatchUnknown())throw Error('Cave dispatch not durably journaled');
    const response=p.call('cave_enter');
    return Promise.resolve(response).then(result=>{
     noteServerReply(result);
     return result;
    });
   },{value:true,timeout:25000,delay:1000,
    observe:()=>{
     const active=bot.cave?.status?.()?.live;
     return !!active&&caveLifecycleHex(active.run)&&
      (mode==='new'||active.run===expectedRun);
    }});
 }
 // Cave exit is a distinct irreversible RPC. A physical outside map or
 // disconnect alone never clears a run or its admission history.
 function markExitUnknown(){
  if(closed||!bot.running||readFailed||writeFailed||
     !validCaveLifecycleRecord(record)||record.phase!=='observed-run'||
     record.realm!==p.realm()||record.name!==me.name)return false;
  const observed=live(),at=now();
  if(!observed||observed.run!==record.observed.run||
     !caveLifecycleTime(at)||at<record.observed.at)return false;
  return durable({...record,phase:'exit-dispatch-unknown',
   exitAt:at,exitSession:bot.session,exitRun:observed.run,
   exitReply:null});
 }
 function noteExitReply(response){
  if(closed||!bot.running||readFailed||writeFailed||
     !validCaveLifecycleRecord(record)||
     record.phase!=='exit-dispatch-unknown'||
     record.name!==me.name||record.realm!==p.realm()||
     record.exitSession!==bot.session||record.exitReply||
     !response||typeof response!=='object'||Array.isArray(response)||
     response.exited!==true)return false;
  const at=now();
  if(!caveLifecycleTime(at)||at<record.exitAt)return false;
  return durable({...record,exitReply:{exited:true,at}});
 }
 function requestExit(){
  if(closed||!bot.running||readFailed||writeFailed||
     typeof bot.exec?.dispatch!=='function'||
     typeof p.has!=='function'||typeof p.call!=='function')return false;
  const guard=()=>{
   if(bot.journal||bot.inventoryBlocked||
      bot.bank?.pending||bot.logistics?.reserved||
      bot.teamTravel?.blocked||bot.lifecycleChanging||
      bot.account?.rotationPending?.()||
      bot.exec?.pending?.size>0)return false;
   const state=status(),inside=live();
   return state.state==='live-observed'&&state.blocked&&
    validCaveLifecycleRecord(record)&&
    record.phase==='observed-run'&&
    record.realm===p.realm()&&record.name===me.name&&
    inside?.run===record.observed.run&&
    p.c?.map===inside.map;
  };
  if(!guard())return false;
  try{if(p.has('cave_exit')!==true)return false;}catch{return false;}
  const expected=record.observed.run;
  return bot.exec.dispatch('cave.exit.once',
   ['lifecycle','movement','account'],guard,()=>{
    if(!markExitUnknown())throw Error('Cave exit dispatch not durably journaled');
    return Promise.resolve(p.call('cave_exit')).then(result=>{
     noteExitReply(result);return result;
    });
   },{value:true,timeout:25000,delay:1000,observe:()=>false});
 }
 // Clearing is a separate EXPLICIT decision, never an executor success
 // callback. It requires a positive exit RPC result plus an independently
 // refreshed cave_info reply AFTER that acknowledgement. We do not infer
 // exit from a missing local cave state, paused clock or disconnect.
 function confirmExit(){
  if(closed||!bot.running||readFailed||writeFailed||
     !validCaveLifecycleRecord(record)||
     record.phase!=='exit-dispatch-unknown'||
     record.realm!==p.realm()||record.name!==me.name||
     !record.exitReply||record.exitSession!==bot.session||
     bot.exec?.pending?.size>0||
     bot.journal||bot.inventoryBlocked)return false;
  const state=bot.cave?.status?.(),v=state?.visit;
  const at=now();
  if(!caveLifecycleTime(at)||!v||
     v.resume!==null||typeof v.available!=='boolean'||
     !caveLifecycleTime(v.observedAt)||
     !caveLifecycleTime(v.serverTime)||
     v.observedAt<=record.exitReply.at||
     v.serverTime<record.exitReply.at||
     v.observedAt>at||at-v.observedAt>30000||
     state.live||p.c?.map!=='main'||
     p.c?.cave!==null&&p.c?.cave!==undefined||
     p.c?.in!==undefined&&p.c.in!=='main')return false;
  return durable(null);
 }
 function sample(){
  if(closed||readFailed||writeFailed)return;
  const observed=live(),at=now();
  if(!observed||!caveLifecycleHex(observed.run)||
   !caveLifecycleTime(at))return;
  if(record===null){
   // A run that predates this software must survive a restart too. Its
   // server snapshot is direct evidence of the run, NOT cave_enter success
   // or permission to spend the account's next daily admission.
   const party=observed.roster?.map(m=>m.name);
   const next={version:1,name:me.name,realm:p.realm(),
    session:bot.session,createdAt:at,mode:'observed',
    run:observed.run,party,phase:'observed-run',
    dispatchAt:null,observed:{run:observed.run,floor:observed.floor,
     map:observed.map,at}};
   if(validCaveLifecycleRecord(next))durable(next);
   return;
  }
  if(!validCaveLifecycleRecord(record)||record.realm!==p.realm()||
   record.name!==me.name||record.phase==='observed-run'||
   (record.mode==='resume'&&record.run!==observed.run)||
   (record.serverReply&&record.serverReply.run!==observed.run)||
   at<record.createdAt)return;
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
 return {prepare,markDispatchUnknown,requestEntry,requestExit,
  confirmExit,sample,discardPrepared,status,close(){closed=true;}};
}
