import {fingerprint,protectedItem} from '../core/policy.mjs';
import {verifiedProductionStockQuantity} from '../items/stock-policy.mjs';

// W12/N11 first bounded Crypt admission phase. The official CODE entrypoint
// is enter('crypt') to open and enter('crypt', instanceName) to join.
// There is deliberately NO automatic scheduler, replay, loot or exit path.
const cryptEntryText=s=>typeof s==='string'&&s.length>0&&s.length<=100;
const cryptEntryInstance=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(s);
const cryptEntryTime=n=>Number.isSafeInteger(n)&&n>0;
const cryptEntryPhases=new Set(['prepared','dispatch-unknown','inside-observed']);
export function validCryptEntryRecord(r){
 return !!r&&typeof r==='object'&&!Array.isArray(r)&&r.version===1&&
  cryptEntryText(r.owner)&&cryptEntryText(r.realm)&&cryptEntryText(r.session)&&cryptEntryTime(r.at)&&
  ['open','join'].includes(r.mode)&&cryptEntryPhases.has(r.phase)&&
  (r.mode==='open'?r.instance===null:cryptEntryInstance(r.instance))&&
  (r.mode==='open'?Number.isSafeInteger(r.keySlot)&&r.keySlot>=0&&
   r.keySlot<1000&&cryptEntryText(r.keyPrint)&&
   Number.isSafeInteger(r.keyBefore)&&r.keyBefore>=1:
   r.keySlot===null&&r.keyPrint===null&&r.keyBefore===null)&&
  (r.phase==='prepared'?r.dispatchAt===null&&r.inside===null:
   cryptEntryTime(r.dispatchAt)&&r.dispatchAt>=r.at&&
   (r.phase==='dispatch-unknown'?r.inside===null:
    !!r.inside&&cryptEntryInstance(r.inside.in)&&cryptEntryTime(r.inside.at)&&
    r.inside.at>=r.dispatchAt&&
    (r.mode==='open'||r.inside.in===r.instance)));
}
export function createCryptLifecycle(bot,{now=()=>Date.now()}={}){
 const {p,me}=bot,key='albot:crypt-lifecycle:'+me.name;
 let record=null,readFailed=false,writeFailed=false,closed=false;
 const read=()=>{
  if(typeof p.readCryptJournal!=='function')
   throw Error('strict-crypt-reader-unavailable');
  return p.readCryptJournal(key);
 };
 try{record=read()??null;}catch{readFailed=true;}
 const clone=v=>v===null?null:JSON.parse(JSON.stringify(v));
 const quantity=()=>verifiedProductionStockQuantity(p.G,p.c?.items,
  {name:'cryptkey',level:0});
 const live=()=>p.c?.map==='crypt'&&cryptEntryInstance(p.c?.in)?
  {map:'crypt',in:p.c.in}:null;
 const plainSafe=()=>!closed&&bot.running&&
  !bot.journal&&!bot.inventoryBlocked&&!bot.bank?.pending&&
  !bot.logistics?.reserved&&!bot.lifecycleChanging&&
  !bot.teamTravel?.blocked&&!bot.account?.rotationPending?.()&&
  !p.c?.rip&&typeof bot.session==='string'&&!!bot.session&&
  typeof p.realm==='function'&&cryptEntryText(p.realm())&&
  bot.exec?.pending?.size===0&&
  !bot.movement?.order&&!bot.strategy?.busy&&!live()&&
  p.has?.('enter')===true;
 function durable(next){
  if(closed||readFailed||writeFailed)return false;
  try{
   if(JSON.stringify(read()??null)!==JSON.stringify(record)){
    writeFailed=true;return false;
   }
   if(p.write(key,next)!==true||
      JSON.stringify(read()??null)!==JSON.stringify(next)){
    writeFailed=true;return false;
   }
   record=clone(next);return true;
  }catch{writeFailed=true;return false;}
 }
 function preflight(mode='open',name=null){
  if(readFailed||writeFailed||record||!plainSafe()||
     !['open','join'].includes(mode)||mode==='open'&&name!==null||
     mode==='join'&&!cryptEntryInstance(name))return null;
  if(mode==='join')return {mode,instance:name,keySlot:null,
   keyPrint:null,keyBefore:null};
  const n=quantity();
  if(!Number.isSafeInteger(n)||n<1)return null;
  const slot=p.c.items.findIndex(i=>i?.name==='cryptkey'&&
   (i.level??0)===0&&(i.q===undefined?1:i.q)===1&&
   !protectedItem(i));
  if(slot<0)return null;
  return {mode,instance:null,keySlot:slot,
   keyPrint:fingerprint(p.c.items[slot]),keyBefore:n};
 }
 function status(){
  if(readFailed||writeFailed)return {version:1,state:'storage-uncertain',
   blocked:true,executable:false,reason:readFailed?
    'strict-journal-read-failed':'durable-journal-write-failed',
   journal:validCryptEntryRecord(record)?clone(record):null};
  if(record!==null){
   if(!validCryptEntryRecord(record))return {version:1,state:'corrupt',
    blocked:true,executable:false,reason:'invalid-crypt-journal',journal:null};
   if(record.owner!==me.name||record.realm!==p.realm())
    return {version:1,state:'scope-mismatch',blocked:true,
     executable:false,reason:'crypt-owner-or-realm-drift',journal:clone(record)};
   if(record.phase==='inside-observed'&&
      (live()?.in!==record.inside.in))
    return {version:1,state:'instance-not-currently-observed',
     blocked:true,executable:false,reason:'exit-not-proven',journal:clone(record)};
   return {version:1,state:record.phase,blocked:true,executable:false,
    reason:record.phase==='dispatch-unknown'?'entry-outcome-unknown':
     'persistent-crypt-admission',journal:clone(record)};
  }
  return {version:1,state:'empty',blocked:false,executable:false,
   reason:'explicit-entry-only',journal:null};
 }
 function prepare(mode='open',name=null){
  const pflight=preflight(mode,name),at=now();
  if(!pflight||!cryptEntryTime(at))return false;
  const next={version:1,owner:me.name,realm:p.realm(),
   session:bot.session,at,mode:pflight.mode,instance:pflight.instance,
   keySlot:pflight.keySlot,keyPrint:pflight.keyPrint,
   keyBefore:pflight.keyBefore,phase:'prepared',dispatchAt:null,inside:null};
  return validCryptEntryRecord(next)&&durable(next);
 }
 function ready(){
  if(!record||status().state!=='prepared'||!plainSafe()||
     record.session!==bot.session||record.realm!==p.realm())return false;
  // No new key can be substituted between preparation and dispatch.
  if(record.mode==='join')return true;
  const fresh=preflightInput();
  return fresh&&fresh.keySlot===record.keySlot&&
   fresh.keyPrint===record.keyPrint&&fresh.keyBefore===record.keyBefore;
 }
 function preflightInput(){
  if(!Array.isArray(p.c?.items))return null;
  const n=quantity(),i=p.c.items[record?.keySlot];
  if(!Number.isSafeInteger(n)||n<1||!i||
     i.name!=='cryptkey'||(i.level??0)!==0||
     (i.q===undefined?1:i.q)!==1||protectedItem(i))return null;
  return {keySlot:record.keySlot,keyPrint:fingerprint(i),keyBefore:n};
 }
 function requestEntry(){
  if(!ready()||typeof bot.exec?.dispatch!=='function')return false;
  const mode=record.mode,target=record.instance;
  return bot.exec.dispatch('crypt.enter.once',
   ['lifecycle','movement','account'],ready,()=>{
    const at=now();
    if(!cryptEntryTime(at)||at<record.at||
       !durable({...record,phase:'dispatch-unknown',dispatchAt:at}))
     throw Error('crypt-entry-intent-not-durable');
    // The official enter() may consume one Crypt key, but its Promise
    // response alone cannot prove a private instance was entered.
    return mode==='open'?p.call('enter','crypt'):
     p.call('enter','crypt',target);
   },{value:true,timeout:25000,delay:1000,observe:()=>false});
 }
 function sample(){
  if(closed||readFailed||writeFailed||
     !record||record.phase!=='dispatch-unknown'||
     record.owner!==me.name||record.realm!==p.realm()||
     !bot.running)return false;
  const where=live(),at=now();
  if(!where||!cryptEntryTime(at)||at<record.dispatchAt||
     record.mode==='join'&&where.in!==record.instance)return false;
  // Opening consumes exactly one key; do not credit map transit as a
  // successful key-based run if its physical effect is unverified.
  if(record.mode==='open'&&quantity()!==record.keyBefore-1)
   return false;
  return durable({...record,phase:'inside-observed',
   inside:{in:where.in,at}});
 }
 function discardPrepared(){
  return !!record&&record.phase==='prepared'&&
   record.owner===me.name&&record.realm===p.realm()&&
   !bot.exec?.pending?.size&&durable(null);
 }
 return {preflight,prepare,requestEntry,sample,discardPrepared,status,
  close(){closed=true;}};
}
