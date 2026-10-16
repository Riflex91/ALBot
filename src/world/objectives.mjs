import {findRecipe,recipeIngredients} from '../production/recipes.mjs';
import {knowledgeFingerprint} from './knowledge.mjs';
import {inventoryStockEvidence,reconcileStockEvidence} from '../items/stock-evidence.mjs';

// P1-1 read-only objective DAG. This is intentionally NOT an execution path:
// purchases, mutations, bank retrievals and sends remain exclusively in their
// existing preflighted modules. A graph NEVER authorizes a value operation.
const objectiveFinite=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const objectiveValidItem=x=>typeof x==='string'&&x.length>0&&x.length<=80;
const objectiveValidOwner=x=>typeof x==='string'&&x.length>0&&x.length<=80;
const objectiveVariantFields=['stat_type','p','title','data'];
const objectiveNodeIdentity=(name,level,variant)=>knowledgeFingerprint([name,level,variant??null]);
const objectiveSafeCount=(stock,name,level,variant)=>{try{
 const n=stock(name,level,variant);
 return Number.isSafeInteger(n)&&n>=0&&n<=1e7?n:null;
}catch{return null;}};

export function buildObjectiveGraph({
 G,goals=[],stock=()=>null,owner,session,realm,now=Date.now(),ttlMs=120000
}={}){
 const empty=reason=>({version:1,mode:'shadow-only',authority:'none',
  owner,session,realm,at:now,expires:now,reason,roots:[],nodes:[],blocked:true});
 if(!G?.items||!objectiveValidOwner(owner)||!objectiveValidOwner(session)||!objectiveValidOwner(realm)||
    !Number.isFinite(now)||!Array.isArray(goals)||goals.length>16||
    !objectiveFinite(ttlMs,30000,3600000))return empty('invalid-context');
 const nodes=new Map(),roots=[];
 let expanded=0,blocked=false,reason=null;
 function expand(item,missing,depth,ancestors){
  if(missing<=0)return;
  const {id,level,variant}=item,name=item.item,meta=G.items[name];
  const add=(child)=>{if(!item.prerequisites.includes(child))
   item.prerequisites.push(child);};
  if(level>0&&(meta.upgrade||meta.compound)){
   const units=missing*(meta.compound?3:1);
   if(!Number.isSafeInteger(units)||units>1000000)throw Error('demand-overflow');
   add(node(name,level-1,variant,units,depth+1,[...ancestors,id]));
   return;
  }
  const recipe=level===0?findRecipe(G,name)?.recipe:null;
  if(!recipe){item.state='blocked';item.blocker='source-not-verified';return;}
  const yieldCount=recipe.q??recipe.quantity??1;
  if(!objectiveFinite(yieldCount,1,1000000))throw Error('invalid-recipe-yield');
  for(const ingredient of recipeIngredients(recipe)){
   const units=ingredient.quantity*Math.ceil(missing/yieldCount);
   if(!Number.isSafeInteger(units)||units>1000000)throw Error('demand-overflow');
   add(node(ingredient.item,ingredient.level,null,units,depth+1,[...ancestors,id]));
  }
 }
 function node(name,level,variant,quantity,depth=0,ancestors=[]){
  if(++expanded>128||depth>8||!objectiveValidItem(name)||!G.items[name]||
     !objectiveFinite(level,0,99)||!objectiveFinite(quantity,1,1000000))
   throw Error('unsupported-or-unbounded-objective');
  const id='item:'+objectiveNodeIdentity(name,level,variant);
  if(ancestors.includes(id))throw Error('cyclic-objective');
  const seen=nodes.get(id);
  if(seen){
   // The same physical units cannot satisfy multiple roots. Extra gross
   // demand expands ONLY the new shortfall, with strict variant separation.
   if(!Number.isSafeInteger(seen.required+quantity)||
      seen.required+quantity>1000000)throw Error('demand-overflow');
   const oldMissing=seen.observed===null?0:
    Math.max(0,seen.required-seen.observed);
   seen.required+=quantity;
   const newMissing=seen.observed===null?0:
    Math.max(0,seen.required-seen.observed);
   if(seen.state==='fulfilled'&&newMissing>0)seen.state='candidate';
   expand(seen,newMissing-oldMissing,depth,ancestors);
   return id;
  }
  const available=objectiveSafeCount(stock,name,level,variant);
  const item={id,kind:'material',item:name,level,variant:variant??null,
   required:quantity,observed:available,prerequisites:[],state:'candidate',
   blocker:null};
  nodes.set(id,item);
  if(available===null){item.state='blocked';item.blocker='stock-unverified';return id;}
  if(available>=quantity){item.state='fulfilled';return id;}
  expand(item,quantity-available,depth,ancestors);
  return id;
 }
 try{
  for(const g of goals){
   if(!g?.enabled)continue;
   if(!objectiveValidItem(g.item)||!objectiveFinite(g.level??0,0,99)||
      !objectiveFinite(g.quantity,1,1000000)||
      typeof g.name!=='string'||g.name.length>100||
      g.variant!==undefined&&g.variant!==null&&(
       typeof g.variant!=='object'||Array.isArray(g.variant)||
       Object.keys(g.variant).some(k=>!objectiveVariantFields.includes(k)))){
    throw Error('invalid-goal');}
   const goalId='goal:'+knowledgeFingerprint([g.name,g.item,g.level??0,
    g.recipient??'',g.gearSlot??'',g.variant??null]);
   if(roots.some(x=>x.id===goalId))continue;
   const dep=node(g.item,g.level??0,g.variant??null,g.quantity);
   roots.push({id:goalId,kind:g.gearSlot?'gear':'material',
    label:g.name,item:g.item,level:g.level??0,quantity:g.quantity,
    recipient:g.recipient??null,owner,priority:objectiveFinite(g.priority??0,-10000,10000)?
     g.priority??0:0,prerequisites:[dep],state:'candidate',blocker:null});
  }
  for(const n of nodes.values())if(n.prerequisites.some(x=>nodes.get(x)?.state==='blocked')){
   n.state='blocked';n.blocker='dependency-blocked';}
  for(const root of roots){
   const child=nodes.get(root.prerequisites[0]);
   root.state=child?.state??'blocked';
   root.blocker=child?.blocker??null;
  }
  blocked=roots.some(x=>x.state==='blocked');
  reason=blocked?'unverified-prerequisite':roots.length?'verified-candidate':'no-goal';
 }catch(e){
  // Do not publish partial, potentially inconsistent reservations on failure.
  return empty(e?.message??'invalid-graph');
 }
 return {version:1,mode:'shadow-only',authority:'none',
  owner,session,realm,at:now,expires:now+ttlMs,
  reason,blocked,roots:roots.slice(0,16),
  nodes:[...nodes.values()].slice(0,128)};
}

