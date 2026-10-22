import {fingerprint,protectedItem} from '../core/policy.mjs';
import {verifiedBankVariantCount} from './bank-recovery-quantities.mjs';

// W03/W04/G11: one read-only proof over a durable bank-reclaim before-image.
// No guess about missing bank packs or a checkpoint written by older code
// may authorize a withdrawal or a second NPC sale.
const safe=n=>Number.isSafeInteger(n)&&n>=0;
export function validateBankReclaimRecord(record,{owner,realm,now=Date.now(),G}={}){
 const reject=reason=>({valid:false,reason});
 if(!record||typeof record!=='object'||Array.isArray(record)||
    record.version!==2||typeof owner!=='string'||!owner||
    typeof realm!=='string'||!realm||
    record.owner!==owner||record.realm!==realm)
  return reject('unverified-checkpoint-owner-or-version');
 if(!safe(now)||!safe(record.at)||record.at<1||record.at>now+2000)
  return reject('invalid-checkpoint-time');
 if(!/^items\d+$/.test(record.pack??'')||!safe(record.slot)||
    record.slot>=42||!safe(record.dest)||record.dest>=1000)
  return reject('invalid-addressed-slots');
 if(!record.item||typeof record.item.name!=='string'||!record.item.name||
    protectedItem(record.item)||!safe(record.quantity)||
    record.quantity<1||
    record.quantity!==(record.item.q===undefined?1:record.item.q)||
    (G&&(!G.items?.[record.item.name]||
     record.quantity>(G.items[record.item.name].s===true?9999:
      Number.isSafeInteger(G.items[record.item.name].s)&&
      G.items[record.item.name].s>1?
       G.items[record.item.name].s:1)))||
    !safe(record.before)||!safe(record.bankBefore)||
    record.bankBefore<record.quantity||
    !safe(record.before+record.quantity))
  return reject('invalid-variant-or-quantities');
 if(typeof record.sourcePrint!=='string'||
    record.sourcePrint!==fingerprint(record.item)||
    typeof record.explicitOnly!=='boolean'||
    !safe(record.gold)||!safe(record.expectedSaleGold)||
    !(record.saleConfirmed===undefined||record.saleConfirmed===true))
  return reject('invalid-checkpoint-evidence');
 // An offsite NPC trip must be based on a DURABLY recorded, exact bank
 // withdrawal from the original physical source slot, not cached bank arrays.
 // Old v2 records without this optional receipt remain readable, but cannot
 // authorize a new offsite NPC sale until the bank source is observed again.
 // New V2 intents carry a durable, session-bound PREPARED state from
 // before the queue was even admitted. Older V2 records lack this field:
 // absence of a dispatch receipt in those records is NOT proof of no API call.
 if(record.prepared!==undefined){
  const p=record.prepared;
  if(!p||typeof p!=='object'||Array.isArray(p)||
     typeof p.session!=='string'||!p.session||
     !safe(p.at)||p.at<record.at||p.at>now+2000||
     p.kind!=='bank.reclaim'||p.realm!==record.realm||
     p.pack!==record.pack||p.slot!==record.slot||
     p.dest!==record.dest||p.sourcePrint!==record.sourcePrint)
   return reject('invalid-durable-preparation-receipt');
 }
 // A dispatched bank request is an uncertainty boundary. Persist the
 // provenance BEFORE calling bank_retrieve, never infer 'not sent' from an
 // unchanged bank snapshot after a timeout or browser restart.
 if(record.dispatch!==undefined){
  const d=record.dispatch;
  if(!d||typeof d!=='object'||Array.isArray(d)||
     typeof d.session!=='string'||!d.session||
     !safe(d.at)||d.at<record.at||d.at>now+2000||
     d.kind!=='bank.reclaim'||d.realm!==record.realm||
     d.pack!==record.pack||d.slot!==record.slot||
     d.dest!==record.dest||d.sourcePrint!==record.sourcePrint)
   return reject('invalid-durable-dispatch-receipt');
 }
 if(record.withdrawal!==undefined){
  const w=record.withdrawal;
  if(!w||typeof w!=='object'||Array.isArray(w)||
     !safe(w.at)||w.at<record.at||w.at>now+2000||
     w.realm!==record.realm||w.pack!==record.pack||
     w.slot!==record.slot||w.dest!==record.dest||
     w.sourcePrint!==record.sourcePrint||
     w.inventoryCount!==record.before+record.quantity||
     w.bankCount!==record.bankBefore-record.quantity)
   return reject('invalid-durable-withdrawal-receipt');
 }
 if(record.rollback!==undefined){
  const b=record.rollback;
  if(!record.dispatch||!record.withdrawal||record.saleConfirmed||
     !b||typeof b!=='object'||Array.isArray(b)||
     !safe(b.at)||b.at<record.at||b.at>now+2000||
     typeof b.session!=='string'||!b.session||b.realm!==record.realm||
     b.pack!==record.pack||b.source!==record.dest||
     b.dest!==record.slot||b.sourcePrint!==record.sourcePrint||
     (b.dispatchedAt!==undefined&&(!safe(b.dispatchedAt)||
      b.dispatchedAt<b.at||b.dispatchedAt>now+2000)))
   return reject('invalid-bank-rollback-receipt');
 }
 return {valid:true,reason:null};
}
// Only a previously VERIFIED and persisted withdrawal may continue to an
// NPC when the character has left the bank map. This does NOT prove an
// offsite bank pack is empty or that an NPC sale already happened.
export function inspectOffsiteBankReclaim(record,{
 owner,realm,now=Date.now(),inventory,G
}={}){
 const v=validateBankReclaimRecord(record,{owner,realm,now,G});
 if(!v.valid)return {eligible:false,reason:v.reason};
 if(record.saleConfirmed===true)return {
  eligible:false,reason:'npc-sale-already-confirmed-return-to-bank'
 };
 if(!record.withdrawal||!Array.isArray(inventory)||
    record.dest>=inventory.length)
  return {eligible:false,reason:'durable-withdrawal-or-inventory-missing'};
 const item=inventory[record.dest];
 const count=verifiedBankVariantCount(inventory,record.item,G);
 if(!item||fingerprint(item)!==record.sourcePrint||
    !safe(count)||count!==record.withdrawal.inventoryCount)
  return {eligible:false,reason:'offsite-source-slot-or-variant-count-changed'};
 return {eligible:true,reason:'durable-exact-withdrawal-and-live-carried-stack'};
}

