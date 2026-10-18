import {fingerprint,identity,protectedItem} from '../core/policy.mjs';

// Read-only addressed bank merge receipt; never assumes API success.
const swapSafe=n=>Number.isSafeInteger(n)&&n>=0;
export function validateBankSwapRecord(r,{owner,realm,now=Date.now()}={}){
 const no=reason=>({valid:false,reason});
 const a=r?.first,b=r?.second;
 if(r?.version!==1||r.owner!==owner||typeof owner!=='string'||!owner||
    r.realm!==realm||typeof realm!=='string'||!realm||
    !swapSafe(r.at)||r.at<1||r.at>now+2000||!swapSafe(now)||
    !/^items\d+$/.test(r.pack??'')||!swapSafe(r.a)||!swapSafe(r.b)||
    r.a>=r.b||r.b>=42||!a||!b||typeof a.name!=='string'||!a.name||protectedItem(a)||
    protectedItem(b)||identity(a)!==identity(b)||
    !swapSafe(r.qa)||r.qa<1||!swapSafe(r.qb)||r.qb<1||
    !swapSafe(r.total)||r.total!==r.qa+r.qb||
    r.qa!==(a.q??1)||r.qb!==(b.q??1)||
    r.fa!==fingerprint(a)||r.fb!==fingerprint(b))
  return no('invalid-record');
 const step=s=>{
  if(!s||s.kind!=='bank.consolidate'||typeof s.session!=='string'||!s.session||
     !swapSafe(s.at)||s.at<r.at||s.at>now+2000)return false;
  for(const k of ['realm','pack','a','b','fa','fb'])
   if(s[k]!==r[k])return false;
  return true;
 };
 if(!step(r.prepared)||r.dispatch&&(!step(r.dispatch)||
    r.dispatch.at<r.prepared.at))return no('invalid-receipt');
 return {valid:true,reason:null};
}
export function classifyBankSwapRecord(r,{owner,realm,now=Date.now(),bank,map,packMap}={}){
 const v=validateBankSwapRecord(r,{owner,realm,now});
 if(!v.valid)return {phase:'invalid',reason:v.reason};
 let actual;
 try{actual=packMap?.(r.pack);}catch{}
 if(!map||actual!==map||!Array.isArray(bank?.[r.pack])||
    bank[r.pack].length>42)return {phase:'unobserved',reason:'pack-not-current'};
 const a=bank[r.pack][r.a],b=bank[r.pack][r.b];
 if(fingerprint(a)===r.fa&&fingerprint(b)===r.fb)
  return {phase:r.dispatch?'dispatched-unchanged':'prepared-unchanged',
   reason:r.dispatch?'sent-unconfirmed':'unsent-exact'};
 const merged=fingerprint({...r.first,q:r.total});
 if((!a&&fingerprint(b)===merged)||(!b&&fingerprint(a)===merged)){
  const dest=!a?'merged-b':'merged-a';
  return {phase:r.dispatch?dest:'unproven-merge',
   reason:r.dispatch?'exact-merge-observed':'no-dispatch'};
 }
 return {phase:'ambiguous',reason:'slot-mismatch'};
}