export function createObjectives(bot){
 const {p,me,cfg}=bot,owns=me.role==='merchant',
  key='albot:objectives:v1:'+me.name;
 let last=null,stockState=null,failedPersistence=false;
 const currentRealm=()=>p.realm();
 function goals(){
  // Only the EXISTING production plan can propose a current objective.
  // No user-invisible extra goal or independently scheduled order.
  const active=bot.production?.activeGoal;
  return active&&typeof active.item==='string'?
   [{...active,enabled:true}]:[];
 }
 function tick(){
  if(!owns||!cfg.production?.enabled)return;
  const goalRows=goals();
  const at=Date.now(),local=inventoryStockEvidence(p.c.items??[],{
   owner:me.name,session:bot.session,realm:currentRealm(),at,
   reserved:i=>bot.production?.reservedQuantity?.(i)??0
  });
  const names=[...new Set((bot.farmers??[]).filter(n=>n!==me.name))];
  stockState=reconcileStockEvidence({
   local,owner:me.name,session:bot.session,realm:currentRealm(),now:at,
   ttlMs:Math.min(120000,cfg.general?.messageTtlMs??10000),
   expected:names,peers:names.map(n=>bot.transport?.fresh?.(n)).filter(Boolean),
   bank:bot.bank?.catalogStock?.()??[]
  });
  const next=buildObjectiveGraph({
   G:p.G,goals:goalRows,stock:stockState.quantity,owner:me.name,
   realm:currentRealm(),session:bot.session
  });
  last=next;
  // Persist bounded diagnostics, never an actionable queue. A session or
  // realm change invalidates the old candidate; no resumed purchases.
  const stamp=knowledgeFingerprint([next.roots,next.nodes,next.reason,next.realm,stockState.complete,stockState.sources]);
  if(stamp===tick.lastStamp)return;
  const record={version:1,mode:'shadow-only',authority:'none',
   realm:next.realm,session:bot.session,owner:me.name,at:next.at,
   expires:next.expires,stamp,rootCount:next.roots.length,
   blocked:next.blocked,reason:next.reason};
  if(p.write?.(key,record)===true){tick.lastStamp=stamp;failedPersistence=false;}
  else failedPersistence=true;
 }
 return {tick,status:()=>({
  ...(last??{version:1,mode:'shadow-only',authority:'none',
   reason:owns?'not-sampled':'merchant-only',roots:[],nodes:[]}),
  persistence:failedPersistence?'unavailable':'bounded',
  inventoryEvidence:stockState?{complete:stockState.complete,reasons:stockState.reasons,sources:stockState.sources,bankAdvisoryCount:stockState.bank.length}:null,
  executable:false
 }),close(){last=null;}};
}
