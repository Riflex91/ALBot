// One bounded service lease, shared by item, gold and buff journeys.
export function createServicePlan({holdMs=30000,now=()=>Date.now(),event=()=>{}}={}){
 let target=null,since=0,lastNotice=0;const history=[];
 function claim(name,urgent=false){const time=now(),window=Math.max(holdMs*2,30000);while(history.length&&time-history[0].at>window)history.shift();if(target===name)return true;const returning=history.slice(0,-1).some(x=>x.name===name),held=target&&time-since<holdMs;if(!urgent&&(held||returning)){if(time-lastNotice>5000){lastNotice=time;event('merchant.switchBlocked',{from:target,to:name,reason:held?'Aktuellen Empfänger fertig bedienen':'Schnellen A→B→A-Wechsel vermeiden',retryAfter:held?since+holdMs:history.find(x=>x.name===name).at+window});}return false;}const previous=target;target=name;since=time;history.push({name,at:time});if(history.length>12)history.shift();event('merchant.servicePlan',{from:previous,to:name,urgent,reason:urgent?'Dringender Tranknachschub':'Empfänger binden und Aufträge vor Ort bündeln'});return true;}
 return {claim,current:()=>target,status:()=>({target,since,history:[...history]}),clear(){target=null;since=0;history.length=0;}};
}
