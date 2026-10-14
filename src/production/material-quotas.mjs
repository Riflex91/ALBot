// Material quota accounting is for one verified Merchant request only.
// Do not reserve new farming work for offline, dead, wrong-realm or
// inventory-blocked farmers. Still count stock held by online, in-realm
// farmers even when they cannot accept more loot.
export function planMaterialQuotas(request,names,fresh,realm,{freeReserve=0}={}){
 const quantity=request?.quantity;
 if(!Number.isSafeInteger(quantity)||quantity<1||
   !Array.isArray(names)||typeof fresh!=='function')
  return {remaining:0,quotas:[]};
 const selected=new Set(),holders=[];
 for(const name of names){
  if(typeof name!=='string'||!name||selected.has(name))continue;
  selected.add(name);
  const h=fresh(name);
  if(!h?.running||h.rip||h.realm!==realm)continue;
  const progress=h.materialProgress?.find?.(x=>x?.objective===request.objective);
  const raw=progress?.quantity??0;
  // Never allocate against a malformed count; doing so can reproduce
  // material the team may already be carrying.
  if(!Number.isSafeInteger(raw)||raw<0)continue;
  const free=h.free,eligible=h.inventoryBlocked!==true&&
    (!Number.isSafeInteger(free)||free>freeReserve);
  holders.push({name,held:raw,eligible});
 }
 const total=holders.reduce((sum,h)=>sum+h.held,0);
 const remaining=Math.max(0,quantity-total);
 const eligible=holders.filter(h=>h.eligible);
 if(!eligible.length)return {remaining,quotas:[]};
 // Distribute the *exact* remaining count, not ceil(remaining / all
 // configured farmers), which overproduces and strands work on offline
 // characters. Stable roster order avoids unnecessary retargeting.
 const portion=Math.floor(remaining/eligible.length),extra=remaining%eligible.length;
 const quotas=eligible.map((h,index)=>({name:h.name,
   quantity:h.held+portion+(index<extra?1:0)}));
 return {remaining,quotas};
}

// The original heartbeat format lacked quotas. Preserve that legacy limit,
// but once explicit quotas are supplied a missing/malformed assignment is
// a zero-permission state, not unlimited permission to farm.
export function materialQuotaCap(request,name){
 if(!Number.isSafeInteger(request?.quantity)||request.quantity<1)return 0;
 if(Number.isSafeInteger(request.remaining)&&request.remaining<=0)return 0;
 if(!Array.isArray(request.quotas))return request.quantity;
 const row=request.quotas.find(r=>r?.name===name);
 return Number.isSafeInteger(row?.quantity)&&row.quantity>0?
   Math.min(row.quantity,request.quantity):0;
}
