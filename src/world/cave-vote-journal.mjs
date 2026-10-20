// W12/N12: an explicitly requested Cave vote is an irreversible
// single-shot server mutation. Durable intent and read-after-write come
// BEFORE cave_reply(). No automatic voting, retry, or journal erasure.
const caveVoteJournalLabel=s=>typeof s==='string'&&s.length>0&&s.length<=100;
const caveVoteJournalRun=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveVoteJournalTime=n=>Number.isSafeInteger(n)&&n>0;
const caveVoteJournalPhase=new Set(['prepared','dispatch-unknown','vote-observed']);

export function validCaveVoteRecord(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||x.version!==1||
    !caveVoteJournalLabel(x.name)||!caveVoteJournalLabel(x.realm)||
    !caveVoteJournalLabel(x.session)||!caveVoteJournalRun(x.run)||
    !caveVoteJournalLabel(x.choiceId)||
    !caveVoteJournalLabel(x.optionId)||!caveVoteJournalTime(x.createdAt)||
    !caveVoteJournalTime(x.deadline)||x.deadline<=x.createdAt||
    !caveVoteJournalPhase.has(x.phase)||
    !Array.isArray(x.history)||x.history.length>64||
    new Set(x.history.map(h=>h?.choiceId)).size!==x.history.length||
    x.history.some(h=>!h||!caveVoteJournalLabel(h.choiceId)||
     !caveVoteJournalLabel(h.optionId)||!caveVoteJournalTime(h.at))||
    x.history.some(h=>h.choiceId===x.choiceId))return false;
 if(x.phase==='prepared')
  return x.dispatchAt===null&&x.reply===null&&x.observedAt===null;
 if(!caveVoteJournalTime(x.dispatchAt)||x.dispatchAt<x.createdAt||
    x.dispatchAt>=x.deadline)return false;
 if(x.reply!==null&&x.reply!==undefined){
  if(!x.reply||x.reply.choice!==x.choiceId||
     x.reply.vote!==x.optionId||
     typeof x.reply.resolved!=='boolean'||
     !caveVoteJournalTime(x.reply.at)||x.reply.at<x.dispatchAt)
   return false;
 }
 if(x.phase==='dispatch-unknown')return x.observedAt===null;
 return caveVoteJournalTime(x.observedAt)&&
  x.observedAt>=x.dispatchAt;
}

