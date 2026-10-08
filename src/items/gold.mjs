import {distance,samePlace} from '../core/policy.mjs';
export function createGoldLogistics(bot){
 const {p,cfg,me,exec,transport}=bot;let job=null,serial=0,next=0;const finished=new Map();
 const reserve=()=>Math.max(me.goldReserve??0,me.role==='merchant'?cfg.merchant.goldReserve:0);
 const surplus=()=>me.role==='farmer'?Math.max(0,Math.floor(p.c.gold-reserve())):0;
 const idle=()=>bot.running&&!p.c.rip&&!bot.journal&&!bot.inventoryBlocked&&!bot.bank?.pending&&!bot.logistics.reserved&&!bot.services?.active&&!exec.pending.size&&bot.checkpoint.durable;
 const near=name=>{const e=bot.entity(name),h=transport.fresh(name);return e&&h?.running&&!h.rip&&h.realm===p.realm()&&samePlace(p.c,e)&&samePlace(p.c,h)&&distance(p.c,e)<250&&distance(p.c,h)<250&&h.session;};
 const send=(type,data={})=>{bot.event('gold.'+type,{id:job.id,peer:job.peer,quantity:job.quantity,reason:'Farmerüberschuss oberhalb eigener Goldreserve'});transport.send(job.peer,type,data,job.id);};
 function receive(from,m){
  if(!cfg.merchant.collectGold||!cfg.merchant.enabled)return;
  const d=m.data??{};
  if(m.type==='goldOffer'){
   if(job?.id===m.id&&job.peer===from&&job.state==='receiving'){send('goldAccept',{quantity:job.quantity});return;}
   if(me.name!==cfg.party.merchant||!cfg.characters.some(c=>c.enabled&&c.name===from&&c.role==='farmer')||job||finished.has(m.id)||!idle()||!near(from)||!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>cfg.merchant.goldTransferMax)return;
   job={id:m.id,peer:from,session:m.session,state:'receiving',quantity:d.quantity,before:p.c.gold,until:Date.now()+cfg.general.messageTtlMs};
   try{bot.beginValue({kind:'gold.receive',...job});send('goldAccept',{quantity:job.quantity});}catch(e){job=null;throw e;}
  }else if(job&&job.peer===from&&job.id===m.id&&job.session===m.session){
   if(m.type==='goldAccept'&&job.state==='offered'&&d.quantity===job.quantity)job.state='accepted';
   if(m.type==='goldReceipt'&&job.state==='sent'&&d.quantity===job.quantity)job.receipt=true;
   if(m.type==='goldDone'&&job.state==='receiving'&&job.observed){finished.set(job.id,Date.now());job=null;bot.endValue('confirmed');}
  }
 }
 function poll(offer=false){
  const now=Date.now();for(const [id,at] of finished)if(now-at>120000)finished.delete(id);
  if(job){const j=job;
   if(j.state==='receiving'&&p.c.gold===j.before+j.quantity){j.observed=true;if(!j.lastReceipt||now-j.lastReceipt>1500){j.lastReceipt=now;send('goldReceipt',{quantity:j.quantity});}}
   if(j.state==='sent'&&p.c.gold===j.before-j.quantity&&j.receipt){send('goldDone');finished.set(j.id,now);job=null;bot.endValue('confirmed');next=now+15000;return;}
   if(now>j.until){job=null;next=now+15000;if(j.state!=='offered')bot.endValue('unknown');bot.event('gold.timeout',{id:j.id,state:j.state});return;}
   if(j.state==='offered'&&now-j.lastOffer>1500){j.lastOffer=now;send('goldOffer',{quantity:j.quantity});}
   if(j.state==='accepted'){
    const guard=()=>bot.running&&!bot.journal&&!bot.inventoryBlocked&&!(bot.logistics.itemReserved??bot.logistics.reserved)&&!bot.bank?.pending&&!!near(j.peer)&&transport.fresh(j.peer)?.session===j.session&&p.c.gold===j.before&&surplus()>=j.quantity;
    exec.run('gold.send',['inventory','gold'],guard,()=>{bot.beginValue({kind:'gold.send',...j});j.state='sent';bot.event('gold.dispatched',{id:j.id,peer:j.peer,quantity:j.quantity,before:j.before});return p.call('send_gold',j.peer,j.quantity);},{value:true,observe:()=>finished.has(j.id),timeout:cfg.general.messageTtlMs,onSettle:result=>{if(result==='unknown'&&job===j){job=null;bot.endValue('unknown');}}});
   }return;
  }
  if(!offer||!cfg.merchant.collectGold||!cfg.merchant.enabled||me.role!=='farmer'||now<next||!idle()||surplus()<cfg.merchant.goldCollectBelow||!near(cfg.party.merchant))return;
  const peer=transport.fresh(cfg.party.merchant);if(peer.journal||peer.pending||peer.inventoryBlocked)return;
  job={id:bot.session+':gold:'+(++serial),peer:cfg.party.merchant,session:peer.session,state:'offered',quantity:Math.min(surplus(),cfg.merchant.goldTransferMax),before:p.c.gold,until:now+cfg.general.messageTtlMs,lastOffer:now};send('goldOffer',{quantity:job.quantity});
 }
 function travel(){if(bot.recovering||!cfg.merchant.collectGold||me.name!==cfg.party.merchant||job||!idle())return false;
  for(const name of bot.farmers){const h=transport.fresh(name);if(!h?.running||h.rip||h.journal||h.pending||h.realm!==p.realm()||!(h.goldSurplus>=cfg.merchant.goldCollectBelow))continue;
   if(bot.strategy?.canVisit?.(h)===false)continue;
   if(bot.services?.waiting)bot.services.interrupt();if(samePlace(p.c,h)&&distance(p.c,h)<200)return false;
   if(bot.movement.order?.owner==='economy')bot.movement.stop();bot.reason='Goldüberschuss abholen: '+name;bot.movement.go({...h,radius:120},'gold');return true;
  }return false;
 }
 return {receive,poll,travel,surplus,get reserved(){return !!job;},status:()=>job?{state:job.state,peer:job.peer,quantity:job.quantity,id:job.id}:null,close(){const unknown=job&&job.state!=='offered';job=null;if(unknown)bot.endValue('unknown');}};
}
