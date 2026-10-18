// W04: one bounded read-only window over currently visible bank packs.
// Cached catalogues and absent remote packs are NEVER authorization.
export function scanBankDispositionWindow(packs,{
 map,packMap,cursor=0,limit=24,admit=()=>null
}={}){
 const invalid=reason=>({valid:false,reason,scanned:0,total:0,
  nextCursor:0,complete:false,candidates:[]});
 if(!Array.isArray(packs)||packs.length>16||typeof map!=='string'||!map||
    typeof packMap!=='function'||typeof admit!=='function'||
    !Number.isSafeInteger(cursor)||cursor<0||
    !Number.isSafeInteger(limit)||limit<1||limit>64)
  return invalid('invalid-scan-context');
 const local=[],names=new Set();
 for(const entry of packs){
  if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||
     !/^items\d+$/.test(entry[0])||names.has(entry[0])||
     !Array.isArray(entry[1])||entry[1].length>42)
   return invalid('invalid-bank-pack');
  names.add(entry[0]);
  let location;
  try{location=packMap(entry[0]);}catch{return invalid('unknown-pack-map');}
  if(typeof location!=='string'||!location)return invalid('unknown-pack-map');
  if(location===map)local.push(entry);
 }
 if(!local.length)return invalid('no-observed-local-packs');
 const total=local.reduce((sum,[,items])=>sum+Math.max(42,items.length),0);
 if(cursor>total)return invalid('invalid-scan-offset');
 const end=Math.min(total,cursor+limit),candidates=[];
 let offset=0;
 for(const [pack,items] of local){
  const size=Math.max(42,items.length),start=Math.max(0,cursor-offset),
   stop=Math.min(size,end-offset);
  for(let slot=start;slot<stop;slot++){
   const item=items[slot];if(!item)continue;
   const admission=admit(item,pack,slot);
   if(admission)candidates.push({item,pack,slot,admission});
  }
  offset+=size;
  if(offset>=end)break;
 }
 return {valid:true,reason:null,scanned:end-cursor,total,nextCursor:end,
  complete:end===total,candidates};
}
