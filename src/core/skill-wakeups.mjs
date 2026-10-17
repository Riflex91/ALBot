// Phase 3: bounded, engine-observed skill wake hints.
// No timer, no network call and no permission to cast. If a game cooldown
// changes, discard the hint immediately; ready()/Executor remain authoritative.
export function createSkillWakeups({now=()=>Date.now(),leaseMs=750}={}){
 const hints=new Map(),samples=[],limit=Math.max(100,Math.min(1000,leaseMs));
 let skips=0,woken=0,invalid=0;
 const stamp=raw=>raw instanceof Date?raw.getTime():
  typeof raw==='number'?raw:typeof raw==='string'?Date.parse(raw):NaN;
 function observe(id,raw){
  if(typeof id!=='string'||id.length>45)return false;
  const t=stamp(raw),at=now();
  if(!Number.isFinite(t)||t<=at||t-at>60000){hints.delete(id);invalid++;return false;}
  if(!hints.has(id)&&hints.size>=48)hints.delete(hints.keys().next().value);
  hints.set(id,{source:t,until:Math.min(t,at+limit),recordedAt:at});
  return true;
 }
 function blocked(id,raw){
  const row=hints.get(id);if(!row)return false;
  const at=now(),time=stamp(raw);
  if(!Number.isFinite(time)||time!==row.source||at>=row.until){
   hints.delete(id);
   if(at>=row.until&&at-row.recordedAt<=60000){
    woken++;samples.push(Math.max(0,at-row.until));
    if(samples.length>128)samples.shift();
   }
   return false;
  }
  skips++;return true;
 }
 // One already-existing scheduler timer may be brought forward to the
 // observed deadline. Never create a second frame, and never poll faster
 // than twice the configured combat interval (minimum 100 ms).
 function nextDelay(base){
  if(!Number.isFinite(base)||base<100)return base;
  const at=now(),floor=Math.max(100,Math.ceil(base/2));
  let delay=base;
  for(const row of hints.values()){
   if(row.until<=at||row.until>at+base)continue;
   delay=Math.min(delay,Math.max(floor,row.until-at));
  }
  return delay;
 }
 const quantile=p=>samples.length?[...samples].sort((a,b)=>a-b)[Math.ceil((samples.length-1)*p)]:null;
 return {observe,blocked,nextDelay,clear:id=>hints.delete(id),
  status:()=>({mode:'engine-observed-bounded',authority:'none',
   active:hints.size,cooldownChecksAvoided:skips,wakes:woken,invalid,
   wakeLatenessP95Ms:quantile(.95),wakeLatenessP99Ms:quantile(.99),
   timersCreated:0,extraGameCalls:0}),close:()=>hints.clear()};
}
