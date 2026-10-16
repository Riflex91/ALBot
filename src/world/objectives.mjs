import {findRecipe,recipeIngredients} from '../production/recipes.mjs';
import {knowledgeFingerprint} from './knowledge.mjs';

// P1-1 read-only objective DAG. This is intentionally NOT an execution path:
// purchases, mutations, bank retrievals and sends remain exclusively in their
// existing preflighted modules. A graph NEVER authorizes a value operation.
const finite=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const validItem=x=>typeof x==='string'&&x.length>0&&x.length<=80;
const validOwner=x=>typeof x==='string'&&x.length>0&&x.length<=80;
const variantFields=['stat_type','p','title','data'];
const identity=(name,level,variant)=>knowledgeFingerprint([name,level,variant??null]);
const safeCount=(stock,name,level,variant)=>{try{
 const n=stock(name,level,variant);
 return Number.isSafeInteger(n)&&n>=0&&n<=1e7?n:null;
}catch{return null;}};

export function buildObjectiveGraph({
 G,goals=[],stock=()=>null,owner,session,realm,now=Date.now(),ttlMs=120000
}={}){
 const empty=reason=>({version:1,mode:'shadow-only',authority:'none',
  owner,session,realm,at:now,expires:now,reason,roots:[],nodes:[],blocked:true});
 if(!G?.items||!validOwner(owner)||!validOwner(session)||!validOwner(realm)||
    !Number.isFinite(now)||!Array.isArray(goals)||goals.length>16||
    !finite(ttlMs,30000,3600000))return empty('invalid-context');
 const nodes=new Map(),roots=[],active=new Set();
 let expanded=0,blocked=false,reason=null;
 function node(name,level,variant,quantity,depth=0,ancestors=[]){
  if(++expanded>128||depth>8||!validItem(name)||!G.items[name]||
     !finite(level,0,99)||!finite(quantity,1,1000000))
   throw Error('unsupported-or-unbounded-objective');
  const id='item:'+identity(name,level,variant);
  if(ancestors.includes(id))throw Error('cyclic-objective');
  const seen=nodes.get(id);
  if(seen){
   // Merge identical variants and levels, never pretend a unit satisfies
   // two different dependencies. All node quantities are gross demand.
   if(!Number.isSafeInteger(seen.required+quantity)||
      seen.required+quantity>1000000)throw Error('demand-overflow');
   seen.required+=quantity;
   return id;
  }
  const available=safeCount(stock,name,level,variant);
  const item={id,kind:'material',item:name,level,variant:variant??null,
   required:quantity,observed:available,prerequisites:[],state:'candidate',
   blocker:null};
  nodes.set(id,item);
  if(available===null){item.state='blocked';item.blocker='stock-unverified';return id;}
  if(available>=quantity){item.state='fulfilled';return id;}
  const missing=quantity-available,meta=G.items[name];
  if(level>0&&(meta.upgrade||meta.compound)){
   const multiplier=meta.compound?3:1;
   if(missing*multiplier>1000000)throw Error('demand-overflow');
   item.prerequisites.push(node(name,level-1,variant,missing*multiplier,
    depth+1,[...ancestors,id]));
  }else{
   const recipe=level===0?findRecipe(G,name)?.recipe:null;
   if(recipe){
    const yieldCount=recipe.q??recipe.quantity??1;
    if(!finite(yieldCount,1,1000000))throw Error('invalid-recipe-yield');
    const batches=Math.ceil(missing/yieldCount);
    for(const ingredient of recipeIngredients(recipe)){
     const units=ingredient.quantity*batches;
     if(!Number.isSafeInteger(units)||units>1000000)throw Error('demand-overflow');
     item.prerequisites.push(node(ingredient.item,ingredient.level,null,
      units,depth+1,[...ancestors,id]));
    }
   }else{
    item.state='blocked';item.blocker='source-not-verified';
   }
  }
  return id;
 }
 try{
  for(const g of goals){
   if(!g?.enabled)continue;
   if(!validItem(g.item)||!finite(g.level??0,0,99)||
      !finite(g.quantity,1,1000000)||
      typeof g.name!=='string'||g.name.length>100||
      g.variant!==undefined&&g.variant!==null&&(
       typeof g.variant!=='object'||Array.isArray(g.variant)||
       Object.keys(g.variant).some(k=>!variantFields.includes(k)))){
    throw Error('invalid-goal');}
   const goalId='goal:'+knowledgeFingerprint([g.name,g.item,g.level??0,
    g.recipient??'',g.gearSlot??'',g.variant??null]);
   if(roots.some(x=>x.id===goalId))continue;
   const dep=node(g.item,g.level??0,g.variant??null,g.quantity);
   roots.push({id:goalId,kind:g.gearSlot?'gear':'material',
    label:g.name,item:g.item,level:g.level??0,quantity:g.quantity,
    recipient:g.recipient??null,owner,priority:finite(g.priority??0,-10000,10000)?
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
 let last=null,failedPersistence=false;
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
  const items=p.c.items??[];
  const exactStock=(name,level,variant)=>items.reduce((n,item)=>{
   if(item?.name!==name||(item.level??0)!==level)return n;
   if(variant&&variantFields.some(k=>variant[k]!==undefined&&
      JSON.stringify(item[k]??null)!==JSON.stringify(variant[k])))return n;
   return n+(Number.isSafeInteger(item.q)&&item.q>0?item.q:1);
  },0);
  const next=buildObjectiveGraph({
   G:p.G,goals:goalRows,stock:exactStock,owner:me.name,
   realm:currentRealm(),session:bot.session
  });
  last=next;
  // Persist bounded diagnostics, never an actionable queue. A session or
  // realm change invalidates the old candidate; no resumed purchases.
  const stamp=knowledgeFingerprint([next.roots,next.nodes,next.reason,next.realm]);
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
  executable:false
 }),close(){last=null;}};
}
