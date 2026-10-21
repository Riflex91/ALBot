import {identity,protectedItem} from '../core/policy.mjs';

// Only an ABSENT q is a physical singleton. An explicit null, zero or
// fractional q cannot establish an item source, even when the slot looks full.
const units=item=>item?.q===undefined?1:item.q;
const validUnits=n=>Number.isSafeInteger(n)&&n>0;
function validPhysicalRow(item){
 return !!item&&typeof item==='object'&&!Array.isArray(item)&&
  typeof item.name==='string'&&item.name.length>0&&
  validUnits(units(item));
}

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
 // This is used at transfer acknowledgements and value preflights: a
 // corrupted occupied row is not a license to buy/receive into some other
 // slot. In particular, do not silently normalize q:null to one unit.
 if(items.some(item=>item!==null&&item!==undefined&&!validPhysicalRow(item)))
  return null;
 const next=items.slice(),seen=new Set();
 for(const row of consumed){
  if(!Number.isSafeInteger(row?.slot)||row.slot<0||row.slot>=items.length||
     seen.has(row.slot)||!Number.isSafeInteger(row.quantity)||row.quantity<1)return null;
  seen.add(row.slot);
  const entry=items[row.slot],q=units(entry);
  if(!validPhysicalRow(entry)||protectedItem(entry)||
     row.quantity>q)return null;
  next[row.slot]=q===row.quantity?null:{...entry,q:q-row.quantity};
 }
 const capacity=physicalInventoryCapacity(next,{inventorySize});
 if(!capacity)return null;
 const {free}=capacity;
 if(!output)return {...capacity,units:free,maxStack:1,headroom:0};
 if(!output||typeof output!=='object'||Array.isArray(output)||
    typeof output.name!=='string'||!output.name||!meta)return null;
 const max=meta.s===true?9999:
  Number.isSafeInteger(meta.s)&&meta.s>1?meta.s:1;
 if(output.q!==undefined&&(!validUnits(output.q)||output.q>max))
  return null;
 let headroom=0;
 if(max>1)for(const entry of next){
  if(!entry)continue;
  let same;
  try{same=identity(entry)===identity(output);}catch{return null;}
  if(!same)continue;
  const q=units(entry);
  // A malformed or overstacked matching row cannot be ignored while
  // claiming that a different slot is safe to receive the same variant.
  if(!validUnits(q)||q>max)return null;
  if(protectedItem(entry))continue;
  if(!Number.isSafeInteger(headroom+(max-q)))return null;
  headroom+=max-q;
 }
 const newSlots=Math.min(free,maxNewSlots);
 return {...capacity,headroom,maxStack:max,
  units:Math.min(Number.MAX_SAFE_INTEGER,headroom+newSlots*max)};
}
