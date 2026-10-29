import {distance,samePlace} from '../core/policy.mjs';
import {peerReadyForHandoff,confirmedHandoffCooldown} from './handoff-coordinator.mjs';
export function createGoldLogistics(bot){
 const {p,cfg,me,exec,transport}=bot;let job=null,serial=0,next=0;const finished=new Map();
 // Recently transferred gold cannot be counted twice across asynchronous
 // sender/receiver heartbeats. Preserve the grace period across code reloads.
 const holdMs=2*Math.max(15000,cfg.general?.messageTtlMs??15000);
 const stampKey='albot:gold:'+me.name+':recent-transfer';
 const persisted=p.read(stampKey),bootAt=Date.now();
 let lastTransferAt=Number.isSafeInteger(persisted)&&persisted>0&&persisted<=bootAt&&bootAt-persisted<holdMs?persisted:0;
 function markTransfer(){
  const at=Date.now();lastTransferAt=at;
  if(p.write(stampKey,at)===true)return true;
  bot.report?.('Goldtransfer-Sperrfrist konnte nicht gespeichert werden; neuer Goldversand gesperrt');
  return false;
 }
 const reserve=()=>Math.max(me.goldReserve??0,me.role==='merchant'?cfg.merchant.goldReserve:0);
 const surplus=()=>me.role==='farmer'?Math.max(0,Math.floor(p.c.gold-reserve())):0;
 const idle=()=>bot.running&&!p.c.rip&&!bot.journal&&!bot.inventoryBlocked&&!bot.bank?.pending&&!bot.logistics.reserved&&!bot.services?.active&&!bot.movement?.townActive&&!p.c.c?.town&&!exec.pending?.has('travel.town')&&!exec.busy('inventory')&&!exec.busy('gold')&&!exec.busy('economy')&&bot.checkpoint.durable;
 const near=name=>{const e=bot.entity(name),h=transport.fresh(name);return e&&h?.running&&!h.rip&&h.realm===p.realm()&&samePlace(p.c,e)&&samePlace(p.c,h)&&distance(p.c,e)<250&&distance(p.c,h)<250&&h.session;};
 const send=(type,data={})=>{bot.event('gold.'+type,{id:job.id,peer:job.peer,quantity:job.quantity,reason:'Farmerüberschuss oberhalb eigener Goldreserve'});transport.send(job.peer,type,data,job.id);};
 function receive(from,m){
  if(!cfg.merchant.collectGold||!cfg.merchant.enabled)return;
  const d=m.data??{};
  if(m.type==='goldOffer'){
   if(job?.id===m.id&&job.peer===from&&job.state==='receiving'){send('goldAccept',{quantity:job.quantity});return;}
   if(me.name!==cfg.party.merchant||!cfg.characters.some(c=>c.enabled&&c.name===from&&c.role==='farmer')||job||finished.has(m.id)||!near(from)||!Number.isSafeInteger(d.quantity)||d.quantity<1||!Number.isSafeInteger(p.c.gold+d.quantity))return;
   // An unsent item offer has not moved value and can safely be cancelled.
   // Otherwise outgoing potion offers can starve genuine gold pickups forever.
   if(!idle()&&bot.logistics?.itemReserved)bot.logistics.yieldUnsent?.('Goldempfang: unversandtes Itemangebot zurückstellen');
   if(!idle())return;
   if(!markTransfer())return;
   if(me.role==='merchant')bot.movement?.stop();job={id:m.id,peer:from,session:m.session,state:'receiving',quantity:d.quantity,before:p.c.gold,until:Date.now()+cfg.general.messageTtlMs};
   try{bot.beginValue({kind:'gold.receive',...job});send('goldAccept',{quantity:job.quantity});}catch(e){job=null;throw e;}
  }else if(job&&job.peer===from&&job.id===m.id&&job.session===m.session){
   if(m.type==='goldAccept'&&job.state==='offered'&&d.quantity===job.quantity)job.state='accepted';
   if(m.type==='goldCancel'&&job.state==='receiving'&&!job.observed&&p.c.gold===job.before&&d.quantity===job.quantity&&d.notDispatched===true){bot.event('gold.cancelled',{id:job.id,peer:from,reason:'Sender hat Auftrag ohne Dispatch beendet; Empfängerbestand unverändert'});finished.set(job.id,Date.now());job=null;bot.endValue('confirmed');return;}
   if(m.type==='goldReceipt'&&job.state==='sent'&&d.quantity===job.quantity)job.receipt=true;
   if(m.type==='goldDone'&&job.state==='receiving'&&job.observed){markTransfer();finished.set(job.id,Date.now());job=null;bot.endValue('confirmed');}
  }
 }
 function sendCancelled(j){transport.send(j.peer,'goldCancel',{quantity:j.quantity,notDispatched:true},j.id);bot.event('gold.cancelled',{id:j.id,state:j.state,reason:'Kein Goldversand ausgeführt'});}
 function poll(offer=false){
  const now=Date.now();for(const [id,at] of finished)if(now-at>120000)finished.delete(id);
  if(job){const j=job;
   if(j.state==='receiving'&&Number.isSafeInteger(p.c.gold)&&p.c.gold>=j.before+j.quantity){j.observed=true;if(!j.lastReceipt||now-j.lastReceipt>1500){j.lastReceipt=now;send('goldReceipt',{quantity:j.quantity});}}
   if(j.state==='sent'&&p.c.gold<j.before&&p.c.gold>=reserve()&&j.receipt){markTransfer();send('goldDone');finished.set(j.id,now);job=null;bot.endValue('confirmed');next=now+confirmedHandoffCooldown(cfg.general.messageTtlMs);return;}
   if(now>j.until){if(['receiving','sent'].includes(j.state))markTransfer();job=null;next=now+15000;if(j.state==='offered'||j.state==='accepted')sendCancelled(j);else bot.endValue('unknown');bot.event('gold.timeout',{id:j.id,state:j.state});return;}
   if(j.state==='offered'&&now-j.lastOffer>1500){j.lastOffer=now;send('goldOffer',{quantity:j.quantity});}
   if(j.state==='accepted'){
    const guard=()=>bot.running&&!bot.journal&&!bot.inventoryBlocked&&!(bot.logistics.itemReserved??bot.logistics.reserved)&&!bot.bank?.pending&&!!near(j.peer)&&transport.fresh(j.peer)?.session===j.session&&Number.isSafeInteger(p.c.gold)&&surplus()>=j.quantity;
    if(!guard())return;
    // Persist before scheduling a value action, not inside the dispatch
    // callback. A failed write means no send and no ambiguous value journal.
    if(!markTransfer()){sendCancelled(j);job=null;next=now+15000;return;}
    exec.run('gold.send',['inventory','gold'],guard,()=>{j.before=p.c.gold;bot.beginValue({kind:'gold.send',...j});j.state='sent';bot.event('gold.dispatched',{id:j.id,peer:j.peer,quantity:j.quantity,before:j.before});return p.call('send_gold',j.peer,j.quantity);},{value:true,observe:()=>finished.has(j.id),timeout:cfg.general.messageTtlMs,onSettle:result=>{if(result==='unknown'&&job===j){
      // A settled/unknown game RPC does not mean the send failed. Preserve
      // the transaction and its durable value journal while a receipt can
      // still arrive. Re-dispatching this gold ID is never permitted.
      if(j.state==='sent')bot.event('gold.dispatchAwaitingReceipt',{id:j.id,peer:j.peer,quantity:j.quantity});
      else{sendCancelled(j);job=null;next=Date.now()+15000;}
     }}});
   }return;
  }
  if(!offer||!cfg.merchant.collectGold||!cfg.merchant.enabled||me.role!=='farmer'||now<next||!idle()||surplus()<cfg.merchant.goldCollectBelow||!near(cfg.party.merchant))return;
  const peer=transport.fresh(cfg.party.merchant);if(!peerReadyForHandoff(peer))return;
  const quantity=surplus();if(!Number.isSafeInteger(quantity)||quantity<1)return;
  // One session-bound receipt covers the entire observed surplus. The old
  // goldTransferMax field remains importable but no longer splits pickups.
  job={id:bot.session+':gold:'+(++serial),peer:cfg.party.merchant,session:peer.session,state:'offered',quantity,before:p.c.gold,until:now+cfg.general.messageTtlMs,lastOffer:now};send('goldOffer',{quantity:job.quantity});
 }
 // Surplus collection is intentionally onsite-only: item/supply travel brings
 // the merchant to farmers, and poll() retains the durable gold handshake.
 function travel(){return false;}
 function yieldUnsent(reason='Itemübergabe hat Vorrang'){
  if(!job||!['offered','accepted'].includes(job.state))return false;
  const previous=job;job=null;next=Date.now()+15000;
  sendCancelled(previous);bot.event('gold.yieldUnsent',{id:previous.id,reason});
  return true;
 }
 return {receive,poll,travel,yieldUnsent,surplus,get readyForHandoff(){return idle()&&!job;},get reserved(){return !!job;},get transferAt(){return lastTransferAt;},status:()=>job?{state:job.state,peer:job.peer,quantity:job.quantity,id:job.id}:null,close(){const j=job;job=null;if(j&&['offered','accepted'].includes(j.state))sendCancelled(j);else if(j)bot.endValue('unknown');}};
}
