import {identity} from '../core/policy.mjs';

// Bank packs are compact in the Adventure Land game. A short array has
// implicit trailing empty slots, not necessarily missing network content.
// Any actually OBSERVED malformed row is still an uncertainty boundary.
export function observedBankPackPhysical(pack,G=null){
 if(!Array.isArray(pack)||pack.length>42)return false;
 for(const row of pack){
  if(row===null||row===undefined)continue;
  if(typeof row!=='object'||Array.isArray(row)||
     typeof row.name!=='string'||!row.name)return false;
  const qty=row.q===undefined?1:row.q;
  if(!Number.isSafeInteger(qty)||qty<1)return false;
  if(G!==null){
   const meta=G?.items;
   if(!meta||!Object.hasOwn(meta,row.name)||!meta[row.name]||
      typeof meta[row.name]!=='object')return false;
   const s=meta[row.name].s;
   const max=s===true?9999:Number.isSafeInteger(s)&&s>1?s:1;
   if(qty>max)return false;
  }
 }
 return true;
}

// Read-only proof for exact bank value-journal reconstruction. A plain
// aggregate can hide invalid component stacks (e.g. -2 + 2 = 0 or
// 0.5 + 0.5 = 1). Only a sum of individually observed positive safe
// integer quantities is eligible as a transaction before/after image.
// The implicit one-unit form is valid only when q is actually absent.
export function verifiedBankVariantCount(items,item,G=null){
 if(!Array.isArray(items)||!item||typeof item.name!=='string'||!item.name)
  return null;
 // The ordinary read-only helper remains compatible with older callers
 // that have no definitions; VALUE-bearing bank-reclaim callers supply G.
 const meta=G?.items?.[item.name];
 if(G&&!meta)return null;
 const limit=meta?.s===true?9999:
  Number.isSafeInteger(meta?.s)&&meta.s>1?meta.s:1;
 let key;
 try{key=identity(item);}catch{return null;}
 if(typeof key!=='string'||!key||key.length>2048)return null;
 let total=0;
 for(const stock of items){
  if(!stock)continue;
  let same;
  try{same=identity(stock)===key;}catch{return null;}
  if(!same)continue;
  const quantity=stock.q===undefined?1:stock.q;
  if(!Number.isSafeInteger(quantity)||quantity<1||
     (G&&quantity>limit)||
     !Number.isSafeInteger(total+quantity))return null;
  total+=quantity;
 }
 return total;
}
