// Bounded, in-process telemetry. No polling, network calls or event-loop
// wake-ups. Use elapsed wall time as a CPU-load proxy, NEVER label it CPU use.
export function createRuntimeMetrics({now=()=>Date.now(),capacity=128}={}){
 const cap=Math.max(8,Math.min(256,Math.floor(capacity)));
 const byModule=new Map(),actions=new Map();
 let started=now(),frames=0,frameTotal=0,maxFrame=0;
 const validMs=ms=>Number.isFinite(ms)&&ms>=0&&ms<=600000;
 const samples=(name,ms)=>{if(!validMs(ms))return;
  let x=byModule.get(name);
  if(!x){x={n:0,total:0,values:[]};byModule.set(name,x);}
  x.n++;x.total+=ms;x.values.push(ms);
  if(x.values.length>cap)x.values.shift();
 };
 const quantile=(values,q)=>{if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.ceil((sorted.length-1)*q)];};
 function measure(name,fn){
  const t=now();try{return fn();}finally{samples(name,now()-t);}
 }
 function frame(ms){if(!validMs(ms))return;frames++;frameTotal+=ms;maxFrame=Math.max(maxFrame,ms);samples('total-frame',ms);}
 function observe(type,data){
  if(!['action.start','action.end'].includes(type)||typeof data?.key!=='string')return;
  const name=data.key.replace(/:.*/,'').slice(0,40);
  if(!actions.has(name)&&actions.size>=48)return;
  let row=actions.get(name);
  if(!row){row={started:0,ended:0,rejected:0,timedOut:0};actions.set(name,row);}
  if(type==='action.start')row.started++;
  else{row.ended++;if(data.result==='rejected')row.rejected++;if(data.result==='timeout')row.timedOut++;}
 }
 function status(){
  const elapsed=Math.max(1,now()-started);
  return {frames,meanFrameMs:frames?frameTotal/frames:0,maxFrameMs:maxFrame,
   elapsedMs:elapsed,wallLoadProxy:Math.min(1,frameTotal/elapsed),
   modules:[...byModule].map(([name,x])=>({name,calls:x.n,meanMs:x.total/x.n,
    p95Ms:quantile(x.values,.95),p99Ms:quantile(x.values,.99)}))
    .sort((a,b)=>b.meanMs-a.meanMs).slice(0,24),
   actions:[...actions].map(([name,x])=>({name,...x,
    dispatchPerMinute:Math.round(x.started*60000/elapsed*100)/100}))};
 }
 return {measure,frame,observe,status};
}
