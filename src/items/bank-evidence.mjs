import {inventoryStockEvidence} from './stock-evidence.mjs';

// A live-in-client bank view is useful reconciliation telemetry, but is NOT
// a server transaction acknowledgement and never authorizes a bank action.
// Adventure Land may expose only the current map's bank packs. Never treat
// missing remote packs as empty or count them toward actionable account stock.
export function inspectBankEvidence(bank,{
 owner,session,realm,map,packMap,now=Date.now(),blocked=false,
 maxPacks=12,maxRows=128
}={}){
 const invalid=reason=>({version:1,mode:'shadow-only',authority:'none',
  owner,session,realm,map,at:now,complete:false,reason,scope:'current-map-only',
  packs:[],rows:[],quantity:()=>null,executable:false});
 if(blocked)return invalid('value-action-unresolved');
 if(!bank||typeof bank!=='object'||Array.isArray(bank)||
    typeof packMap!=='function'||typeof map!=='string'||!map||
    typeof owner!=='string'||!owner||typeof session!=='string'||!session||
    typeof realm!=='string'||!realm||
    !Number.isSafeInteger(now)||now<0||
    !Number.isSafeInteger(maxPacks)||maxPacks<1||maxPacks>16||
    !Number.isSafeInteger(maxRows)||maxRows<1||maxRows>256)
  return invalid('invalid-context');
 const names=Object.keys(bank).filter(k=>/^items[0-9]+$/.test(k));
 if(names.length>maxPacks)return invalid('bank-pack-overflow');
 const locations=[];
 for(const name of names){
  let place;
  try{place=packMap(name);}catch{return invalid('unverified-bank-pack-map');}
  if(typeof place!=='string'||!place)return invalid('unverified-bank-pack-map');
  if(place===map)locations.push(name);
 }
 if(!locations.length)return invalid('no-visible-local-bank-packs');
 const rows=new Map(),packs=[];
 for(const name of locations){
  const raw=bank[name];
  // Empty arrays represent newly opened logical 42-slot packs; anything
  // else must be a complete server-exposed 42-slot pack.
  if(!Array.isArray(raw)||raw.length>42)return invalid('unverified-pack-shape');
  const slots=Array.from({length:42},(_,i)=>raw[i]??null);
  const evidence=inventoryStockEvidence(slots,{owner,session,realm,at:now,maxRows:32});
  if(!evidence.complete)return invalid('unverified-pack-inventory:'+evidence.reason);
  packs.push({name,map,size:42,used:evidence.slotCount});
  for(const row of evidence.rows){
   const key=JSON.stringify(row.item);
   const prior=rows.get(key);
   if(!prior&&rows.size>=maxRows)return invalid('bank-variant-overflow');
   if(prior){
    if(prior.quantity+row.quantity>10000000||prior.protectedUnits+row.protectedUnits>10000000)
     return invalid('bank-quantity-overflow');
    prior.quantity+=row.quantity;
    prior.protectedUnits+=row.protectedUnits;
   }else rows.set(key,{...row,item:{...row.item}});
  }
 }
 const snapshot=[...rows.values()];
 function quantity(name,level=0,variant=null){
  if(typeof name!=='string'||!name||!Number.isSafeInteger(level)||level<0||level>99)
   return null;
  let count=0;
  for(const row of snapshot){
   const item=row.item;
   if(item.name!==name||item.level!==level||
    variant&&Object.entries(variant).some(([k,v])=>
     !['stat_type','p','title','acc','rid','data'].includes(k)||
     JSON.stringify(item[k]??null)!==JSON.stringify(v)))continue;
   count+=Math.max(0,row.quantity-row.protectedUnits);
   if(!Number.isSafeInteger(count)||count>10000000)return null;
  }
  return count;
 }
 return {version:1,mode:'shadow-only',authority:'none',
  owner,session,realm,map,at:now,complete:true,reason:null,
  scope:'current-map-only',packs,rows:snapshot,quantity,
  executable:false};
}
