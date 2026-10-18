import {fingerprint,protectedItem,variantCount} from '../core/policy.mjs';

// W03: physical evidence for a persisted partial withdrawal. This module is
// read-only and never schedules, clears or automatically approves an action.
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function validateBankPartialRecord(r,{owner,realm,now=Date.now()}={}){
 const bad=reason=>({valid:false,reason});
 if(!r||typeof r!=='object'||Array.isArray(r)||r.version!==2||
    !owner||typeof owner!=='string'||r.owner!==owner||
    !realm||typeof realm!=='string'||r.realm!==realm)
  return bad('unverified-owner-realm-or-version');
 if(!integer(now)||!integer(r.at)||r.at<1||r.at>now+2000)
  return bad('invalid-record-time');
 if(!/^items\d+$/.test(r.pack??'')||![r.bankSlot,r.dest,r.splitSlot].every(integer)||
    r.bankSlot>=42||r.dest>=1000||r.splitSlot>=1000||r.dest===r.splitSlot)
  return bad('invalid-addresses');
 if(!r.item||typeof r.item.name!=='string'||!r.item.name||
    protectedItem(r.item)||!integer(r.total)||!integer(r.take)||
    !(r.total>r.take&&r.take>0)||r.item.q!==r.total||
    !integer(r.before)||!integer(r.bankBefore)||r.bankBefore<r.total||
    !Number.isSafeInteger(r.before+r.total)||!integer(r.bankBefore-r.total)||
    r.sourcePrint!==fingerprint(r.item))
  return bad('invalid-quantities-or-source');
 const phases=['original','withdrawn','split'];
 if(r.prepared!==undefined){
  const v=r.prepared;
  if(!v||typeof v!=='object'||Array.isArray(v)||
     typeof v.session!=='string'||!v.session||
     !integer(v.at)||v.at<r.at||v.at>now+2000||
     v.realm!==r.realm||v.pack!==r.pack||v.bankSlot!==r.bankSlot||
     v.dest!==r.dest||v.splitSlot!==r.splitSlot||
     v.sourcePrint!==r.sourcePrint)
   return bad('invalid-prepared-partial-intent');
 }
 if(r.dispatches!==undefined){
  if(!Array.isArray(r.dispatches)||r.dispatches.length>3||
     !r.prepared)return bad('invalid-partial-dispatch-history');
  for(let i=0;i<r.dispatches.length;i++){
   const v=r.dispatches[i];
   if(!v||typeof v!=='object'||Array.isArray(v)||
      v.phase!==phases[i]||typeof v.session!=='string'||!v.session||
      v.session!==r.prepared.session||
      !integer(v.at)||v.at<r.at||v.at>now+2000||
      (i>0&&v.at<r.dispatches[i-1].at)||
      v.realm!==r.realm||v.pack!==r.pack||
      v.bankSlot!==r.bankSlot||v.dest!==r.dest||
      v.splitSlot!==r.splitSlot||v.sourcePrint!==r.sourcePrint)
    return bad('invalid-partial-dispatch-history');
  }
 }
 return {valid:true,reason:null};
}
// No phase change is considered an authoritative server receipt by itself.
// Each step needs a previously persisted, session-bound dispatch proof. A
// still-current predecessor of an already dispatched step is UNKNOWN, not
// safely retryable. Legacy records are explicitly quarantined.
export function partialDispatchDecision(record,phase){
 const index=['original','withdrawn','split','returned'].indexOf(phase);
 if(index<0)return {allowed:false,reason:'invalid-physical-phase'};
 if(!record?.prepared||!Array.isArray(record.dispatches))
  return {allowed:false,reason:'legacy-partial-without-dispatch-chain'};
 const n=record.dispatches.length;
 if(n>index)return {allowed:false,reason:'dispatched-step-outcome-unknown'};
 if(n<index)return {allowed:false,reason:'unproven-previous-dispatch'};
 return {allowed:true,reason:index===3?
  'all-three-dispatches-and-return-observed':'previous-dispatch-observed'};
}

export function classifyBankPartialRecord(r,{
 owner,realm,now=Date.now(),inventory,bank,map,packMap
}={}){
 const v=validateBankPartialRecord(r,{owner,realm,now});
 if(!v.valid)return {phase:'invalid',reason:v.reason,confirmed:false};
 if(!Array.isArray(inventory)||r.dest>=inventory.length||
    r.splitSlot>=inventory.length||typeof packMap!=='function'||
    typeof map!=='string'||!map)
  return {phase:'unobserved',reason:'inventory-or-map-not-observed',confirmed:false};
 let packLocation=null;
 try{packLocation=packMap(r.pack);}catch{}
 if(!packLocation||packLocation!==map||!bank||
    !Array.isArray(bank[r.pack])||bank[r.pack].length>42)
  return {phase:'unobserved',reason:'live-bank-pack-not-observed',confirmed:false};
 const row=bank[r.pack],original=row[r.bankSlot],
  dest=inventory[r.dest],split=inventory[r.splitSlot],
  localCount=variantCount(inventory,r.item),
  bankCount=variantCount(row,r.item),
  same=(i,q)=>!!i&&fingerprint(i)===fingerprint({...r.item,q});
 // Signed sums must match and unrelated stack positions must not be allowed
 // to stand in for the addressed bank/inventory source and destinations.
 if(!integer(localCount)||!integer(bankCount))
  return {phase:'ambiguous',reason:'invalid-count',confirmed:false};
 if(same(original,r.total)&&!dest&&!split&&
    localCount===r.before&&bankCount===r.bankBefore)
  return {phase:'original',reason:'exact-full-bank-before-image',confirmed:true};
 if(!original&&same(dest,r.total)&&!split&&
    localCount===r.before+r.total&&bankCount===r.bankBefore-r.total)
  return {phase:'withdrawn',reason:'exact-bank-withdrawal-observed',confirmed:true};
 if(!original&&same(dest,r.total-r.take)&&same(split,r.take)&&
    localCount===r.before+r.total&&bankCount===r.bankBefore-r.total)
  return {phase:'split',reason:'both-exact-split-stacks-observed',confirmed:true};
 if(same(original,r.total-r.take)&&!dest&&same(split,r.take)&&
    localCount===r.before+r.take&&bankCount===r.bankBefore-r.take)
  return {phase:'returned',reason:'exact-partial-return-observed',confirmed:true};
 return {phase:'ambiguous',reason:'addressed-slots-or-totals-differ',confirmed:false};
}
