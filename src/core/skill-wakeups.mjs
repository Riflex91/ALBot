// Bounded, read-only hints for the official Adventure Land next_skill map.
// The official runner resolves G.skills[id].share before inspecting the Date.
// A Date may originate in another browser realm: instanceof Date is not safe.
export function nativeSkillCooldown(p,id){
 const skills=p?.G?.skills,table=p?.parent?.next_skill??p?.root?.next_skill;
 let key=id;const visited=new Set();
 for(let i=0;i<8;i++){
  if(typeof key!=='string'||!key||visited.has(key))
   return {key:null,at:null,reason:'share-cycle'};
  visited.add(key);
  const share=skills?.[key]?.share;
  if(typeof share==='string'&&share){key=share;continue;}
  const raw=table?.[key]??p?.c?.next_skill?.[key];
  if(raw==null)return {key,at:null,reason:'missing-native-deadline'};
  let at=NaN;
  if(typeof raw==='number')at=raw;
  else if(typeof raw==='string')at=Date.parse(raw);
  else if(raw&&typeof raw.getTime==='function'){
   try{at=raw.getTime();}catch{}
  }
  return {key,at:Number.isFinite(at)?at:null,
   reason:Number.isFinite(at)?'native':'invalid-native-format'};
 }
 return {key:null,at:null,reason:'share-depth'};
}
export function createSkillWakeups({now=()=>Date.now(),leaseMs=750}={}){
 const hints=new Map(),samples=[],limit=Math.max(100,Math.min(1000,leaseMs));
 let skips=0,woken=0,invalid=0,missing=0,expired=0,shared=0;
 const stamp=raw=>{
  if(typeof raw==='number')return raw;
  if(typeof raw==='string')return Date.parse(raw);
  if(raw&&typeof raw.getTime==='function'){
   try{return raw.getTime();}catch{}
  }
  return NaN;
 };
 function observe(id,raw,meta={}){
  if(typeof id!=='string'||id.length>45)return false;
  const t=stamp(raw),at=now();
  if(!Number.isFinite(t)){hints.delete(id);
   if(meta.reason==='missing-native-deadline')missing++;else invalid++;
   return false;
  }
  if(t<=at){hints.delete(id);expired++;return false;}
  if(t-at>60000){hints.delete(id);invalid++;return false;}
  if(meta.key&&meta.key!==id)shared++;
  if(!hints.has(id)&&hints.size>=48)hints.delete(hints.keys().next().value);
  hints.set(id,{source:t,key:meta.key??id,until:Math.min(t,at+limit),recordedAt:at});
  return true;
 }
 function blocked(id,raw,key=id){
  const row=hints.get(id);if(!row)return false;
  const at=now(),time=stamp(raw);
  if(!Number.isFinite(time)||time!==row.source||key!==row.key||at>=row.until){
   hints.delete(id);
   if(at>=row.until&&at-row.recordedAt<=60000){
    woken++;samples.push(Math.max(0,at-row.until));
    if(samples.length>128)samples.shift();
   }
   return false;
  }
  skips++;return true;
 }
 // Reschedule only the EXISTING frame timer, never a second timer or loop.
 function nextDelay(base){
  if(!Number.isFinite(base)||base<100)return base;
  const at=now(),floor=Math.max(100,Math.ceil(base/2));let delay=base;
  for(const row of hints.values()){
   if(row.until>at&&row.until<=at+base)
    delay=Math.min(delay,Math.max(floor,row.until-at));
  }
  return delay;
 }
 const quantile=p=>samples.length?[...samples].sort((a,b)=>a-b)[Math.ceil((samples.length-1)*p)]:null;
 return {observe,blocked,nextDelay,clear:id=>hints.delete(id),
  status:()=>({mode:'native-shared-skill-observed',authority:'none',
   active:hints.size,cooldownChecksAvoided:skips,wakes:woken,
   invalid,missingNative:missing,expired,sharedResolved:shared,
   wakeLatenessP95Ms:quantile(.95),wakeLatenessP99Ms:quantile(.99),
   timersCreated:0,extraGameCalls:0}),close:()=>hints.clear()};
}
