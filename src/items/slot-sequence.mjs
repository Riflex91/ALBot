import {identity,protectedItem} from '../core/policy.mjs';
import {physicalInventoryCapacity} from './physical-capacity.mjs';

// W03: bounded PHYSICAL proof, never a rule, value-dispatch or receipt.
// Every candidate must be explicitly admitted by its caller. The real
// executor rechecks current rules, budgets, journal, inventory and recipient.
const MAX_STEPS=8,MAX_STATES=256;
// An absent q is a single unstacked item. An explicitly null, zero,
// fractional or otherwise invalid q is NOT physical quantity evidence.
const qty=i=>i?.q===undefined?1:i.q;
const positive=n=>Number.isSafeInteger(n)&&n>0;
const clone=items=>items.map(i=>i?{...i}:null);
const sig=items=>JSON.stringify(items.map(i=>i?[identity(i),qty(i)]:null));
function stackLimit(meta){
 return meta?.s===true?9999:
  Number.isSafeInteger(meta?.s)&&meta.s>1?meta.s:1;
}
function canUse(items,slot,n){
 const item=items[slot];
 return Number.isSafeInteger(slot)&&slot>=0&&slot<items.length&&
  !protectedItem(item)&&positive(qty(item))&&positive(n)&&n<=qty(item);
}
function openSlot(items,size){
 // Overflow holes never create ordinary workspace. Check signed capacity
 // FIRST, then use an addressed empty normal slot, or append if shorter.
 if(!(physicalInventoryCapacity(items,{inventorySize:size})?.free>0))return -1;
 const found=items.findIndex((i,n)=>n<size&&!i);
 if(found>=0)return found;
 return items.length<size?items.length:-1;
}
function addOutput(items,raw,amount,G,size,wholeSlot=false){
 if(!raw||typeof raw.name!=='string'||!raw.name||!G?.items?.[raw.name]||
    !positive(amount)||protectedItem(raw)||
    (raw.q!==undefined&&(!positive(raw.q)||raw.q!==amount)))return null;
 const item={...raw};delete item.q;
 const limit=stackLimit(G.items[item.name]);
 if(wholeSlot){
  if(amount>limit)return null;
  const slot=openSlot(items,size);if(slot<0)return null;
  items[slot]={...item,...(amount!==1?{q:amount}:{})};
  return {newSlots:1,mergedUnits:0,slots:[slot]};
 }
 let remaining=amount,mergedUnits=0,newSlots=0;
 const slots=[];
 if(limit>1)for(let slot=0;slot<items.length&&remaining;slot++){
  const old=items[slot];
  if(!old||protectedItem(old)||identity(old)!==identity(item))continue;
  const held=qty(old);
  if(!positive(held)||held>limit)return null;
  const put=Math.min(remaining,limit-held);
  if(put>0){items[slot]={...old,q:held+put};remaining-=put;
   mergedUnits+=put;slots.push(slot);}
 }
 while(remaining>0){
  const slot=openSlot(items,size);if(slot<0)return null;
  const put=Math.min(remaining,limit);
  items[slot]={...item,...(put!==1?{q:put}:{})};
  slots.push(slot);newSlots++;remaining-=put;
 }
 return {newSlots,mergedUnits,slots};
}
function apply(items,step,G,size){
 const next=clone(items),kind=step.kind;
 let consumed=[],placed=[],newSlots=0,mergedUnits=0;
 if(kind==='remove'){
  if(!canUse(next,step.slot,step.quantity))return null;
  const item=next[step.slot],left=qty(item)-step.quantity;
  next[step.slot]=left?{...item,q:left}:null;
  consumed=[{slot:step.slot,quantity:step.quantity}];
 }else if(kind==='merge'){
  const a=step.source,b=step.destination;
  if(a===b||!canUse(next,a,qty(next[a]))||
     !canUse(next,b,qty(next[b]))||
     identity(next[a])!==identity(next[b]))return null;
  const limit=stackLimit(G?.items?.[next[a].name]),total=qty(next[a])+qty(next[b]);
  if(limit<2||!Number.isSafeInteger(total)||total>limit)return null;
  next[b]={...next[b],q:total};next[a]=null;
  consumed=[{slot:a,quantity:qty(items[a])}];mergedUnits=qty(items[a]);
  placed=[b];
 }else if(kind==='withdraw'||kind==='receive'){
  if(kind==='withdraw'&&qty(step.item)!==step.quantity)return null;
  const result=addOutput(next,step.item,step.quantity,G,size,kind==='withdraw');
  if(!result)return null;
  placed=result.slots;newSlots=result.newSlots;mergedUnits=result.mergedUnits;
 }else if(kind==='produce'){
  if(!Array.isArray(step.inputs)||!step.inputs.length||
     !Array.isArray(step.outputs)||!step.outputs.length||
     step.inputs.length>9||step.outputs.length>8)return null;
  const touched=new Set();
  for(const row of step.inputs){
   if(touched.has(row.slot)||!canUse(next,row.slot,row.quantity))return null;
   touched.add(row.slot);
   const old=next[row.slot],left=qty(old)-row.quantity;
   next[row.slot]=left?{...old,q:left}:null;
   consumed.push({slot:row.slot,quantity:row.quantity});
  }
  for(const out of step.outputs){
   const result=addOutput(next,out.item,out.quantity,G,size);
   if(!result)return null;
   placed.push(...result.slots);newSlots+=result.newSlots;
   mergedUnits+=result.mergedUnits;
  }
 }else return null;
 const before=physicalInventoryCapacity(items,{inventorySize:size}),
  after=physicalInventoryCapacity(next,{inventorySize:size});
 if(!before||!after)return null;
 return {items:next,observation:{
  id:step.id,kind,beforeSignedFree:before.signedFree,
  afterSignedFree:after.signedFree,
  freedNormalSlots:Math.max(0,after.free-before.free),
  consumed,outputSlots:placed,newSlots,mergedUnits,
  postActionConfirmationRequired:true}};
}
// Search over permitted, individually verifiable actions. A missing first
// workspace slot can be cleared by an eligible whole-stack operation rather
// than letting a greedy first withdrawal declare the whole plan impossible.
// No action in the returned path has been performed.
export function planPhysicalSlotSequence(items,steps,G,{
 inventorySize=42,maxStates=MAX_STATES,maxSteps=MAX_STEPS,
 requiredIds=steps?.map(s=>s.id)
}={}){
 const fail=(reason,visited=0)=>({feasible:false,reason,visited,
  executable:false,confirmed:false,steps:[]});
 if(!Array.isArray(items)||!Array.isArray(steps)||!G?.items||
    !Number.isSafeInteger(inventorySize)||inventorySize<0||
    !Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>MAX_STEPS||
    !Number.isSafeInteger(maxStates)||maxStates<1||maxStates>MAX_STATES||
    steps.length>maxSteps||steps.length>30||
    !Array.isArray(requiredIds))return fail('invalid-or-unbounded-request');
 const start=physicalInventoryCapacity(items,{inventorySize});
 if(!start||items.some(i=>i!==null&&i!==undefined&&
    (typeof i!=='object'||Array.isArray(i)||
     typeof i.name!=='string'||!i.name||!positive(qty(i))||
     // An observed source cannot contain more than its game's stack limit.
     // Unknown metadata permits only an ordinary unstacked single item.
     qty(i)>stackLimit(G.items[i.name]))))
  return fail('invalid-inventory');
 const ids=new Set();
 for(const s of steps){
  if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||
     s.permitted!==true||!['remove','merge','receive','withdraw','produce'].includes(s.kind)||
     (s.kind==='produce'&&(s.deterministic!==true||Array.isArray(s.outcomes)))||
     !Array.isArray(s.after??[])||(s.after??[]).some(id=>typeof id!=='string'))
   return fail('invalid-or-unpermitted-step');
  ids.add(s.id);
 }
 if(requiredIds.some(id=>!ids.has(id))||
    steps.some(s=>(s.after??[]).some(id=>!ids.has(id))))
  return fail('unknown-step-dependency');
 const required=new Set(requiredIds),queue=[{items:clone(items),done:new Set(),path:[]}];
 const seen=new Set(),key=s=>JSON.stringify([...s.done].sort())+sig(s.items);
 let visited=0,front=0;
 while(front<queue.length){
  if(visited>=maxStates)return fail('search-limit',visited);
  const node=queue[front++],fingerprint=key(node);
  if(seen.has(fingerprint))continue;
  seen.add(fingerprint);visited++;
  if([...required].every(id=>node.done.has(id))){
   return {feasible:true,reason:'physical-sequence-proven',visited,
    executable:false,confirmed:false,steps:node.path,
    before:start,after:physicalInventoryCapacity(node.items,{inventorySize}),
    nextStep:node.path[0]??null,
    nextRecheck:'after each observed and confirmed real executor action'};
  }
  for(const step of steps){
   if(node.done.has(step.id)||(step.after??[]).some(id=>!node.done.has(id)))
    continue;
   const next=apply(node.items,step,G,inventorySize);
   if(!next)continue;
   const done=new Set(node.done);done.add(step.id);
   queue.push({items:next.items,done,
    path:[...node.path,next.observation]});
  }
 }
 return fail('no-proven-physical-sequence',visited);
}
