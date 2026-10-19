import {findRecipe,recipeIngredients} from './recipes.mjs';
import {identity} from '../core/policy.mjs';
// A shared finite demand ledger. Different goals consume disjoint stock;
// matching recipes sum their ingredients rather than taking a maximum.
export function purposeReservations({G,goals,stock,delivered=()=>0,exclude=null,recipient='',recipientItem=null}){
 // Named variants consume independent physical copies, but every copy
 // still belongs to the same inclusive item/level stock pool. Generic
 // demand cannot be attributed to a particular variant after consumption.
 const reserved=new Map(),totalUsed=new Map(),genericUsed=new Map(),
  exactUsed=new Map();let nodes=0;
 const key=(name,level,variant)=>JSON.stringify([name,level,variant??null]);
 // The exact stock variant can never replace the item/level being
 // reserved. A malformed goal is not an unrestricted ("generic") goal.
 function exactVariant(name,level,variant){
  if(variant===null||variant===undefined)return null;
  if(!variant||typeof variant!=='object'||Array.isArray(variant)||
     Object.hasOwn(variant,'name')&&variant.name!==name||
     Object.hasOwn(variant,'level')&&variant.level!==level)
   throw Error('invalid-purpose-variant');
  const serialized=JSON.stringify(variant);
  if(typeof serialized!=='string'||serialized.length>2048)
   throw Error('invalid-purpose-variant');
  const canonical=identity({...variant,name,level});
  if(typeof canonical!=='string'||!canonical||canonical.length>512)
   throw Error('invalid-purpose-variant');
  return canonical;
 }
 function need(name,level,quantity,variant,path=[]){
  if(!Number.isSafeInteger(quantity)||quantity<0||++nodes>256||path.length>8)
   throw Error('bounded-demand');
  if(typeof name!=='string'||!name||name.length>120||
     !Number.isSafeInteger(level)||level<0||level>99)
   throw Error('invalid-purpose-target');
  // Validate even a fully stocked goal: no spoofed exact variant may
  // influence gross reservations or downstream disposition decisions.
  const exactKey=exactVariant(name,level,variant);
  if(!quantity)return;
  const k=key(name,level,variant);if(path.includes(k))throw Error('cyclic-demand');
  const previous=reserved.get(k),gross=(previous?.quantity??0)+quantity;
  if(!Number.isSafeInteger(gross))throw Error('bounded-demand');
  reserved.set(k,{item:name,level,variant,quantity:gross});
  const stockKey=key(name,level,null);
  const total=stock(name,level,null),already=totalUsed.get(stockKey)??0;
  if(!Number.isSafeInteger(total)||total<0||already>total)
   throw Error('unverified-stock');
  let available=total-already,variantKey=null;
  if(variant!==null&&variant!==undefined){
   // Two distinct exact variants have disjoint stocks, whereas an earlier
   // unrestricted goal could have used ANY variant. Subtract all generic
   // usage conservatively from each still-unknown variant composition.
   variantKey=exactKey;
   const exact=stock(name,level,variant);
   if(!Number.isSafeInteger(exact)||exact<0||exact>total)
    throw Error('unverified-stock');
   available=Math.min(available,
    exact-(exactUsed.get(variantKey)??0)-(genericUsed.get(stockKey)??0));
  }
  const take=Math.min(quantity,Math.max(0,available));
  if(!Number.isSafeInteger(already+take))throw Error('bounded-demand');
  totalUsed.set(stockKey,already+take);
  if(variantKey!==null)exactUsed.set(variantKey,
   (exactUsed.get(variantKey)??0)+take);
  else genericUsed.set(stockKey,(genericUsed.get(stockKey)??0)+take);
  const missing=quantity-take;
  if(!missing)return;
  if(level>0&&(G.items?.[name]?.upgrade||G.items?.[name]?.compound)){
   need(name,level-1,missing*(G.items[name].compound?3:1),variant,[...path,k]);return;
  }
  const recipe=level===0?findRecipe(G,name)?.recipe:null;
  if(!recipe)return;
  const yieldCount=recipe.q??recipe.quantity??1;if(!Number.isSafeInteger(yieldCount)||yieldCount<1)throw Error('invalid-yield');
  for(const row of recipeIngredients(recipe))need(row.item,row.level,row.quantity*Math.ceil(missing/yieldCount),null,[...path,k]);
 }
 try{
  if(!Array.isArray(goals)||goals.length>64||
     typeof stock!=='function'||typeof delivered!=='function')
   throw Error('goal-limit');
  for(const g of goals){
   if(!g||typeof g!=='object')throw Error('invalid-purpose-goal');
   if(!g.enabled||exclude&&JSON.stringify([g.name,g.item,g.level,g.recipient,g.gearSlot])===JSON.stringify([exclude.name,exclude.item,exclude.level,exclude.recipient,exclude.gearSlot])||recipient&&g.recipient===recipient&&g.item===recipientItem?.name&&g.level===(recipientItem.level??0))continue;
   const settled=g.recipient?delivered(g):0;
   if(!Number.isSafeInteger(settled)||settled<0||
      !Number.isSafeInteger(g.quantity)||g.quantity<0)
    throw Error('invalid-purpose-demand');
   // A formerly larger goal may have a confirmed delivered amount above
   // the current smaller target; that goal is satisfied, not a fault.
   need(g.item,g.level,Math.max(0,g.quantity-settled),g.variant);
  }
 }catch(e){return {blocked:true,reason:e.message,rows:[],quantity:()=>Infinity};}
 const rows=[...reserved.values()];
 return {blocked:false,rows,quantity:i=>{
  // This count protects physical value actions. An unknown identity is
  // maximum reserved stock, not an exception or a free copy.
  if(!i||typeof i.name!=='string'||!i.name||
     !Number.isSafeInteger(i.level??0))return Infinity;
  let id;
  try{id=identity(i);}
  catch{return Infinity;}
  if(typeof id!=='string'||!id||id.length>512)return Infinity;
  let total=0;
  for(const r of rows){
   if(r.item!==i.name||r.level!==(i.level??0))continue;
   if(r.variant!==null&&r.variant!==undefined){
    let exact;
    try{exact=exactVariant(r.item,r.level,r.variant);}
    catch{return Infinity;}
    if(exact!==id)continue;
   }
   if(!Number.isSafeInteger(r.quantity)||r.quantity<0||
      !Number.isSafeInteger(total+r.quantity))return Infinity;
   total+=r.quantity;
  }
  return total;
 }};
}
