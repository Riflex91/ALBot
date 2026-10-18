import {fingerprint,protectedItem,variantCount} from '../core/policy.mjs';

// Single full-stack bank withdrawal. This read-only evidence check never
// treats a stale/off-map pack as empty, and is not an account-wide lock.
const safe=n=>Number.isSafeInteger(n)&&n>=0;
export function validateBankSingleRecord(r,{owner,realm,now=Date.now()}={}){
 const no=reason=>({valid:false,reason});
 if(!r||typeof r!=='object'||Array.isArray(r)||r.version!==1||
    typeof owner!=='string'||!owner||r.owner!==owner||
    typeof realm!=='string'||!realm||r.realm!==realm||
    !safe(now)||!safe(r.at)||r.at<1||r.at>now+2000)
  return no('invalid-single-owner-realm-or-time');
 if(!/^items\d+$/.test(r.pack??'')||!safe(r.slot)||r.slot>=42||
    !safe(r.dest)||r.dest>=1000)
  return no('invalid-single-address');
 if(!r.item||typeof r.item.name!=='string'||!r.item.name||
    protectedItem(r.item)||!safe(r.quantity)||r.quantity<1||
    r.quantity!==(r.item.q??1)||!safe(r.before)||!safe(r.bankBefore)||
    r.bankBefore<r.quantity||!safe(r.before+r.quantity)||
    r.sourcePrint!==fingerprint(r.item))
  return no('invalid-single-source');
 const step=(v,kind)=>{
  return !!v&&typeof v==='object'&&!Array.isArray(v)&&
   v.kind===kind&&typeof v.session==='string'&&!!v.session&&
   safe(v.at)&&v.at>=r.at&&v.at<=now+2000&&
   v.realm===r.realm&&v.pack===r.pack&&v.slot===r.slot&&
   v.dest===r.dest&&v.sourcePrint===r.sourcePrint;
 };
 if(!step(r.prepared,'bank.retrieve'))
  return no('invalid-single-preparation');
 if(r.dispatch!==undefined&&
    (!step(r.dispatch,'bank.retrieve')||r.dispatch.at<r.prepared.at))
  return no('invalid-single-dispatch');
 return {valid:true,reason:null};
}
export function classifyBankSingleRecord(r,{
 owner,realm,now=Date.now(),inventory,bank,map,packMap
}={}){
 const validity=validateBankSingleRecord(r,{owner,realm,now});
 if(!validity.valid)return {phase:'invalid',reason:validity.reason};
 if(!Array.isArray(inventory)||r.dest>=inventory.length||
    typeof packMap!=='function'||typeof map!=='string'||!map)
  return {phase:'unobserved',reason:'inventory-or-bank-map-unknown'};
 let sourceMap;
 try{sourceMap=packMap(r.pack);}catch{return {phase:'unobserved',reason:'bank-pack-map-unresolved'};}
 if(sourceMap!==map||!bank||!Array.isArray(bank[r.pack])||
    bank[r.pack].length>42)
  return {phase:'unobserved',reason:'addressed-bank-pack-not-current'};
 const pack=bank[r.pack],source=pack[r.slot],dest=inventory[r.dest];
 const carried=variantCount(inventory,r.item),bankCount=variantCount(pack,r.item);
 if(!safe(carried)||!safe(bankCount))
  return {phase:'ambiguous',reason:'invalid-observed-quantities'};
 if(!dest&&source&&fingerprint(source)===r.sourcePrint&&
    carried===r.before&&bankCount===r.bankBefore)
  return r.dispatch?
   {phase:'dispatched-unchanged',reason:'sent-but-no-physical-effect-confirmed'}:
   {phase:'prepared-unchanged',reason:'no-api-dispatch-recorded'};
 if(!source&&dest&&fingerprint(dest)===r.sourcePrint&&
    carried===r.before+r.quantity&&
    bankCount===r.bankBefore-r.quantity)
  return r.dispatch?
   {phase:'withdrawn',reason:'dispatched-and-exact-source-destination-observed'}:
   {phase:'unproven-withdrawal',reason:'effect-without-dispatch-provenance'};
 return {phase:'ambiguous',reason:'source-destination-or-quantity-mismatch'};
}
