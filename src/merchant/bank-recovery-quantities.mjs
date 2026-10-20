import {identity} from '../core/policy.mjs';

// Read-only proof for exact bank value-journal reconstruction. A plain
// aggregate can hide invalid component stacks (e.g. -2 + 2 = 0 or
// 0.5 + 0.5 = 1). Only a sum of individually observed positive safe
// integer quantities is eligible as a transaction before/after image.
// The implicit one-unit form is valid only when q is actually absent.
export function verifiedBankVariantCount(items,item){
 if(!Array.isArray(items)||!item||typeof item.name!=='string'||!item.name)
  return null;
 const key=identity(item);
 let total=0;
 for(const stock of items){
  if(!stock||identity(stock)!==key)continue;
  const quantity=stock.q===undefined?1:stock.q;
  if(!Number.isSafeInteger(quantity)||quantity<1||
     !Number.isSafeInteger(total+quantity))return null;
  total+=quantity;
 }
 return total;
}
