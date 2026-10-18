import {fingerprint,protectedItem} from '../core/policy.mjs';

// Read-only proof of exactly one addressed bank deposit; no account-wide lock.
const storeSafe=n=>Number.isSafeInteger(n)&&n>=0;
export function validateBankStoreRecord(r,{owner,realm,now=Date.now()}={}){
 const no=reason=>({valid:false,reason});
 if(!r||typeof r!=='object'||Array.isArray(r)||r.version!==1||
    typeof owner!=='string'||!owner||r.owner!==owner||
    typeof realm!=='string'||!realm||r.realm!==realm||
    !storeSafe(now)||!storeSafe(r.at)||r.at<1||r.at>now+2000)
  return no('invalid-owner-realm-time');
 if(!/^items\d+$/.test(r.pack??'')||!storeSafe(r.source)||r.source>=1000||
    !storeSafe(r.dest)||r.dest>=42)return no('invalid-store-address');
 if(!r.item||typeof r.item.name!=='string'||!r.item.name||
    protectedItem(r.item)||!storeSafe(r.quantity)||r.quantity<1||
    r.quantity!==(r.item.q??1)||r.sourcePrint!==fingerprint(r.item))
  return no('invalid-store-source');
 const step=s=>!!s&&typeof s==='object'&&!Array.isArray(s)&&
  s.kind==='bank.store'&&typeof s.session==='string'&&!!s.session&&
  storeSafe(s.at)&&s.at>=r.at&&s.at<=now+2000&&
  s.realm===r.realm&&s.pack===r.pack&&s.source===r.source&&
  s.dest===r.dest&&s.sourcePrint===r.sourcePrint;
 if(!step(r.prepared))return no('invalid-preparation');
 if(r.dispatch!==undefined&&(!step(r.dispatch)||r.dispatch.at<r.prepared.at))
  return no('invalid-dispatch');
 return {valid:true,reason:null};
}
export function classifyBankStoreRecord(r,{
 owner,realm,now=Date.now(),inventory,bank,map,packMap
}={}){
 const v=validateBankStoreRecord(r,{owner,realm,now});
 if(!v.valid)return {phase:'invalid',reason:v.reason};
 if(!Array.isArray(inventory)||r.source>=inventory.length||
    !map||typeof packMap!=='function')
  return {phase:'unobserved',reason:'inventory-or-map-unavailable'};
 let bankMap;
 try{bankMap=packMap(r.pack);}catch{
  return {phase:'unobserved',reason:'bank-map-unresolved'};
 }
 if(bankMap!==map||!bank||!Array.isArray(bank[r.pack])||
    bank[r.pack].length>42)
  return {phase:'unobserved',reason:'addressed-pack-not-current'};
 const source=inventory[r.source],dest=bank[r.pack][r.dest];
 if(source&&fingerprint(source)===r.sourcePrint&&!dest)
  return r.dispatch?{phase:'dispatched-unchanged',reason:'sent-unconfirmed'}:
   {phase:'prepared-unchanged',reason:'unsent-exact-before-image'};
 if(!source&&dest&&fingerprint(dest)===r.sourcePrint)
  return r.dispatch?{phase:'stored',reason:'dispatched-and-addressed-store-observed'}:
   {phase:'unproven-store',reason:'effect-without-dispatch-receipt'};
 return {phase:'ambiguous',reason:'source-or-destination-mismatch'};
}
