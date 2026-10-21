// One bounded service lease, shared by item, gold and buff journeys.
// Completing an on-site visit temporarily bars reselecting the SAME farmer;
// simply clearing the preferred target would otherwise restart A -> town -> A.
export function createServicePlan({holdMs=30000,now=()=>Date.now(),event=()=>{}}={}){
 let target=null,since=0,lastNotice=0;const history=[],deferred=new Map();
 function claim(name,urgent=false){
  const time=now(),window=Math.max(holdMs*2,30000);
  while(history.length&&time-history[0].at>window)history.shift();
  for(const [peer,until] of deferred)if(until<=time)deferred.delete(peer);
  if(!urgent&&(deferred.get(name)??0)>time){
   if(time-lastNotice>5000){lastNotice=time;event('merchant.switchBlocked',{from:target,to:name,reason:'Besuch beendet; keinen neuen Leerweg starten',retryAfter:deferred.get(name)});}
   return false;
  }
  if(target===name)return true;
  const returning=history.slice(0,-1).some(x=>x.name===name),held=target&&time-since<holdMs;
  if(!urgent&&(held||returning)){
   if(time-lastNotice>5000){lastNotice=time;event('merchant.switchBlocked',{from:target,to:name,reason:held?'Aktuellen Empfänger fertig bedienen':'Schnellen A→B→A-Wechsel vermeiden',retryAfter:held?since+holdMs:history.find(x=>x.name===name).at+window);}
   return false;
  }
  const previous=target;target=name;since=time;history.push({name,at:time});
  if(history.length>12)history.shift();
  event('merchant.servicePlan',{from:previous,to:name,urgent,reason:urgent?'Dringender Tranknachschub':'Empfänger binden und Aufträge vor Ort bündeln'});
  return true;
 }
 function finish(name,{cooldownMs=30000,reason='Besuch abgeschlossen'}={}){
  if(!name||name!==target)return false;
  const until=now()+Math.max(5000,Math.min(120000,cooldownMs));
  deferred.set(name,until);
  target=null;since=0;
  event('merchant.serviceComplete',{peer:name,reason,retryAfter:until});
  return true;
 }
 return {claim,finish,current:()=>target,status:()=>({target,since,history:[...history],
  deferred:[...deferred].map(([peer,until])=>({peer,until}))}),
  clear(){target=null;since=0;history.length=0;deferred.clear();}};
}
