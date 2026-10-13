import {identity,protectedItem} from '../core/policy.mjs';

// Shared physical post-consumption capacity for incoming transfers, NPC buys
// and recipe outputs. A candidate slot is freed ONLY when the whole stack is
// consumed; an existing stack contributes its exact remaining unit headroom.
// This is a planning proof, not an inventory reservation or a dispatch permit.
export function capacityAfterConsumption(items,consumed=[],output=null,meta=null,{maxNewSlots=Infinity}={}){
 if(!Array.isArray(items)||!Array.isArray(consumed))return null;
 const next=items.slice(),seen=new Set();
 for(const row of consumed){
  if(!Number.isSafeInteger(row?.slot)||row.slot<0||row.slot>=items.length||
     seen.has(row.slot)||!Number.isSafeInteger(row.quantity)||row.quantity<1)return null;
  seen.add(row.slot);
  const entry=items[row.slot],q=entry?.q??1;
  if(protectedItem(entry)||!Number.isSafeInteger(q)||q<1||row.quantity>q)return null;
  next[row.slot]=q===row.quantity?null:{...entry,q:q-row.quantity};
 }
 const free=next.reduce((n,i)=>n+(!i?1:0),0);
 if(!output)return {free,units:free,maxStack:1,headroom:0};
 if(typeof output.name!=='string'||!output.name||!meta)return null;
 const max=meta.s===true?9999:Number.isSafeInteger(meta.s)&&meta.s>1?meta.s:1;
 let headroom=0;
 if(max>1)for(const entry of next){
  if(!entry||protectedItem(entry)||identity(entry)!==identity(output))continue;
  const q=entry.q??1;
  if(Number.isSafeInteger(q)&&q>0&&q<=max)headroom+=max-q;
 }
 if(maxNewSlots!==Infinity&&(!Number.isSafeInteger(maxNewSlots)||maxNewSlots<0))return null;
 const newSlots=Math.min(free,maxNewSlots);
 return {free,headroom,maxStack:max,units:Math.min(Number.MAX_SAFE_INTEGER,headroom+newSlots*max)};
}
