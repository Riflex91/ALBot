import {fingerprint,identity,protectedItem} from '../core/policy.mjs';

// Bank-only stack consolidation. The API return does not prove either
// of the two allowed resulting slot layouts.
const swapSafe=n=>Number.isSafeInteger(n)&&n>=0;
export function validateBankSwapRecord(r,{owner,realm,now=Date.now()}={}){
 const no=reason=>({valid:false,reason});
 if(!r||typeof r!=='object'||Array.isArray(r)||r.version!==1||
    typeof owner!=='string'||!owner||r.owner!==owner||
    typeof realm!=='string'||!realm||r.realm!==realm||
    !swapSafe(now)||!swapSafe(r.at)||r.at<1||r.at>now+2000)
  return no('invalid-swap-owner-realm-time');
 if(!/^items\d+$/.test(r.pack??'')||!swapSafe(r.a)||r.a>=42||
    !swapSafe(r.b)||r.b>=42||r.a>=r.b)
  return no('invalid-swap-address');
 if(!r.first||!r.second||protectedItem(r.first)||protectedItem(r.second)||
    typeof r.first.name!=='string'||!r.first.name||
    identity(r.first)!==identity(r.second)||
    !swapSafe(r.qa)||r.qa<1||!swapSafe(r.qb)||r.qb<1||
    !swapSafe(r.total)||r.total<2||r.total!==r.qa+r.qb||
    r.qa!==(r.first.q??1)||r.qb!==(r.second.q??1)||
    r.fa!==fingerprint(r.first)||r.fb!==fingerprint(r.second))
  return no('invalid-swap-stacks');
 const step=s=>!!s&&typeof s==='object'&&!Array.isArray(s)&&
  s.kind==='bank.consolidate'&&typeof s.session==='string'&&!!s.session&&
  swapSafe(s.at)&&s.at>=r.at&&s.at<=now+2000&&
  s.realm===r.realm&&s.pack===r.pack&&s.a===r.a&&s.b===r.b&&
  s.fa===r.fa&&s.fb===r.fb;
 if(!step(r.prepared))return no('invalid-swap-preparation');
 if(r.dispatch!==undefined&&(!step(r.dispatch)||r.dispatch.at<r.prepared.at))
  return no('invalid-swap-dispatch');
 return {valid:true,reason:null};
}
export function classifyBankSwapRecord(r,{owner,realm,now=Date.now(),bank,map,packMap}={}){
 const valid=validateBankSwapRecord(r,{owner,realm,now});
 if(!valid.valid)return {phase:'invalid',reason:valid.reason};
 let actualMap;
 try{actualMap=packMap?.(r.pack);}catch{
  return {phase:'unobserved',reason:'bank-map-unresolved'};
 }
 if(!map||actualMap!==map||!bank||!Array.isArray(bank[r.pack])||
    bank[r.pack].length>42)
  return {phase:'unobserved',reason:'bank-pack-not-current'};
 const a=bank[r.pack][r.a],b=bank[r.pack][r.b];
 if(fingerprint(a)===r.fa&&fingerprint(b)===r.fb)
  return r.dispatch?{phase:'dispatched-unchanged',reason:'sent-not-confirmed'}:
   {phase:'prepared-unchanged',reason:'unsent-exact-before-image'};
 const merged=fingerprint({...r.first,q:r.total});
 if(!a&&b&&fingerprint(b)===merged)
  return r.dispatch?{phase:'merged-b',reason:'exact-merge-observed'}:
   {phase:'unproven-merge',reason:'effect-without-dispatch'};
 if(!b&&a&&fingerprint(a)===merged)
  return r.dispatch?{phase:'merged-a',reason:'exact-merge-observed'}:
   {phase:'unproven-merge',reason:'effect-without-dispatch'};
 return {phase:'ambiguous',reason:'addressed-bank-slots-mismatch'};
}
