// The game's change_server may navigate away before the Promise settles.
// Persist the causal chain so the next CODE boot can diagnose the missing time.
// Never launch another tab or bypass the normal/PvP, combat or inventory gates.
export function createHopLifecycle(bot,{destinationNormal,safe}){
 const {p,me,exec}=bot,key='albot:hop-lifecycle:'+me.name;
 let active=null,previous=p.read(key);
 const emit=(name,data)=>bot.event?.('server.hop.'+name,data);
 const valid=x=>x&&typeof x.id==='string'&&typeof x.from==='string'&&
  typeof x.to==='string'&&Number.isFinite(x.createdAt)&&x.createdAt>0&&
  Number.isSafeInteger(x.attempts)&&x.attempts>=0&&x.attempts<=3;
 if(valid(previous)&&Date.now()>=previous.createdAt&&Date.now()-previous.createdAt<86400000){
  const actualRealm=p.realm(),outcome=actualRealm===previous.to?'destination-online':
   actualRealm===previous.from?'still-on-source':'realm-mismatch';
  emit('boot',{id:previous.id,from:previous.from,to:previous.to,
   priorPhase:previous.phase,attempts:previous.attempts,outcome,actualRealm,
   elapsedMs:Date.now()-previous.createdAt});
  if(outcome==='destination-online'&&previous.phase!=='arrived'){
   const confirmed={...previous,phase:'arrived',confirmedAt:Date.now()};
   if(p.write(key,confirmed)===true)previous=confirmed;
  }
 }
 function persist(phase,extra={}){
  if(!active)return false;
  const next={...active,...extra,phase,updatedAt:Date.now()};
  if(p.write(key,next)!==true){emit('storageFailed',{id:active.id,phase});return false;}
  active=next;previous=next;return true;
 }
 function finish(result,error){
  if(!active)return;
  const current=active,now=Date.now();
  bot.lifecycleChanging=false;
  if(p.realm()===current.to||result==='confirmed'){
   persist('arrived',{confirmedAt:now});
   emit('arrived',{id:current.id,from:current.from,to:current.to,
    attempt:current.attempts,actualRealm:p.realm(),elapsedMs:now-current.createdAt});
   active=null;return;
  }
  const reason=String(error?.message??error?.reason??error??result).slice(0,160);
  const retry=current.attempts<3&&now-current.createdAt<120000&&
   p.realm()===current.from&&destinationNormal(current.to);
  const nextTryAt=retry?now+(current.attempts===1?10000:20000):0;
  const durable=persist(retry?'retry-wait':'failed',{lastResult:result,lastError:reason,nextTryAt});
  emit(retry&&durable?'retryScheduled':'failed',{
   id:current.id,from:current.from,to:current.to,attempt:current.attempts,
   result,reason,nextTryAt:durable?nextTryAt:0,elapsedMs:now-current.createdAt});
  if(!retry||!durable)active=null;
 }
 function attempt(){
  if(!active||!bot.running||p.realm()!==active.from||active.attempts>=3)return false;
  if(!destinationNormal(active.to)){
   finish('aborted',new Error('Destination no longer confirmed NORMAL'));return false;
  }
  if(!safe()||p.parent?.socket?.connected===false){
   if(!persist('retry-wait',{nextTryAt:Date.now()+2000}))active=null;
   return false;
  }
  const number=active.attempts+1,to=active.to,id=active.id;
  if(!persist('dispatching',{attempts:number,attemptedAt:Date.now(),nextTryAt:0})){
   active=null;return false;
  }
  const started=exec.run('server.hop.'+number,['lifecycle'],
   ()=>bot.running&&!bot.lifecycleChanging&&!bot.journal&&!bot.inventoryBlocked&&
    !bot.logistics.reserved&&p.realm()===active?.from&&destinationNormal(to),
   ()=>{
    bot.lifecycleChanging=true;bot.movement.stop();
    emit('attempt',{id,from:p.realm(),to,attempt:number});
    // Do not swallow rejection and do not halt the scheduler before it settles.
    return p.call('change_server',to.slice(0,2),to.slice(2));
   },{timeout:20000,delay:1000,observe:()=>p.realm()===to,
     waitForObservation:true,onSettle:(result,error)=>finish(result,error)});
  if(!started){
   bot.lifecycleChanging=false;
   if(!persist('retry-wait',{attempts:number-1,nextTryAt:Date.now()+2000}))active=null;
   emit('dispatchDeferred',{id,to,attempt:number});
  }
  return started;
 }
 function begin(plan){
  if(active||!valid({...plan,attempts:0,createdAt:Date.now()})||
   !safe()||!destinationNormal(plan.to)||p.realm()!==plan.from)return false;
  active={id:plan.id,from:plan.from,to:plan.to,createdAt:Date.now(),
   updatedAt:Date.now(),attempts:0,phase:'prepared',nextTryAt:Date.now()};
  if(!persist('prepared')){active=null;return false;}
  emit('commit',{id:plan.id,from:plan.from,to:plan.to});
  attempt();return true;
 }
 function tick(){
  if(!active)return;
  if(p.realm()===active.to){finish('confirmed');return;}
  if(p.realm()!==active.from){
   finish('aborted',new Error('Unexpected current realm'));return;
  }
  if(active.phase==='retry-wait'&&Date.now()>=active.nextTryAt){
   if(Date.now()-active.createdAt>=120000)finish('timeout',new Error('Reconnect not confirmed within 120 seconds'));
   else attempt();
  }
 }
 return {begin,tick,get blocked(){return !!active;},
  status:()=>active?{...active}:valid(previous)?{...previous}:null,
  close(){active=null;}};
}
