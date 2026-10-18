import {identity,protectedItem} from '../core/policy.mjs';

// G01: The official inventory's signed free-space calculation is
// character.isize - character.items.length + empty entries. Overflow rows
// remain owned inventory, but they do not grant ordinary receiving slots.
// Callers with live character data pass isize; the legacy test-only fallback
// assumes a normal array (at most the documented 42-slot base size).
export function physicalInventoryCapacity(items,{inventorySize}={}){
 if(!Array.isArray(items))return null;
 const size=inventorySize===undefined?
  Math.min(items.length,42):inventorySize;
 if(!Number.isSafeInteger(size)||size<0)return null;
 const empty=items.reduce((n,i)=>n+(!i?1:0),0);
 const signedFree=size-items.length+empty;
 if(!Number.isSafeInteger(signedFree))return null;
 return {inventorySize:size,observedLength:items.length,emptyEntries:empty,
  signedFree,free:Math.max(0,signedFree),overflowDebt:Math.max(0,-signedFree),
  overflowEntries:Math.max(0,items.length-size),
  overflowOccupied:items.slice(size).filter(Boolean).length,
  occupied:items.length-empty};
}

// Shared physical post-consumption capacity for incoming transfers, NPC buys
// and recipe outputs. A candidate slot is freed ONLY when the whole stack is
// consumed, and only when signed inventory capacity permits it.
// This is a planning proof, not a reservation or dispatch permission.
export function capacityAfterConsumption(items,consumed=[],output=null,meta=null,{
 maxNewSlots=Infinity,inventorySize
}={}){
 if(!Array.isArray(items)||!Array.isArray(consumed)||(
  maxNewSlots!==Infinity&&(!Number.isSafeInteger(maxNewSlots)||maxNewSlots<0)
 ))return null;
 const next=items.slice(),seen=new Set();
 for(const row of consumed){
  if(!Number.isSafeInteger(row?.slot)||row.slot<0||row.slot>=items.length||
     seen.has(row.slot)||!Number.isSafeInteger(row.quantity)||row.quantity<1)return null;
  seen.add(row.slot);
  const entry=items[row.slot],q=entry?.q??1;
  if(protectedItem(entry)||!Number.isSafeInteger(q)||q<1||row.quantity>q)return null;
  next[row.slot]=q===row.quantity?null:{...entry,q:q-row.quantity};
 }
 const capacity=physicalInventoryCapacity(next,{inventorySize});
 if(!capacity)return null;
 const {free}=capacity;
 if(!output)return {...capacity,units:free,maxStack:1,headroom:0};
 if(typeof output.name!=='string'||!output.name||!meta)return null;
 const max=meta.s===true?9999:
  Number.isSafeInteger(meta.s)&&meta.s>1?meta.s:1;
 let headroom=0;
 if(max>1)for(const entry of next){
  if(!entry||protectedItem(entry)||identity(entry)!==identity(output))continue;
  const q=entry.q??1;
  if(Number.isSafeInteger(q)&&q>0&&q<=max){
   if(!Number.isSafeInteger(headroom+(max-q)))return null;
   headroom+=max-q;
  }
 }
 const newSlots=Math.min(free,maxNewSlots);
 return {...capacity,headroom,maxStack:max,
  units:Math.min(Number.MAX_SAFE_INTEGER,headroom+newSlots*max)};
}