export function classifyBankReclaimRecord(record,{owner,realm,now=Date.now(),
 inventory,bank,map,packMap,G}={}){
 const verified=validateBankReclaimRecord(record,{owner,realm,now,G});
 if(!verified.valid)return {phase:'invalid',reason:verified.reason,confirmed:false};
 if(!Array.isArray(inventory)||record.dest>=inventory.length||
    typeof packMap!=='function'||typeof map!=='string'||!map)
  return {phase:'unobserved',reason:'inventory-or-bank-map-unavailable',confirmed:false};
 let bankMap;try{bankMap=packMap(record.pack);}catch{
  return {phase:'unobserved',reason:'bank-map-unresolved',confirmed:false};
 }
 if(bankMap!==map||!bank||!Array.isArray(bank[record.pack])||
    bank[record.pack].length>42||record.slot>=bank[record.pack].length)
  return {phase:'unobserved',reason:'addressed-local-bank-pack-unavailable',confirmed:false};
 const pack=bank[record.pack],source=pack[record.slot],
  target=inventory[record.dest];
 const count=verifiedBankVariantCount(inventory,record.item,G),
  bankCount=verifiedBankVariantCount(pack,record.item,G);
 if(!safe(count)||!safe(bankCount))
  return {phase:'ambiguous',reason:'invalid-observed-quantities',confirmed:false};
 const original=!!source&&fingerprint(source)===record.sourcePrint,
  withdrawn=!source&&!!target&&fingerprint(target)===record.sourcePrint,
  empty=!target;
 if(record.rollback){
  if(original&&empty&&count===record.before&&bankCount===record.bankBefore)
   return record.rollback.dispatchedAt!==undefined?
    {phase:'restored',reason:'exact-dispatched-rollback',confirmed:true}:
    {phase:'ambiguous',reason:'effect-without-dispatch',confirmed:false};
  if(withdrawn&&count===record.before+record.quantity&&
     bankCount===record.bankBefore-record.quantity)
   return record.rollback.dispatchedAt!==undefined?
    {phase:'rollback-dispatched-unchanged',reason:'sent-uncertain',confirmed:false}:
    {phase:'rollback-prepared',reason:'unsent-and-exact',confirmed:false};
  return {phase:'ambiguous',reason:'rollback-slot-mismatch',confirmed:false};
 }
 if(!record.saleConfirmed&&original&&empty&&
    count===record.before&&bankCount===record.bankBefore)
  return record.dispatch?
   {phase:'dispatched-unchanged',
    reason:'bank-request-already-dispatched-but-no-effect-confirmed',
    confirmed:false}:
   !record.prepared?
   {phase:'legacy-unchanged-uncertain',
    reason:'old-v2-journal-without-proof-of-not-dispatched',confirmed:false}:
   {phase:'unchanged',reason:'prepared-and-exact-before-image-not-dispatched',
    confirmed:false};
 if(!record.saleConfirmed&&withdrawn&&
    count===record.before+record.quantity&&
    bankCount===record.bankBefore-record.quantity)
  return {phase:'withdrawn',reason:'exact-addressed-withdrawal',confirmed:true};
 if(record.saleConfirmed===true&&!source&&empty&&
    count===record.before&&
    bankCount===record.bankBefore-record.quantity)
  return {phase:'sold',reason:'previously-confirmed-sale-and-exact-final-state',
   confirmed:true};
 return {phase:'ambiguous',reason:'addressed-inventory-or-bank-evidence-mismatch',
  confirmed:false};
}
