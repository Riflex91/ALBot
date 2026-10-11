import {killQuantile} from './probability.mjs';
import {materialDrops,exchangeSource} from './materials.mjs';
import {findRecipe,recipeIngredients} from './recipes.mjs';
// Bounded dependency planning: stock -> bank/NPC -> recipe/mutation -> farm.
// Plans never dispatch actions and never override an explicit keep rule.
export function planProduction({G,item,level=0,quantity=1,stock,bank,canBuy,allowed,maxDepth=8,permit=()=>true,score=null,recipeFor=()=>'',helpers=()=>[],confidence='mean',state={}}){
 const steps=[],visiting=new Set(),allocated=new Map(),bankAllocated=new Map(),surplus=new Map();let nodes=0;
 function need(name,l,q,depth){
  const key=name+':'+l;if(++nodes>256)throw Error('Produktionsplan überschreitet 256 Abhängigkeiten');if(!Number.isSafeInteger(q)||q<1)throw Error('Ungültige Produktionsmenge');if(depth>maxDepth)throw Error('Produktionstiefe überschritten: '+key);
  if(visiting.has(key))throw Error('Rezeptzyklus: '+key);
  const extra=surplus.get(key)??0,used=Math.min(q,extra);surplus.set(key,extra-used);q-=used;if(!q)return;
  const available=Math.max(0,stock(name,l)-(allocated.get(key)??0)),take=Math.min(q,available);allocated.set(key,(allocated.get(key)??0)+take);q-=take;if(q<=0)return;
  visiting.add(key);
  try{
   const stored=allowed.includes('bank')&&permit(name,l,'retrieve')?Math.min(q,Math.max(0,bank(name,l,q)-(bankAllocated.get(key)??0))):0;
   if(stored){bankAllocated.set(key,(bankAllocated.get(key)??0)+stored);steps.push({kind:'retrieve',item:name,level:l,quantity:stored});q-=stored;}if(!q)return;
   const found=findRecipe(G,name,recipeFor(name,l)),recipe=found?.recipe;
   const ways=[];if(l===0&&allowed.includes('npc')&&canBuy(name)&&permit(name,l,'buy'))ways.push('buy');
   if(l===0&&recipe&&allowed.includes('craft')&&permit(name,l,'craft'))ways.push('craft');
   if(l>0&&(G.items?.[name]?.upgrade||G.items?.[name]?.compound)&&permit(name,l-1,G.items[name].compound?'compound':'upgrade'))ways.push(G.items[name].compound?'compound':'upgrade');
   const sources=l===0&&allowed.includes('exchange')?Object.entries(G.items??{}).filter(([source,m])=>Number.isSafeInteger(m.e)&&m.e>0&&!visiting.has(source+':0')&&permit(source,0,'exchange')&&exchangeSource(G,source,state).ready&&materialDrops(G,G.drops?.[source]).some(x=>x.item===name)):[];
   if(sources.length)ways.push('exchange');if(allowed.includes('market')&&permit(name,l,'marketBuy'))ways.push('marketBuy');if(allowed.includes('farm')&&permit(name,l,'farm'))ways.push('farm');
   if(score)sources.sort((a,b)=>score({kind:'exchange',item:name,level:l,quantity:q,sources:[a]})-score({kind:'exchange',item:name,level:l,quantity:q,sources:[b]}));
   if(score)ways.sort((a,b)=>score({kind:a,item:name,level:l,quantity:q,recipe,sources})-score({kind:b,item:name,level:l,quantity:q,recipe,sources}));
   const way=ways[0];
   if(score&&way&&!Number.isFinite(score({kind:way,item:name,level:l,quantity:q,recipe,sources})))throw Error('Kein bewertbarer Weg innerhalb der Preis-/Zeitgrenzen: '+key);
   if(way==='buy'){steps.push({kind:'buy',item:name,level:0,quantity:q});return;}
   if(way==='craft'){
    const yieldCount=recipe.q??recipe.quantity??1;if(!Number.isSafeInteger(yieldCount)||yieldCount<1)throw Error('Unbekannte Rezeptmenge: '+name);
    const batches=Math.ceil(q/yieldCount);for(const row of recipeIngredients(recipe))need(row.item,row.level,row.quantity*batches,depth+1);
    surplus.set(key,(surplus.get(key)??0)+batches*yieldCount-q);
    steps.push({kind:'craft',item:name,level:0,quantity:batches,outputQuantity:batches*yieldCount,recipe:found.key});return;
   }
   const meta=G.items?.[name];if(['upgrade','compound'].includes(way)){
    const kind=way;need(name,l-1,q*(kind==='compound'?3:1),depth+1);for(const h of helpers(name,l-1,kind))need(h.item,h.level??0,h.quantity*q,depth+1);steps.push({kind,item:name,level:l-1,targetLevel:l,quantity:q});return;
   }
   if(way==='exchange'){
    for(const [source,meta] of sources){
     const yieldPerExchange=materialDrops(G,G.drops?.[source]).filter(x=>x.item===name).reduce((n,x)=>n+x.chance*x.quantity,0);if(!(yieldPerExchange>0))continue;
     const rewards=materialDrops(G,G.drops?.[source]).filter(x=>x.item===name),probability=Math.min(1,rewards.reduce((n,x)=>n+x.chance,0)),successes=Math.ceil(q/Math.min(...rewards.map(x=>x.quantity)));const attempts=confidence==='p90'?killQuantile(probability,successes,.9):Math.ceil(q/yieldPerExchange);need(source,0,attempts*meta.e,depth+1);const verified=exchangeSource(G,source,state);if(!verified.ready)throw Error('Exchange-Quelle nicht verifiziert: '+source);steps.push({kind:'exchange',item:source,level:0,quantity:attempts,output:name,probabilistic:true,sourceProof:{quest:verified.quest,npc:verified.npc,destination:verified.destination,event:verified.event}});return;
    }
   }
   if(way==='marketBuy'){steps.push({kind:'marketBuy',item:name,level:l,quantity:q});return;}
   if(way==='farm'){steps.push({kind:'farm',item:name,level:l,quantity:q});return;}
   throw Error('Kein freigegebener Beschaffungsweg: '+key);
  }finally{visiting.delete(key);}
 }
 need(item,level,quantity,0);Object.defineProperty(steps,'reservations',{value:[...allocated].filter(([,q])=>q>0).map(([key,quantity])=>({item:key.slice(0,key.lastIndexOf(':')),level:Number(key.slice(key.lastIndexOf(':')+1)),quantity}))});return steps;
}
