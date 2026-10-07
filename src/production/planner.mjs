import {materialDrops} from './materials.mjs';
// Bounded dependency planning: stock -> bank/NPC -> recipe/mutation -> farm.
// Plans never dispatch actions and never override an explicit keep rule.
export function planProduction({G,item,level=0,quantity=1,stock,bank,canBuy,allowed,maxDepth=8}){
 const steps=[],visiting=new Set(),allocated=new Map(),bankAllocated=new Map(),surplus=new Map();let nodes=0;
 function need(name,l,q,depth){
  const key=name+':'+l;if(++nodes>256)throw Error('Produktionsplan überschreitet 256 Abhängigkeiten');if(!Number.isSafeInteger(q)||q<1)throw Error('Ungültige Produktionsmenge');if(depth>maxDepth)throw Error('Produktionstiefe überschritten: '+key);
  if(visiting.has(key))throw Error('Rezeptzyklus: '+key);
  const extra=surplus.get(key)??0,used=Math.min(q,extra);surplus.set(key,extra-used);q-=used;if(!q)return;
  const available=Math.max(0,stock(name,l)-(allocated.get(key)??0)),take=Math.min(q,available);allocated.set(key,(allocated.get(key)??0)+take);q-=take;if(q<=0)return;
  visiting.add(key);
  try{
   const stored=allowed.includes('bank')?Math.min(q,Math.max(0,bank(name,l)-(bankAllocated.get(key)??0))):0;
   if(stored){bankAllocated.set(key,(bankAllocated.get(key)??0)+stored);steps.push({kind:'retrieve',item:name,level:l,quantity:stored});q-=stored;}if(!q)return;
   if(l===0&&allowed.includes('npc')&&canBuy(name)){steps.push({kind:'buy',item:name,level:0,quantity:q});return;}
   const recipe=G.craft?.[name];
   if(l===0&&recipe&&allowed.includes('craft')){
    const yieldCount=recipe.q??recipe.quantity??1;if(!Number.isSafeInteger(yieldCount)||yieldCount<1)throw Error('Unbekannte Rezeptmenge: '+name);
    const batches=Math.ceil(q/yieldCount);for(const row of recipe.items??[]){if(!Array.isArray(row)||!Number.isFinite(row[0])||row[0]<=0||!row[1])throw Error('Unbekanntes Rezept: '+name);need(row[1],row[2]??0,row[0]*batches,depth+1);}
    surplus.set(key,(surplus.get(key)??0)+batches*yieldCount-q);
    steps.push({kind:'craft',item:name,level:0,quantity:batches});return;
   }
   const meta=G.items?.[name];if(l>0&&(meta?.upgrade||meta?.compound)){
    const kind=meta.compound?'compound':'upgrade';need(name,l-1,q*(kind==='compound'?3:1),depth+1);steps.push({kind,item:name,level:l-1,targetLevel:l,quantity:q});return;
   }
   if(l===0&&allowed.includes('exchange')){
    for(const [source,meta] of Object.entries(G.items??{})){if(!Number.isSafeInteger(meta.e)||meta.e<1||visiting.has(source+':0'))continue;
     const yieldPerExchange=materialDrops(G,G.drops?.[source]).filter(x=>x.item===name).reduce((n,x)=>n+x.chance*x.quantity,0);if(!(yieldPerExchange>0))continue;
     const attempts=Math.ceil(q/yieldPerExchange);need(source,0,attempts*meta.e,depth+1);steps.push({kind:'exchange',item:source,level:0,quantity:attempts,output:name,probabilistic:true});return;
    }
   }
   if(allowed.includes('market')){steps.push({kind:'marketBuy',item:name,level:l,quantity:q});return;}
   if(allowed.includes('farm')){steps.push({kind:'farm',item:name,level:l,quantity:q});return;}
   throw Error('Kein freigegebener Beschaffungsweg: '+key);
  }finally{visiting.delete(key);}
 }
 need(item,level,quantity,0);return steps;
}
