import {findRecipe,recipeIngredients} from './recipes.mjs';
import {identity} from '../core/policy.mjs';
// A shared finite demand ledger. Different goals consume disjoint stock;
// matching recipes sum their ingredients rather than taking a maximum.
export function purposeReservations({G,goals,stock,delivered=()=>0,exclude=null,recipient='',recipientItem=null}){
 const reserved=new Map(),used=new Map();let nodes=0;
 const key=(name,level,variant)=>JSON.stringify([name,level,variant??null]);
 function need(name,level,quantity,variant,path=[]){
  if(!Number.isSafeInteger(quantity)||quantity<0||++nodes>256||path.length>8)throw Error('bounded-demand');
  if(!quantity)return;
  const k=key(name,level,variant);if(path.includes(k))throw Error('cyclic-demand');
  const previous=reserved.get(k);reserved.set(k,{item:name,level,variant,quantity:(previous?.quantity??0)+quantity});
  const stockKey=key(name,level,null);
  const available=Math.max(0,stock(name,level,variant)-(used.get(stockKey)??0));
  const take=Math.min(quantity,available);used.set(stockKey,(used.get(stockKey)??0)+take);const missing=quantity-take;
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
  if(goals.length>64)throw Error('goal-limit');
  for(const g of goals){
   if(!g.enabled||exclude&&JSON.stringify([g.name,g.item,g.level,g.recipient,g.gearSlot])===JSON.stringify([exclude.name,exclude.item,exclude.level,exclude.recipient,exclude.gearSlot])||recipient&&g.recipient===recipient&&g.item===recipientItem?.name&&g.level===(recipientItem.level??0))continue;
   need(g.item,g.level,Math.max(0,g.quantity-(g.recipient?delivered(g):0)),g.variant);
  }
 }catch(e){return {blocked:true,reason:e.message,rows:[],quantity:()=>Infinity};}
 const rows=[...reserved.values()];
 return {blocked:false,rows,quantity:i=>rows.filter(r=>r.item===i.name&&r.level===(i.level??0)&&
  (!r.variant||identity({name:r.item,level:r.level,...r.variant})===identity(i))).reduce((n,r)=>n+r.quantity,0)};
}
