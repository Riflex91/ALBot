import {reconcileStockEvidence} from '../items/stock-evidence.mjs';

// Optional W06 physical evidence is a SECOND independent count. The
// heartbeat remains peer-attested (never a server transfer receipt), but
// contradictory same-session physical stock must not fund a new farm quota.
// An omitted inventory proof does not turn an observed progress into zero.
export function materialProgressMatchesInventory(h,request,realm,{
 now=Date.now(),ttlMs=10000
}={}){
 const proof=h?.inventoryEvidence;
 if(proof===undefined||proof===null)return true;
 if(proof?.complete!==true||!Number.isSafeInteger(now)||
    !Number.isSafeInteger(ttlMs)||ttlMs<1||
    !Number.isSafeInteger(h?.received)||h.received>now||
    now-h.received>ttlMs||typeof h?.session!=='string'||!h.session||
    h.realm!==realm)return false;
 const validated=reconcileStockEvidence({
  local:proof,peers:[],owner:h.name,session:h.session,
  realm,now,ttlMs,expected:[]
 });
 if(validated.complete!==true||validated.sources?.[0]?.status!=='fresh')
  return false;
 let total=0,protectedUnits=0;
 for(const row of proof.rows){
  if(row.item.name!==request.item||(row.item.level??0)!==0)continue;
  if(!Number.isSafeInteger(total+row.quantity)||
     !Number.isSafeInteger(protectedUnits+row.protectedUnits))
   return false;
  total+=row.quantity;
  protectedUnits+=row.protectedUnits;
 }
 const records=h.materialProgress?.filter(x=>x?.objective===request.objective);
 if(!Array.isArray(records)||records.length>1)return false;
 const held=records.length?records[0].quantity:0;
 // Existing Farmer progress excludes lock/bound ("l", "b") stocks, but
 // can include additional protected flags. The inclusive interval avoids
 // conflating a gross physical copy with an eligible farming input.
 return Number.isSafeInteger(held)&&held>=0&&
  held>=total-protectedUnits&&held<=total;
}

// Material quota accounting is for one verified Merchant request only.
// Do not reserve new farming work for offline, dead, wrong-realm or
// inventory-blocked farmers. Still count stock held by online, in-realm
// farmers even when they cannot accept more loot.
export function planMaterialQuotas(request,names,fresh,realm,{freeReserve=0,now=Date.now(),ttlMs=10000}={}){
 const quantity=request?.quantity;
 if(!Number.isSafeInteger(quantity)||quantity<1||
   !Array.isArray(names)||typeof fresh!=='function')
  return {remaining:0,quotas:[]};
 const frozen=()=>({remaining:quantity,quotas:[]});
 // An invalid capacity threshold must not turn negative/unknown free-space
 // into permission to harvest. Bound the selected roster before touching
 // any peer or building account-wide material assignments.
 if(!Number.isSafeInteger(freeReserve)||freeReserve<0||
    !Number.isSafeInteger(now)||!Number.isSafeInteger(ttlMs)||
    ttlMs<1||ttlMs>600000||names.length>128)return frozen();
 const selected=new Set(),holders=[];
 for(const name of names){
  if(typeof name!=='string'||!name||selected.has(name))continue;
  selected.add(name);
  let h;
  try{h=fresh(name);}catch{return frozen();}
  if(!h?.running||h.rip||h.realm!==realm)continue;
  if(h.name!==name||!materialProgressMatchesInventory(h,request,realm,{now,ttlMs}))
   return frozen();
  // fitHeartbeat may drop this OPTIONAL evidence if the team heartbeat
  // exceeds its wire budget. Missing evidence is NOT proof of zero stock.
  // Freeze fresh quotas across the whole active group until all currently
  // participating Farmers have reported their quantities again.
  if(!Array.isArray(h.materialProgress)||
     h.materialProgress.length>128)return frozen();
  const matches=h.materialProgress.filter(x=>x?.objective===request.objective);
  if(matches.length>1)return frozen();
  const raw=matches.length?matches[0].quantity:0;
  // A malformed quantity is unknown, not zero. Continuing allocation among
  // other Farmers would duplicate stock already present in this inventory.
  if(!Number.isSafeInteger(raw)||raw<0)return frozen();
  // Unknown physical free space cannot authorize MORE farming. Current
  // observed stock still contributes to the global material balance.
  const free=h.free,eligible=h.inventoryBlocked===false&&
    Number.isSafeInteger(free)&&free>freeReserve;
  holders.push({name,held:raw,eligible});
 }
 // Every authenticated per-Farmer number is a safe integer, but THEIR
 // SUM need not be. Never round an unsafe account aggregate into a false
 // 'fulfilled' order, or silently reallocate unknown existing stock.
 let total=0;
 for(const h of holders){
  if(!Number.isSafeInteger(total+h.held))return frozen();
  total+=h.held;
 }
 const remaining=Math.max(0,quantity-total);
 const eligible=holders.filter(h=>h.eligible);
 if(!eligible.length)return {remaining,quotas:[]};
 // Distribute the *exact* remaining count, not ceil(remaining / all
 // configured farmers), which overproduces and strands work on offline
 // characters. Stable roster order avoids unnecessary retargeting.
 const portion=Math.floor(remaining/eligible.length),extra=remaining%eligible.length;
 const quotas=[];
 for(const [index,h] of eligible.entries()){
  const count=h.held+portion+(index<extra?1:0);
  if(!Number.isSafeInteger(count)||count<0)return frozen();
  quotas.push({name:h.name,quantity:count});
 }
 return {remaining,quotas};
}

// The original heartbeat format lacked quotas. Preserve that legacy limit,
// but once explicit quotas are supplied a missing/malformed assignment is
// a zero-permission state, not unlimited permission to farm.
export function materialQuotaCap(request,name){
 if(!Number.isSafeInteger(request?.quantity)||request.quantity<1)return 0;
 if(request.remaining!==undefined&&
   (!Number.isSafeInteger(request.remaining)||request.remaining<=0))return 0;
 if(request.quotas===undefined)return request.quantity;
 if(!Array.isArray(request.quotas))return 0;
 const row=request.quotas.find(r=>r?.name===name);
 return Number.isSafeInteger(row?.quantity)&&row.quantity>0?
   Math.min(row.quantity,request.quantity):0;
}

// A material objective with no physical farming allocations must not hijack
// the team's ordinary XP/gold farm plan. Legacy requests without quotas remain
// actionable, while explicit zero/empty/malformed quotas are a deliberate
// pause until the Merchant can verify and assign more material work.
export function materialRequestHasWork(request,selectedFarmers=null){
 if(!Number.isSafeInteger(request?.quantity)||request.quantity<=0)return false;
 if(request.remaining!==undefined&&
   (!Number.isSafeInteger(request.remaining)||request.remaining<=0))return false;
 if(request.quotas===undefined)return true;
 if(!Array.isArray(request.quotas))return false;
 return request.quotas.some(row=>typeof row?.name==='string'&&row.name&&
   (!Array.isArray(selectedFarmers)||selectedFarmers.includes(row.name))&&
   materialQuotaCap(request,row.name)>0);
}
