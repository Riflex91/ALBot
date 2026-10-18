// G11: peer heartbeat bank-owner evidence. This is an admission veto, NOT
// an atomic account-wide lock or proof that a remote account is idle.
// Transport already authenticates roster, message session, and heartbeat age.
// Reject an active but malformed claim rather than silently granting access.
export function bankOwnershipConflict(peers,{
 owner,session,realm,now,ttlMs
}={}){
 const invalid=reason=>({allowed:false,reason,conflict:null});
 if(typeof owner!=='string'||!owner||typeof session!=='string'||!session||
    typeof realm!=='string'||!realm||!Number.isFinite(now)||now<0||
    !Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>120000||
    !peers||typeof peers[Symbol.iterator]!=='function')
  return invalid('invalid-owner-context');
 let checked=0;
 for(const row of peers){
  if(!Array.isArray(row)||row.length!==2)return invalid('invalid-peer-row');
  const [name,peer]=row;
  if(typeof name!=='string'||!name||!peer||typeof peer!=='object')
   return invalid('invalid-peer-context');
  if(name===owner||peer.running!==true||!Number.isFinite(peer.received)||
     peer.received>now+2000||now-peer.received>=ttlMs)continue;
  checked++;
  const claim=peer.bankOwner;
  if(claim===undefined||claim===null)continue;
  if(!claim||typeof claim!=='object'||Array.isArray(claim))
   return {allowed:false,reason:'malformed-peer-claim',conflict:name};
  // An independently observed, expired lease is no longer an active claim.
  // An unparseable expiry is NOT evidence of an expired lease.
  if(!Number.isFinite(claim.expires))
   return {allowed:false,reason:'unknown-peer-claim-expiry',conflict:name};
  if(claim.expires<=now)continue;
  if(claim.owner!==name||claim.session!==peer.session||
     claim.realm!==peer.realm||typeof claim.purpose!=='string'||
     !claim.purpose.startsWith('bank.')||
     !Number.isFinite(claim.epoch)||claim.epoch>now+2000||
     claim.expires-claim.epoch>120000)
   return {allowed:false,reason:'unverified-active-peer-claim',conflict:name};
  // Bank ownership can be shared across realms: a fresh conflicting claim
  // from another realm is NOT permission for concurrent mutations.
  return {allowed:false,reason:'active-peer-bank-claim',conflict:name};
 }
 return {allowed:true,reason:'no-active-peer-claim-observed',checked,conflict:null,
  atomicLock:false};
}