export function createCaveVoteJournal(bot,{now=()=>Date.now()}={}){
 const {p,me}=bot,key='albot:cave-vote:'+me.name;
 let record=null,readFailed=false,writeFailed=false,closed=false;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const read=()=>{
  if(typeof p.readCaveJournal!=='function')
   throw Error('Strict Cave vote journal reader unavailable');
  return p.readCaveJournal(key);
 };
 try{
  const saved=read();
  if(saved!==null&&saved!==undefined)record=saved;
 }catch{readFailed=true;}
 function durable(next){
  if(closed||readFailed||writeFailed)return false;
  try{
   const current=read();
   if(JSON.stringify(current??null)!==JSON.stringify(record)){
    writeFailed=true;return false;
   }
   if(p.write(key,next)!==true){writeFailed=true;return false;}
   const saved=read();
   if(JSON.stringify(saved)!==JSON.stringify(next)){
    writeFailed=true;return false;
   }
   record=next===null?null:clone(next);
   return true;
  }catch{writeFailed=true;return false;}
 }
 function status(){
  if(readFailed||writeFailed)return {version:1,state:'storage-uncertain',
   blocked:true,reason:readFailed?'read-failed':'write-failed',
   journal:validCaveVoteRecord(record)?clone(record):null,executable:false};
  if(record===null)return {version:1,state:'empty',blocked:false,
   reason:'no-vote-journal',journal:null,executable:false};
  if(!validCaveVoteRecord(record))return {version:1,state:'corrupt',
   blocked:true,reason:'invalid-vote-journal',journal:null,executable:false};
  if(record.name!==me.name||record.realm!==p.realm())
   return {version:1,state:'scope-mismatch',blocked:true,
    reason:'name-or-realm-changed',journal:clone(record),executable:false};
  return {version:1,state:record.phase,blocked:true,
   reason:record.phase==='prepared'?'not-sent':
    record.phase==='dispatch-unknown'?'server-outcome-unknown':'vote-observed',
   journal:clone(record),executable:false};
 }
 function preflight(optionId){
  return bot.caveVote?.preflight?.(optionId)??null;
 }
 function noConflictingWork(){
  return !bot.journal&&!bot.inventoryBlocked&&!bot.bank?.pending&&
   !bot.logistics?.reserved&&!bot.teamTravel?.blocked&&
   !bot.lifecycleChanging&&!bot.account?.rotationPending?.()&&
   !(bot.exec?.pending?.size>0);
 }
 function prepare(optionId){
  if(closed||!bot.running||readFailed||writeFailed||
     !caveVoteJournalLabel(bot.session)||!noConflictingWork())return false;
  const ready=preflight(optionId),at=now();
  if(!caveVoteJournalTime(at)||!ready||
     ready.localConditionsMet!==true||ready.executable!==false||
     ready.canVote!==false||ready.requiresJournal!==true||
     ready.serverVerified!==false||ready.optionId!==optionId||
     !caveVoteJournalRun(ready.run)||!caveVoteJournalLabel(ready.choiceId)||
     !caveVoteJournalTime(ready.deadline)||ready.deadline<=at+2000)return false;
  let history=[];
  if(record!==null){
   if(!validCaveVoteRecord(record)||record.name!==me.name||
      record.realm!==p.realm()||record.run!==ready.run||
      record.phase!=='vote-observed'||
      ready.choiceId===record.choiceId||
      record.history.some(h=>h.choiceId===ready.choiceId)||
      record.history.length>=64)return false;
   history=[...record.history,{choiceId:record.choiceId,
    optionId:record.optionId,at:record.observedAt}];
  }
  const next={version:1,name:me.name,realm:p.realm(),
   session:bot.session,run:ready.run,choiceId:ready.choiceId,
   optionId,createdAt:at,deadline:ready.deadline,
   phase:'prepared',dispatchAt:null,reply:null,observedAt:null,history};
  return validCaveVoteRecord(next)&&durable(next);
 }
 function discardPrepared(){
  if(closed||!bot.running||!validCaveVoteRecord(record)||
     record.phase!=='prepared'||record.session!==bot.session||
     record.realm!==p.realm()||!noConflictingWork())return false;
  // With a prior observed vote, discarding a later prepared choice
  // must retain immutable prior choice receipts, not erase history.
  if(record.history.length)return false;
  return durable(null);
 }
 function markDispatchUnknown(){
  if(closed||!bot.running||!validCaveVoteRecord(record)||
     record.phase!=='prepared'||record.realm!==p.realm()||
     record.session!==bot.session)return false;
  const at=now(),v=preflight(record.optionId);
  if(!caveVoteJournalTime(at)||at>=record.deadline-2000||
     !v||v.localConditionsMet!==true||v.run!==record.run||
     v.choiceId!==record.choiceId||v.optionId!==record.optionId||
     v.deadline!==record.deadline)return false;
  return durable({...record,phase:'dispatch-unknown',dispatchAt:at});
 }
 function noteReply(r){
  if(closed||!bot.running||!validCaveVoteRecord(record)||
     record.phase!=='dispatch-unknown'||record.session!==bot.session||
     record.realm!==p.realm()||record.reply||
     !r||typeof r!=='object'||Array.isArray(r)||
     r.choice!==record.choiceId||r.vote!==record.optionId||
     r.failed===true||r.success===false||
     typeof r.resolved!=='boolean')return false;
  const at=now();
  if(!caveVoteJournalTime(at)||at<record.dispatchAt)return false;
  const next={...record,reply:{choice:r.choice,vote:r.vote,
   resolved:r.resolved,at}};
  return validCaveVoteRecord(next)&&durable(next);
 }
 function sample(){
  if(closed||!bot.running||readFailed||writeFailed||
     !validCaveVoteRecord(record)||record.phase!=='dispatch-unknown'||
     record.realm!==p.realm())return false;
  const cave=bot.cave?.status?.(),v=cave?.live,
   state=bot.caveLifecycle?.status?.(),at=now();
  if(!v||!caveVoteJournalTime(at)||at<record.dispatchAt||
     !caveVoteJournalTime(v.serverTime)||
     v.serverTime<record.dispatchAt||at<v.serverTime||
     at-v.serverTime>3000||v.run!==record.run||
     state?.state!=='live-observed'||
     state?.journal?.phase!=='observed-run'||
     state?.journal?.observed?.run!==record.run||
     v.choice?.id!==record.choiceId||
     v.choice?.votes?.[me.name]!==record.optionId)return false;
  const next={...record,phase:'vote-observed',observedAt:at};
  return validCaveVoteRecord(next)&&durable(next);
 }
 // Called only by the Cave lifecycle AFTER a positively acknowledged
 // exit, fresh post-exit no-resume info and durable lifecycle clearance.
 // An unknown vote from a fully exited run is never retried.
 function completeRun(run){
  if(closed||readFailed||writeFailed||!caveVoteJournalRun(run)||
     record===null)return false;
  if(!validCaveVoteRecord(record)||record.name!==me.name||
     record.realm!==p.realm()||record.run!==run)return false;
  return durable(null);
 }
 function requestVote(){
  if(closed||!bot.running||readFailed||writeFailed||
     typeof bot.exec?.dispatch!=='function'||
     typeof p.has!=='function'||typeof p.call!=='function')return false;
  const guard=()=>{
   if(!noConflictingWork()||status().state!=='prepared'||!record||
      record.session!==bot.session||record.realm!==p.realm())return false;
   const v=preflight(record.optionId);
   return !!v&&v.localConditionsMet===true&&v.run===record.run&&
    v.choiceId===record.choiceId&&v.optionId===record.optionId&&
    v.deadline===record.deadline;
  };
  if(!guard())return false;
  try{if(p.has('cave_reply')!==true)return false;}catch{return false;}
  const choice=record.choiceId,option=record.optionId;
  return bot.exec.dispatch('cave.vote.once',
   ['lifecycle','account'],guard,()=>{
    if(!markDispatchUnknown())
     throw Error('Cave vote checkpoint not persisted');
    const result=p.call('cave_reply',choice,option);
    return Promise.resolve(result).then(r=>{noteReply(r);return r;});
   },{value:true,timeout:20000,delay:1000,observe:()=>{
    const j=status();
    return j.state==='vote-observed'&&j.journal?.choiceId===choice;
   }});
 }
 return {status,prepare,requestVote,sample,discardPrepared,completeRun,
  close(){closed=true;}};
}
