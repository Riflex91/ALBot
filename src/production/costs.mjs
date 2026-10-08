import {killQuantile} from './probability.mjs';
import {findRecipe,recipeIngredients} from './recipes.mjs';
import {materialDrops} from './materials.mjs';
// Estimated route economics, never an execution guarantee. Unknown prices/rates
// cannot be turned into a free or instantaneous purchase.
export function estimateRoutes({G,item,level=0,quantity=1,stock=()=>0,bank=()=>0,allowed,permit=()=>true,npcPrice,marketPrice,farmHours,travelHours=()=>0,helpers=()=>[],chance=()=>1,recipeFor=()=>'',strategy='balanced',goldPerHour=100000,maxDepth=8,confidence='mean'}){
 let nodes=0;const weight=x=>strategy==='time'?x.hours+x.gold/Math.max(1,goldPerHour)*.001:strategy==='cost'?x.gold+x.hours*.001:x.gold+x.hours*goldPerHour;
 function routes(name,l,q,seen,depth){
  if(++nodes>256||depth>maxDepth||seen.has(name+':'+l))return [];const next=new Set([...seen,name+':'+l]);q=Math.max(0,q-stock(name,l));if(!q)return [{kind:'stock',gold:0,hours:0}];
  const rows=[],add=(kind,gold,hours)=>{if(Number.isFinite(gold)&&gold>=0&&Number.isFinite(hours)&&hours>=0&&permit(name,l,kind))rows.push({kind,gold,hours,score:weight({gold,hours})});};
  if(allowed.includes('bank')&&bank(name,l)>=q)add('retrieve',0,travelHours('bank',name));
  if(!l&&allowed.includes('npc'))add('buy',npcPrice(name)*q,travelHours('buy',name));
  if(allowed.includes('market'))add('marketBuy',marketPrice(name,l)*q,travelHours('marketBuy',name));
  if(!l&&allowed.includes('farm'))add('farm',0,farmHours(name,q));
  const best=(id,lv,amount)=>routes(id,lv,amount,next,depth+1).sort((a,b)=>(a.score??0)-(b.score??0))[0]??{gold:Infinity,hours:Infinity};
  const found=!l&&allowed.includes('craft')&&findRecipe(G,name,recipeFor(name,l));if(found){const recipe=found.recipe,batches=Math.ceil(q/(recipe.q??recipe.quantity??1));let gold=(recipe.cost??0)*batches,hours=travelHours('craft',name)+batches/3600;
   for(const row of recipeIngredients(recipe)){const estimate=best(row.item,row.level,row.quantity*batches);gold+=estimate.gold;hours+=estimate.hours;}add('craft',gold,hours);
  }
  const meta=G.items?.[name];if(l>0&&(meta?.upgrade||meta?.compound)){
   const kind=meta.compound?'compound':'upgrade',probability=chance(name,l-1,kind);if(probability>0&&probability<=1){const attempts=confidence==='p90'?killQuantile(probability,q,.9):Math.ceil(q/probability),base=best(name,l-1,attempts*(kind==='compound'?3:1));let gold=base.gold,hours=base.hours+travelHours(kind,name)+attempts*10/3600;
    for(const h of helpers(name,l-1,kind)){const estimate=best(h.item,h.level??0,h.quantity*attempts);gold+=estimate.gold;hours+=estimate.hours;}
    // Permission for a mutation is evaluated on its input level.
    if(permit(name,l-1,kind)&&Number.isFinite(gold)&&Number.isFinite(hours))rows.push({kind,gold,hours,score:weight({gold,hours})});
   }
  }
  if(!l&&allowed.includes('exchange'))for(const [source,m] of Object.entries(G.items??{}))if(Number.isSafeInteger(m.e)&&m.e>0&&permit(source,0,'exchange')){
   const drops=materialDrops(G,G.drops?.[source]).filter(x=>x.item===name),yieldCount=drops.reduce((n,x)=>n+x.chance*x.quantity,0);if(!(yieldCount>0))continue;const attempts=confidence==='p90'?killQuantile(Math.min(1,drops.reduce((n,x)=>n+x.chance,0)),Math.ceil(q/Math.min(...drops.map(x=>x.quantity))),.9):Math.ceil(q/yieldCount),estimate=best(source,0,attempts*m.e),gold=estimate.gold,hours=estimate.hours+travelHours('exchange',source)+attempts*6/3600;
   if(Number.isFinite(gold)&&Number.isFinite(hours))rows.push({kind:'exchange',source,gold,hours,score:weight({gold,hours}),probabilistic:true});
  }
  return rows.sort((a,b)=>a.score-b.score);
 }
 return routes(item,level,quantity,new Set(),0);
}
