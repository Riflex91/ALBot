import {potionTarget,onlineSupplyFarmers} from './potion-supply.mjs';
import {protectedItem,identity,variantCount,transferable,fingerprint,distance,samePlace,chooseRule} from '../core/policy.mjs';
import {phaseOf} from '../../editor/lib/contract.mjs';
import {peerReadyForHandoff} from './handoff-coordinator.mjs';
import {inspectReceiveSenderSession} from './transfer-reconciliation.mjs';
import {capacityAfterConsumption,physicalInventoryCapacity} from './physical-capacity.mjs';
import {isAchievementCarrier,carriedAchievementCarrier,trackerDeliveryNeed,trackerMerchantKeep} from './achievement-utility.mjs';
// Re-evaluate pursuit against every fresh team heartbeat. Never chase an old
// map or a frozen kite position after the recipient has moved away.
export function deliveryRouteDecision(route,peer,character,{error=70,arrival=190}={}){
 if(!route||route.owner!=='logistics')return 'none';
 if(!peer?.running||peer.rip||!Number.isFinite(peer.x)||!Number.isFinite(peer.y)||
    !peer.map||!peer.realm)return 'cancel';
 if(peer.name!==route.dest?.name)return 'cancel';
 if(samePlace(character,peer)&&distance(character,peer)<=arrival)return 'arrived';
 if(!samePlace(route.dest,peer))return 'retarget';
 return distance(route.dest.serviceAnchor??route.dest,peer)>Math.max(45,Math.min(100,error))?'retarget':'keep';
}
export function teamPickupThreshold(peers,realm,threshold=30){
 // Only authenticated, live farmers on this realm contribute to an
 // actionable pickup. One disconnected, dead or cross-realm teammate
 // must not suppress legitimate loot on the remaining active farmers.
 if(!Array.isArray(peers)||!peers.length)return {ready:false,slots:0,trigger:false};
 const active=peers.filter(h=>h?.running&&!h.rip&&h.realm===realm);
 // Missing active-team evidence does not mean the inventory is empty.
 // Likewise, malformed live slot counts cannot authorize a trip.
 if(!active.length||active.some(h=>!Number.isSafeInteger(h.lootSlots)||
    h.lootSlots<0||h.lootSlots>42))return {ready:false,slots:0,trigger:false};
 const slots=active.reduce((sum,h)=>sum+h.lootSlots,0);
 return {ready:true,slots,trigger:slots>=threshold};
}
// Physical receive preflight: only identical, unprotected stacks can absorb
// units without allocating a new inventory slot. An offer acknowledgement
// never frees a slot or guarantees later delivery.
export function physicalReceiveCapacity(items,item,meta,{maxNewSlots=Infinity,inventorySize}={}){
 // A single send_item is only credited with one new physical stack; the
 // shared planner also checks exact compatible-stack headroom.
 const limit=Number.isFinite(maxNewSlots)?Math.max(0,Math.min(1,Math.floor(maxNewSlots))):1;
 return capacityAfterConsumption(items,[],item,meta,{maxNewSlots:limit,inventorySize})?.units??0;
}
// A confirmed physical loot receipt can only change offer ORDER. It does
// not create recipient authorization, a send rule, a quantity or a reserve.
// The normal two-party inventory journal remains the sole transfer path.
export function receiptBackedPickupOrder(items,hints,{role,merchant,pickup}={}){
 const slots=Array.isArray(items)?items.map((_,index)=>index):[];
 if(role!=='farmer'||pickup!==true||typeof merchant!=='string'||
    !merchant||!Array.isArray(hints)||hints.length>16)return slots;
 const credits=new Map();
 for(const row of hints){
  if(row?.evidence!=='own-physical-receipt-confirmed'||
     row.state!=='read-only-demand-match'||
     row.dispatchAuthorized!==false||
     typeof row.variantIdentity!=='string'||!row.variantIdentity||
     row.variantIdentity.length>512||
     !Number.isSafeInteger(row.observedUnits)||row.observedUnits<1||
     !Number.isSafeInteger(row.currentUnits)||row.currentUnits<1||
     !Number.isSafeInteger(row.uncommittedEstimate)||
     row.uncommittedEstimate<1)continue;
  // Duplicate status rows may not increase the available priority credit.
  const cap=Math.min(row.observedUnits,row.currentUnits,
   row.uncommittedEstimate);
  credits.set(row.variantIdentity,Math.max(credits.get(row.variantIdentity)??0,cap));
 }
 const preferred=new Set();
 for(const slot of slots){
  const item=items[slot];
  if(protectedItem(item))continue;
  const key=identity(item),credit=credits.get(key)??0;
  const units=item?.q??1;
  if(credit<1||!Number.isSafeInteger(units)||units<1)continue;
  preferred.add(slot);
  credits.set(key,Math.max(0,credit-units));
 }
 return slots.sort((a,b)=>Number(preferred.has(b))-Number(preferred.has(a)));
}
// W13: prefer an already authorized gear recipient whose CURRENT, live
// target is most urgent. This is order-only: no send rule, extra copy,
// recipient, equipment promise or inventory authority is ever created.
export function orderedGearRecipients(recipients,item,{role='',gearEnabled=false,
 explicitRules=[],goals=[],peers={},realm='',allocations=[]}={}){
 if(!Array.isArray(recipients)||recipients.length<2||recipients.length>32||
    role!=='merchant'||gearEnabled!==true||!item||
    !Array.isArray(explicitRules)||!Array.isArray(goals)||
    !Array.isArray(allocations)||goals.length>256||
    allocations.length>256)return recipients;
 // User-defined keep/send actions retain their configured precedence.
 if(explicitRules.some(r=>r?.enabled&&r.item===item.name&&
    (r.action==='keep'||r.action==='send')))return recipients;
 const wanted=new Set(recipients);
 const priority=new Map();
 const unique=new Set();
 for(const goal of goals){
  if(goal?.enabled===false||goal?.item!==item.name||
     goal.level!==(item.level??0)||!wanted.has(goal.recipient)||
     typeof goal.recipient!=='string'||!goal.gearSlot||
     !Number.isFinite(goal.priority))continue;
  // Never prefer an incompatible stat/title/property variant.
  if(goal.variant&&identity({...item,...goal.variant})!==identity(item))continue;
  const peer=peers[goal.recipient];
  if(!peer?.running||peer.rip||peer.realm!==realm||
     typeof peer.session!=='string'||!peer.session)continue;
  const claim=allocations.some(r=>r?.recipient===goal.recipient&&
    r.variant===identity(item)&&
    (r.state==='unresolved'||r.state==='reserved'));
  if(claim)continue; // no priority credit from an unconfirmed promise
  const score=Math.min(100000,Math.max(-100000,goal.priority));
  priority.set(goal.recipient,Math.max(priority.get(goal.recipient)??-Infinity,score));
 }
 if(!priority.size)return recipients;
 return recipients.map((name,index)=>({name,index,score:priority.get(name)}))
  .sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||a.index-b.index)
  .map(x=>x.name);
}
export function createLogistics(bot){
  const {p,cfg,me,exec,transport}=bot;let job=null,incoming=null,serial=0,summaryOffset=0,lastCapacityWarning=0,lastDeliveryRetarget=0,pickupCycle=false,pickupOnSiteAt=0,pickupOnSiteName='';const completed=new Map(),nextOffer=new Map(),recentVisit=new Map(),clock=()=>exec.now();let serviceSite=null;const ONSITE_MS=12000;
  const counters={offersSent:0,offersReceived:0,acceptsSent:0,acceptsReceived:0,sendsStarted:0,receiptsSent:0,receiptsReceived:0,doneSent:0,doneReceived:0,timeouts:0};
  const gearProofNotice=new Map();
  const offerKey=(to,item)=>to+'\u0000'+item;
  const ruleFor=(item)=>bot.rule(item);
  const context=()=>({role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:bot.task?.()??(me.role==='merchant'?'supply':'farm')});
  const allRules=()=>bot.production?.effectiveRules()??cfg.items;
  // Known standard potions supply the party by default. User item rules
  // take precedence: one explicit merchant rule disables automatic fallback
  // for that item, avoiding silently overriding intentional exceptions.
  const isPotion=item=>{
    const meta=p.G?.items?.[item?.name];
    return !!meta&&meta.type==='pot'&&/^([hm]pot[0-9]+)$/.test(item.name)&&
      (meta.gives??[]).some(g=>Array.isArray(g)&&['hp','mp'].includes(g[0]));
  };
  const explicitInventory=item=>chooseRule(cfg.items.filter(r=>['inventory','all'].includes(phaseOf(r.action))),item,context());
  const autoLootRule=item=>{
    if(bot.supplyOnly||me.role!=='farmer'||!cfg.merchant.pickup||!cfg.party.merchant||
       !item||protectedItem(item)||explicitInventory(item)||
       bot.allocation?.pendingReceived?.(item))return null;
    const meta=p.G?.items?.[item.name];
    if(!meta||isAchievementCarrier(item)||['pot','elixir','tool','stand'].includes(meta.type))return null;
    return {enabled:true,name:'Beuteabgabe '+item.name,action:'send',
      item:item.name,recipient:cfg.party.merchant,keep:0,teamReserve:0,
      batch:cfg.merchant.maxDelivery,ttlMs:cfg.general.messageTtlMs};
  };
  const trackerRule=(item,to)=>{
    if(item?.name!=='tracker'||me.role!=='merchant'||!cfg.merchant.enabled||
       !cfg.merchant.supply||!bot.farmers?.includes(to)||
       bot.economy?.explicit?.(item)||!p.G?.items?.tracker)return null;
    const peer=transport.fresh(to);
    if(!trackerDeliveryNeed(peer,p.realm(),{reserve:cfg.farming.freeSlots??4}))return null;
    return {enabled:true,name:'Tracktrix-Reserve → '+to,
      item:'tracker',action:'send',recipient:to,
      keep:trackerMerchantKeep(p.c.items,{farmerNeeds:true}),teamReserve:0,
      batch:1,ttlMs:cfg.general.messageTtlMs};
  };
  const refillFarmers=()=>onlineSupplyFarmers(bot).filter(({name})=>
    cfg.merchant.potionTeamRefill!==true||(bot.farmers??[]).includes(name));
  const potionRule=(item,to)=>{
    if(me.role!=='merchant'||!cfg.merchant.enabled||!cfg.merchant.supply||
       (cfg.merchant.potionTeamRefill===true&&bot.merchant?.potionSupplyActive?.()!==true)||
       !refillFarmers().some(x=>x.name===to)||!['hpot0','mpot0'].includes(item.name)||!isPotion(item)||explicitInventory(item)||bot.economy?.explicit(item))return null;
    return {enabled:true,name:'Autoversorgung '+item.name+' → '+to,action:'send',
      item:item.name,recipient:to,keep:200,teamReserve:0,batch:1500,ttlMs:cfg.general.messageTtlMs};
  };
  const sendRecipients=item=>{
    const configured=[...new Set(allRules().filter(r=>r.enabled&&r.action==='send'&&r.item===item.name&&r.recipient&&r.recipient!==me.name).map(r=>r.recipient))];
    if(configured.length){
     if(me.role!=='merchant'||configured.length<2)return configured;
     const peers=Object.fromEntries(configured.map(name=>[name,transport.fresh(name)]));
     return orderedGearRecipients(configured,item,{
      role:me.role,gearEnabled:cfg.production?.gear===true,
      explicitRules:cfg.items,goals:bot.gear?.goals?.()??[],
      peers,realm:p.realm(),allocations:bot.allocation?.status?.()??[]});
    }
    return item?.name==='tracker'&&me.role==='merchant'?
      (bot.farmers??[]).filter(name=>!!trackerRule(item,name)):
      (autoLootRule(item)?[cfg.party.merchant]:
      (isPotion(item)&&!explicitInventory(item)&&!bot.economy?.explicit(item)&&
        (cfg.merchant.potionTeamRefill!==true||bot.merchant?.potionSupplyActive?.()===true)?refillFarmers().map(x=>x.name):[]));
  };
  const sendRule=(item,to)=>{const explicit=chooseRule(cfg.items.filter(r=>r.enabled&&(r.action==='keep'||r.action==='send'&&r.recipient===to)),item,context()),r=explicit??(bot.economy?.explicit(item)?null:chooseRule(allRules().slice(cfg.items.length).filter(r=>r.action==='send'&&r.recipient===to),item,context()))??potionRule(item,to)??trackerRule(item,to)??(to===cfg.party.merchant?autoLootRule(item):null);return r?.action==='send'&&(bot.production?.matchesOutput?.(item)??true)&&(bot.production?.canRecordDelivery?.(item,to)??true)?r:null;};
  const availableTransfer=(slot,r)=>{
   if(!r)return 0;
   const i=p.c.items[slot];
   if(!i)return 0;
   // For a finished automatic gear shipment, the production allocator
   // already selected a physical copy and a single farmer. Subtracting the
   // gross reservations for every OTHER farmer and merchant own gear again
   // would zero out that copy. Keep explicit-rule reserves and the normal
   // durable physical claim/receiver checks on every offer and dispatch.
   if(r._autoGearDelivery===true)
    return Math.min(transferable(p.c.items,slot,r),
     bot.production?.gearDeliveryAllowance?.(i,r.recipient)??0);
   const reserved=bot.production?.reservedQuantity?.(i,r.recipient)??
    (bot.production?.reserved(i)?variantCount(p.c.items,i):0);
   return Math.min(transferable(p.c.items,slot,r),
    Math.max(0,variantCount(p.c.items,i)-r.keep-r.teamReserve-reserved));
  };
  const defaultPotionDemand=(item,n,advertise=false)=>{
    if(me.role!=='farmer'||!isPotion(item))return 0;
    const desired=potionTarget(cfg,item.name);
    // Report the actual deficit against the separate HP and MP targets.
    if(advertise&&cfg.merchant.potionTeamRefill===true&&n>(cfg.merchant.potionAlertBelow??50))return 0;
    return Math.max(0,desired-n);
  };
  const demandFor=(rule,n)=>{if(!rule)return 0;const threshold=(rule.requestBelow??0)>0?rule.requestBelow:rule.targetCount,normal=n<=threshold?Math.max(0,Math.min(rule.targetCount,rule.maxCount)-n):0;return Math.min(Math.max(normal,bot.behavior?.need(rule.item,n)??0),Math.max(0,rule.maxCount-n));};
  const signature=i=>({name:i.name,level:i.level??0,stat_type:i.stat_type??'',
    p:i.p??'',title:i.title??'',...(i.acc?{acc:i.acc}:{}),
    ...(i.rid?{rid:i.rid}:{}),...(i.data!==undefined?{data:i.data}:{})});
  const matchingDemand=(d,i)=>d.item===i.name&&(!d.variant||JSON.stringify(d.variant)===JSON.stringify(signature(i)));
  const count=i=>(p.c.items??[]).reduce((n,x)=>n+
    (x&&JSON.stringify(signature(x))===JSON.stringify(signature(i))?(x.q??1):0),0);
  const potionRoom=(to,item)=>{if(me.role!=='merchant'||!isPotion(item)||!['hpot0','mpot0'].includes(item.name))return Infinity;const h=transport.fresh(to),held=h?.potions?.[item.name]??h?.items?.find(d=>matchingDemand(d,item))?.held;return Number.isSafeInteger(held)&&held>=0?Math.max(0,potionTarget(cfg,item.name)-held):0;};
  const near=name=>{const e=bot.entity(name),h=transport.fresh(name);return e&&h?.running&&!h.rip&&h.realm===p.realm()&&samePlace(p.c,e)&&samePlace(p.c,h)&&distance(p.c,e)<300&&distance(p.c,h)<300?e:null;};
  const safeItem=i=>i&&typeof i.name==='string'&&/^[a-zA-Z0-9_]+$/.test(i.name)&&Number.isInteger(i.level)&&i.level>=0&&i.level<100&&['stat_type','p','title'].every(k=>typeof i[k]==='string'&&i[k].length<161)&&(i.data===undefined||JSON.stringify(i.data).length<=512);
  function pickupSlots(){
    if(me.role!=='farmer')return 0;
    return (p.c.items??[]).reduce((n,item,slot)=>{
      if(!item||protectedItem(item))return n;
      const r=sendRule(item,cfg.party.merchant);
      return n+(r&&availableTransfer(slot,r)>0?1:0);
    },0);
  }
  // Only a job that never reached send_item may issue this proof. A sent or
  // uncertain value action must retain its journal for manual reconciliation.
  function cancelUnsent(j,reason){
    if(!j||!['offered','accepted'].includes(j.state))return false;
    transport.send(j.to,'itemCancel',{notDispatched:true},j.id);
    bot.event?.('logistics.cancelled',{id:j.id,peer:j.to,state:j.state,reason});
    return true;
  }
  function capacity(i,verifiedGear=false,verifiedElixir=false,verifiedTracker=false){
    const rule=ruleFor(i),implicit=Math.max(defaultPotionDemand(i,count(i)),verifiedTracker?1:0);
    // minFreeSlots is a cleanup target, not a pickup embargo. At the live
    // Merchant reserve (4 slots in USIV) legitimate incoming loot must still
    // be accepted if at least one physical slot is actually available.
    const known=!!p.G?.items?.[i?.name]&&bot.economy?.safe?.(i)!==false;
    const pickup=me.role==='merchant'&&cfg.merchant.enabled&&cfg.merchant.pickup&&known?cfg.merchant.maxDelivery:0;
    if((!rule&&!verifiedGear&&!verifiedElixir&&!implicit&&!pickup)||protectedItem(i))return 0;
    const min=me.role==='merchant'?0:cfg.farming.freeSlots;
    // A merchant can receive into a *truly compatible* existing stack even
    // at 0 empty slots. New loot may not consume the recovery workspace.
    if(me.role!=='merchant'&&bot.free()<=min)return 0;
    const pot=isPotion(i),held=count(i);
    const demand=pot&&me.role==='farmer'?
      Math.max(implicit,rule?demandFor(rule,held):0):
      Math.max(rule?demandFor(rule,held):implicit,pickup,verifiedGear?1:0,verifiedElixir?1:0);
    // The carrying target applies independently to HP and MP potions.
    // Aggregating both types wrongly rejected all MP after 3000 HP.
    const nominal=Math.min(demand,pot&&me.role==='farmer'?
      Math.max(0,potionTarget(cfg,i.name)-held):Infinity);
    // Tests using an intentionally minimal adapter may omit G; the actual
    // client always supplies G.items. Unknown definitions in a real G must
    // fail closed rather than be treated as unbounded stack capacity.
    if(!p.G?.items)return nominal;
    // The coordinator owns the hysteretic operating state. An ordinary
    // exactly-four-slot fallback is still allowed until that state starts.
    const pressure=me.role==='merchant'&&cfg.merchant.enabled&&
      bot.merchant?.status?.()?.capacityRecovery===true;
    // Preventive storage's 8-slot margin is a production/exchange guard,
    // not an embargo on an already offered, in-range farmer pickup.
    // A live known-item pickup may spend ONLY the space above the Merchant's
    // separate configured minimum (4 by default). Actual single-stack
    // headroom, variant matching and the durable receive journal still gate
    // the acceptance. Capacity-recovery mode remains an absolute veto on
    // allocating a new slot (compatible stack merges remain possible).
    const storageSlots=bot.storage?.receiveNewSlots?.()??Infinity;
    const merchantMin=Math.max(0,cfg.merchant.minFreeSlots??4);
    const pickupSlots=me.role==='merchant'&&pickup>0?
      Math.max(0,bot.free()-merchantMin):0;
    const maxNewSlots=Math.min(
      pressure&&!verifiedGear&&!verifiedElixir?0:Infinity,
      verifiedGear||verifiedElixir?Infinity:
        pickup>0?Math.max(storageSlots,pickupSlots):storageSlots);
    return Math.min(nominal,physicalReceiveCapacity(p.c.items,i,
      p.G.items[i.name],{maxNewSlots,inventorySize:p.c.isize}));}
  function receive(from,m){
    const d=m.data;if(!d||typeof d!=='object')return;
    if(m.type==='offer'){
      counters.offersReceived++;
      if(bot.checkpoint?.durable===false||bot.lifecycleChanging||bot.movement?.townActive||p.c.c?.town||exec.pending?.has('travel.town')||bot.gold?.reserved||job||incoming||bot.journal||bot.bank?.pending||bot.services?.active||exec.busy('inventory')||bot.inventoryBlocked||completed.has(m.id)||!near(from)||!safeItem(d.item)||!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>1000000)return;
      if(me.role==='merchant'&&(!cfg.merchant.enabled||!cfg.merchant.pickup))return;
      // No durable gear promise before verified receiver slot/stack room.
      if(d.gear&&d.quantity!==1)return;
      const elixirRequested=d.elixir===true&&bot.elixirs?.request?.()?.item===d.item.name;
      const trackerRequested=me.role==='farmer'&&from===cfg.party?.merchant&&
       d.item.name==='tracker'&&!carriedAchievementCarrier(p.c.items)&&
       bot.free()>(cfg.farming.freeSlots??4)&&
       !chooseRule(cfg.items.filter(r=>r.enabled&&r.item==='tracker'),d.item,context())&&
       !!p.G?.items?.tracker;
      const quantity=Math.min(d.quantity,capacity(d.item,!!d.gear,elixirRequested,trackerRequested),cfg.merchant.maxDelivery);if(quantity<1){
       if(Date.now()-lastCapacityWarning>10000){
        lastCapacityWarning=Date.now();
        bot.event?.('logistics.receiveCapacity',{peer:from,item:d.item.name,
         free:bot.free(),code:'OUTPUT_CAPACITY',
         reason:'Kein physischer Platz innerhalb des laufenden Kapazitätsplans; Angebot ohne Annahme zurückgestellt'});
       }
       return;
      }
      if(d.gear&&(quantity!==1||
         !(bot.allocation?.accept(m.id,from,m.session,d.item,d.gear)??false)))return;
      if(bot.services?.waiting){bot.services.interrupt();if(bot.movement.order?.owner==='economy')bot.movement.stop();}
      if(me.role==='merchant')bot.movement?.stop();incoming={id:m.id,from,session:m.session,ownerSession:bot.session,item:d.item,quantity,before:count(d.item),until:clock()+cfg.general.messageTtlMs};
      // Persist BEFORE acknowledgement; a restart cannot safely infer a retry.
      try{bot.beginValue({kind:'receive',...incoming});}catch(e){incoming=null;throw e;}counters.acceptsSent++;transport.send(from,'accept',{quantity,gearAck:d.gear?d.gear.expected:null},m.id);
    }else if(m.type==='itemCancel'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session
      &&d.notDispatched===true&&!incoming.sent&&!incoming.observed&&count(incoming.item)===incoming.before
      &&bot.journal?.kind==='receive'&&bot.journal.id===incoming.id&&bot.journal.from===from&&bot.journal.session===m.session){
      const cancelled=incoming;
      incoming=null;completed.set(m.id,clock());
      bot.event?.('logistics.cancelled',{id:m.id,peer:from,state:'receiving',reason:'Sender bestätigt Nichtversand; Bestand unverändert'});
      bot.endValue('confirmed');
    }else if(m.type==='accept'&&job&&job.state==='offered'&&m.id===job.id&&from===job.to&&m.session===job.session){
      if(!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>job.quantity)return;
      if(job.gear&&d.gearAck!==job.gear.expected)return;job.gearAck=d.gearAck;job.quantity=d.quantity;job.state='accepted';counters.acceptsReceived++;
    }else if(m.type==='sent'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session){incoming.sent=true;}
    else if(m.type==='receipt'&&job&&m.id===job.id&&from===job.to&&m.session===job.session&&d.quantity===job.quantity){job.receipt=true;counters.receiptsReceived++;}
    else if(m.type==='done'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session&&incoming.observed){counters.doneReceived++;completed.set(m.id,clock());incoming=null;bot.endValue('confirmed');}
  }
  function poll(allowOffer=true){
    const now=clock();for(const [id,t] of completed)if(now-t>120000)completed.delete(id);
    for(const [id,t] of nextOffer)if(t<now)nextOffer.delete(id);
    if(incoming){
      const peer=transport.fresh?.(incoming.from);
      const sessionCheck=inspectReceiveSenderSession({
       journal:{...incoming,kind:'receive'},peer,
       ownerSession:bot.session,realm:p.realm(),now:Date.now(),
       ttlMs:cfg.general.messageTtlMs
      });
      if(sessionCheck.changed&&!incoming.senderSessionChangeNoted){
       incoming.senderSessionChangeNoted=true;
       bot.event?.('logistics.senderSessionChangedDuringReceive',{
        id:incoming.id,peer:incoming.from,item:incoming.item.name,
        level:incoming.item.level??0,quantity:incoming.quantity,
        originalSession:incoming.session,newSession:sessionCheck.newSession,
        senderAnnouncedDispatch:!!incoming.sent,
        receiverObservedIncrease:!!incoming.observed,
        reason:sessionCheck.reason,
        outcome:'unknown-until-both-sides-verified',
        journalPreserved:true,autoRetry:false
       });
      }
      if(count(incoming.item)>=incoming.before+incoming.quantity){incoming.observed=true;if(incoming.lastReceipt===undefined||now-incoming.lastReceipt>1500){incoming.lastReceipt=now;counters.receiptsSent++;transport.send(incoming.from,'receipt',{quantity:incoming.quantity},incoming.id);}}
      if(now>incoming.until){const expired=incoming;incoming=null;completed.set(expired.id,now);counters.timeouts++;bot.event?.('logistics.timeout',{
       id:expired.id,state:'receiving',item:expired.item,
       observed:!!expired.observed,
       senderSessionChanged:!!sessionCheck.changed||
        !!expired.senderSessionChangeNoted,
       senderSessionReason:sessionCheck.reason,
       originalSenderSession:expired.session,
       currentSenderSession:sessionCheck.newSession,
       senderAnnouncedDispatch:!!expired.sent,
       journalPreserved:false,autoRetry:false,
       reason:'Itemempfang nicht bestätigt; Versuch abgeschlossen, keine Wiederholung derselben Transfer-ID'
      });bot.endValue('unknown');}
    }
    if(job){
      if(job.state==='sent'&&count(job.item)<=job.before-job.quantity&&job.receipt){if(serviceSite?.name===job.to)serviceSite.at=Date.now();counters.doneSent++;transport.send(job.to,'done',{},job.id);completed.set(job.id,now);job=null;bot.endValue('confirmed');return;}
      if(job.state==='offered'){
        const current=p.c.items[job.slot],rule=current&&sendRule(current,job.to);
        if(fingerprint(current)!==job.fingerprint||availableTransfer(job.slot,rule)<job.quantity){nextOffer.set(job.offerKey??offerKey(job.to,job.item.name),now+5000);cancelUnsent(job,'Bestand oder Itemfreigabe vor Versand verändert');job=null;return;}
        const retryMs=Math.max(500,Math.min(2000,Math.floor(cfg.general.messageTtlMs/3)));
        if(now-(job.lastOffer??0)>=retryMs){
          const peer=transport.fresh(job.to);
          if(peer?.session===job.session){job.lastOffer=now;transport.send(job.to,'offer',{item:job.item,quantity:job.quantity,gear:job.gear,elixir:job.elixir},job.id);}
        }
      }
      if(now>job.until){const expired=job;job=null;completed.set(expired.id,now);counters.timeouts++;nextOffer.set(expired.offerKey??offerKey(expired.to,expired.item.name),now+10000);bot.event?.('logistics.timeout',{id:expired.id,state:expired.state,item:expired.item,reason:'Übergabe nicht bestätigt; keine Wiederholung derselben Transfer-ID'});if(expired.state==='sent')bot.endValue('unknown');else cancelUnsent(expired,'Angebot ohne Versand abgelaufen');return;}
      if(job.state==='accepted'&&!bot.inventoryBlocked){
        const j=job,peer=transport.fresh(j.to);
        // An acceptance is bound to its receiver session. After a reload the
        // new receiver no longer owns the old pending handoff or its receipt.
        if(peer?.session&&peer.session!==j.session){
          nextOffer.set(j.offerKey??offerKey(j.to,j.item.name),now+10000);
          job=null;
          cancelUnsent(j,'Empfängersitzung nach Annahme gewechselt');
          bot.event?.('logistics.session-changed',{id:j.id,peer:j.to,reason:'Empfängersitzung nach Annahme gewechselt; vor Dispatch abgebrochen'});
          return;
        }
        if(peer&&potionRoom(j.to,j.item)<j.quantity){job=null;cancelUnsent(j,'Trankbedarf vor Versand geändert');return;}
        const guard=()=>{const current=p.c.items[j.slot],rule=current&&sendRule(current,j.to);return job===j&&bot.running&&!bot.journal&&!bot.inventoryBlocked&&(bot.allocation?.guard(j)??true)&&transport.fresh(j.to)?.session===j.session&&near(j.to)&&!incoming&&fingerprint(current)===j.fingerprint&&availableTransfer(j.slot,rule)>=j.quantity&&potionRoom(j.to,j.item)>=j.quantity;};
        if(!guard()||!(bot.allocation?.reserve(j)??true)){bot.reason='Lieferung verändert oder Gearreservierung fehlt; keine Übergabe';return;}
        exec.run('send',['inventory'],guard,()=>{
          bot.movement?.stop();bot.beginValue({kind:'send',...j});j.state='sent';counters.sendsStarted++;
          // Message never claims the transfer succeeded. Receipt checks inventory.
          transport.send(j.to,'sent',{},j.id);
          return p.call('send_item',j.to,j.slot,j.quantity);
        },{value:true,observe:()=>job!==j&&completed.has(j.id),timeout:cfg.general.messageTtlMs,onSettle:state=>{if(state==='unknown'&&job===j){bot.endValue('unknown');job=null;}}});
      }
      return;
    }
    if(bot.supplyOnly||bot.checkpoint?.durable===false||bot.gold?.reserved||!allowOffer||incoming||bot.bank?.pending||bot.journal||exec.busy('inventory')||bot.inventoryBlocked||!bot.running)return;
    if(me.role==='merchant'&&bot.services?.active){travel();return;}
    if(me.role==='merchant'&&(!cfg.merchant.enabled||!cfg.merchant.supply))return;
    // Priority is a diagnostic hint only. All existing sendRule,
    // availableTransfer, authenticated-peer, gear-accept and value-journal
    // checks below are mandatory after ordering, without exceptions.
    let hints=[];
    if(me.role==='farmer'&&cfg.merchant.pickup===true){
     try{hints=bot.lootReceipts?.status?.()?.purposeHints??[];}
     catch{hints=[];}
    }
    const candidates=receiptBackedPickupOrder(p.c.items,hints,{
     role:me.role,merchant:cfg.party?.merchant,pickup:cfg.merchant.pickup});
    outer:for(const slot of candidates){
      const item=p.c.items[slot];if(!item||protectedItem(item))continue;
      for(const to of sendRecipients(item)){
        const r=sendRule(item,to);if(!r)continue;
        const key=offerKey(to,item.name);if(nextOffer.has(key))continue;
        const peer=transport.fresh(to);
        // A zero-free-slot heartbeat does not prove a compatible stack is
        // full. Offer only stackable types for a live receiver recheck;
        // never dispatch until its session-bound accept actually arrives.
        const stack=p.G?.items?.[item.name]?.s;
        const stackable=stack===true||Number.isSafeInteger(stack)&&stack>1;
        if(!near(to)||!peerReadyForHandoff(peer,{requiresSlot:!stackable}))continue;
        const demand=(peer.items??[]).find(x=>matchingDemand(x,item)&&Number.isFinite(x.need)&&x.need>0);
        const gear=bot.allocation?.offer(signature(item),to);if(gear===false)continue;
        const elixir=peer.elixir?.item===item.name&&peer.elixir?.quantity===1;// The merchant is a universal destination for farmer loot. It does not
        // enumerate every item variant in its heartbeat, so a demand-only
        // condition silently dropped virtually every equipment/item offer.
        // The receiver still validates physical capacity and the journal.
        const collected=me.role==='farmer'&&to===cfg.party?.merchant&&
          cfg.merchant?.pickup&&r.action==='send'?availableTransfer(slot,r):0;
        const heldPotions=Number.isSafeInteger(peer.potions?.[item.name])?peer.potions[item.name]:demand?.held;
        const potionNeed=me.role==='merchant'&&isPotion(item)&&
          (cfg.merchant.potionTeamRefill!==true||bot.merchant?.potionSupplyActive?.()===true)&&Number.isSafeInteger(heldPotions)&&heldPotions>=0?Math.max(0,potionTarget(cfg,item.name)-heldPotions):0;
        const trackerWanted=me.role==='merchant'&&item.name==='tracker'&&trackerRule(item,to)?1:0;
         const rawWanted=Math.max(demand?.need??0,potionNeed,gear?1:0,elixir?1:0,collected,trackerWanted);const wanted=me.role==='merchant'&&isPotion(item)&&['hpot0','mpot0'].includes(item.name)?Math.min(rawWanted,potionNeed):rawWanted;if(!Number.isSafeInteger(wanted)||wanted<1)continue;
        const quantity=Math.min(availableTransfer(slot,r),cfg.merchant.maxDelivery,wanted);if(quantity<1)continue;
        if(bot.services?.waiting){bot.services.interrupt();if(bot.movement.order?.owner==='economy')bot.movement.stop();}
        job={id:bot.session+':'+(++serial),state:'offered',to,session:peer.session,slot,item:signature(item),fingerprint:fingerprint(item),quantity,gear,elixir,before:count(signature(item)),offerKey:key,lastOffer:now,until:now+Math.min(r.ttlMs,cfg.general.messageTtlMs)};
        nextOffer.set(key,now+5000);counters.offersSent++;transport.send(job.to,'offer',{item:job.item,quantity,gear:job.gear,elixir:job.elixir},job.id);break outer;
      }
    }
  }
  // Finish permitted on-site storage before normal delivery departures.
  // Emergency HP/MP supply may still interrupt the bank batch.
  function localBankBatch(){
   if(p.c.map!=='bank'||bot.bank?.pending||!bot.bank?.capacity?.().some(pack=>pack.map==='bank'&&pack.free>0))return false;
   return (p.c.items??[]).some((i,slot)=>{
    if(!i||!bot.economy?.safe(i))return false;
    const rule=bot.economy.rules(i);
    return rule?.action==='bank'&&bot.economy.remaining(rule)&&bot.economy.spare(slot,rule)>0;
   });
  }
  // The existing handoff protocol can accept a stack-compatible offer even
  // with no physically empty slot. Preserve the bounded on-site batch only
  // while a current, authenticated peer offer has demonstrable stack headroom.
  // Never infer headroom from the peer's lootSlots count alone.
  const mergeableOnSiteOffer=peer=>(peer?.items??[]).some(row=>{
    if(row?.to!==me.name||!Number.isSafeInteger(row.surplus)||row.surplus<1)return false;
    const item=row.variant??{name:row.item,level:0,stat_type:'',p:'',title:''};
    return safeItem(item)&&!!p.G?.items?.[item.name]&&
      physicalReceiveCapacity(p.c.items,item,p.G.items[item.name],
       {maxNewSlots:0,inventorySize:p.c.isize})>0;
  });
  const onSiteRoom=peer=>bot.free()>(cfg.merchant.minFreeSlots??4)||
    mergeableOnSiteOffer(peer);
  function onSitePeer(){
    const peer=transport.fresh(pickupOnSiteName);
    return peer?.running&&!peer.rip&&peer.realm===p.realm()&&
      Number.isSafeInteger(peer.lootSlots)&&peer.lootSlots>0&&
      samePlace(p.c,peer)&&distance(p.c,peer)<=200&&onSiteRoom(peer);
  }
  const servicePoint=h=>bot.strategy?.serviceDestination?bot.strategy.serviceDestination(h):
    bot.strategy?.canVisit?.(h)===false?null:h;
  function actionableGearDelivery(){
    if(me.role!=='merchant'||!cfg.merchant.enabled||!cfg.merchant.supply||
      bot.journal||bot.inventoryBlocked||bot.logistics?.handoffActive)return false;
    return (bot.farmers??[]).some(name=>{
      const peer=transport.fresh(name);
      if(!peer?.running||peer.rip||peer.realm!==p.realm()||
        !servicePoint(peer))return false;
      return p.c.items.some((item,slot)=>{
        if(!item||!p.G?.items?.[item.name]||
          p.G.items[item.name].type==='pot')return false;
        const rule=sendRule(item,name);
        if(!rule||availableTransfer(slot,rule)<1)return false;
        if(!peer.gear){
         const key=name+':'+item.name+':'+(item.level??0),now=Date.now();
         if(now-(gearProofNotice.get(key)??0)>60000){
          gearProofNotice.set(key,now);
          bot.event?.('logistics.gearProofMissing',{peer:name,item:item.name,
           level:item.level??0,reason:'Empfaenger-Gear-Snapshot fehlt im frischen Heartbeat'});
         }
         return false;
        }
        return !!bot.allocation?.offer(signature(item),name);
      });
    });
  }
  function actionableElixirDelivery(){
   if(me.role!=='merchant'||!cfg.merchant.enabled||!cfg.merchant.supply||
      bot.journal||bot.inventoryBlocked||bot.logistics?.handoffActive)return false;
   return (bot.farmers??[]).some(name=>{
    const h=transport.fresh(name);
    if(!h?.running||h.rip||h.realm!==p.realm()||
       h.elixir?.quantity!==1||!h.elixir.item||
       !servicePoint(h))return false;
    return p.c.items.some((item,slot)=>item?.name===h.elixir.item&&
     !!sendRule(item,name)&&availableTransfer(slot,sendRule(item,name))>0);
   });
  }
  function travel(){
    // Keep the ongoing pickup at this location for one bounded batch.
    // Replanning against a rotating 12-item heartbeat must not redirect
    // the Merchant to another farmer between two valid offers.
    if(pickupOnSiteAt&&Date.now()-pickupOnSiteAt<30000&&onSitePeer())return;
    if(bot.recovering||bot.gold?.reserved||me.role!=='merchant'||!cfg.merchant.enabled||job||incoming||bot.inventoryBlocked||bot.journal||bot.bank?.pending||exec.busy('inventory'))return;
    const route=bot.movement?.order;
    // Delivery must not cancel an in-progress gold pickup or economy order.
    // The current owner releases the route after arrival/settlement.
    if(route?.owner==='gold')return;
    if(route?.owner==='economy'){
     // An idle route to bank/market must not indefinitely postpone a proven
     // urgent held gear/elixir delivery. Never interrupt a pending bank,
     // inventory, checkpoint or gold transaction (all guarded above).
     if(!actionableGearDelivery()&&!actionableElixirDelivery())return;
     bot.movement.stop();
     bot.event?.('logistics.deliveryPriority',{
      reason:'Verifizierter freier Gear-/Elixierbestand vor Bankreise'});
    }
    if(route?.owner==='logistics'){
      const h=transport.fresh(route.dest.name),point=h&&servicePoint(h);
      const decision=deliveryRouteDecision(route,h,p.c,{error:cfg.merchant.servicePositionError??70});
      if(decision==='cancel'||h?.realm!==p.realm()||!point){
        bot.movement.stop();
        recentVisit.set(route.dest.name,Date.now()+15000);
        bot.merchant?.finishService?.(route.dest.name,{cooldownMs:15000,reason:'Empfänger momentan nicht sicher erreichbar'});
        bot.event?.('logistics.pursuit',{peer:route.dest.name,decision:'stop',reason:decision==='cancel'?decision:'visit-denied'});
        return;
      }else if(decision==='arrived'){
        bot.movement.stop();
        bot.event?.('logistics.pursuit',{peer:route.dest.name,decision:'stop',reason:decision});
      }else if(decision==='retarget'){
        const mapChanged=!samePlace(route.dest,h);
        if(mapChanged||clock()-lastDeliveryRetarget>1800){
          // Retarget using the latest authenticated, live heartbeat.
          // The movement wrapper cancels the prior smart_move before starting
          // a new one, so the previous map can no longer be the destination.
          bot.movement.stop();lastDeliveryRetarget=clock();
          bot.event?.('logistics.pursuit',{peer:h.name,decision:'retarget',map:h.map,x:h.x,y:h.y,
            shift:distance(route.dest,h),mapChanged});
          bot.movement.go(point,'logistics');
          return;
        }
        return;
      }else return; // Active route is current; do not schedule other jobs.
    }
    const peers=(bot.farmers??[]).map(name=>transport.fresh(name));
    // Legacy/partial configs without the new threshold keep prior pickup semantics.
    const legacyPickup=!Number.isSafeInteger(cfg.merchant.pickupThreshold);
    const {ready:complete,slots:lootSlots,trigger}=teamPickupThreshold(
      peers,p.realm(),cfg.merchant.pickupThreshold??30);
    if(legacyPickup)pickupCycle=true;
    if(trigger&&!pickupCycle){
      pickupCycle=true;
      bot.event?.('logistics.pickupTriggered',{slots:lootSlots,threshold:cfg.merchant.pickupThreshold??30});
    }
    if(complete&&lootSlots<(cfg.merchant.pickupThreshold??30)/2){
      pickupCycle=false;
    }
    if(pickupOnSiteAt&&(Date.now()-pickupOnSiteAt>30000||!onSitePeer()))
      pickupOnSiteAt=0;
    const urgency=name=>{const h=transport.fresh(name);return h?.items?.some(x=>x.need>0)?100+(1-(h.hp/Math.max(1,h.max_hp)))*10:0;};
    for(const [name] of [...transport.peers].sort((a,b)=>(a[0]===bot.merchant?.serviceTarget?.()?-1000:0)-(b[0]===bot.merchant?.serviceTarget?.()?-1000:0)||urgency(b[0])-urgency(a[0]))){const h=transport.fresh(name);if(!h?.running||h.rip||h.realm!==p.realm())continue;
      if((recentVisit.get(name)??0)>Date.now())continue;
      const requested=(h.items??[]).some(x=>cfg.merchant.supply&&x.need>0&&p.c.items.some((i,slot)=>{const r=i&&matchingDemand(x,i)&&sendRule(i,name);return r&&availableTransfer(slot,r)>0;}));
       const gearRequested=cfg.merchant.supply&&p.c.items.some((i,slot)=>{const r=i&&sendRule(i,name);return r&&availableTransfer(slot,r)>0&&!!bot.allocation?.offer(signature(i),name);});
       const elixirRequested=cfg.merchant.supply&&h.elixir?.quantity===1&&p.c.items.some((i,slot)=>{const r=i&&i.name===h.elixir.item&&sendRule(i,name);return r&&availableTransfer(slot,r)>0;});
       const directPotions=cfg.merchant.supply&&
         (cfg.merchant.potionTeamRefill!==true||bot.merchant?.potionSupplyActive?.()===true)&&
         ['hpot0','mpot0'].some(id=>
         Number.isSafeInteger(h.potions?.[id])&&h.potions[id]>=0&&
         h.potions[id]<potionTarget(cfg,id)&&
         p.c.items.some(i=>i?.name===id&&!!sendRule(i,name)&&
           availableTransfer(p.c.items.indexOf(i),sendRule(i,name))>0));
       const trackerRequested=cfg.merchant.supply&&p.c.items.some((i,slot)=>i?.name==='tracker'&&!!trackerRule(i,name)&&availableTransfer(slot,trackerRule(i,name))>0);
       const demand=requested||directPotions||gearRequested||elixirRequested||trackerRequested;
      const pickup=cfg.merchant.pickup&&pickupCycle&&(h.items??[]).some(x=>{const item=x.variant??{name:x.item,level:0,stat_type:'',p:'',title:''};return x.to===me.name&&x.surplus>0&&safeItem(item)&&!!p.G?.items?.[item.name];});
      const point=(demand||pickup)&&servicePoint(h);
      if(point){
        const urgent=demand&&(h.items??[]).some(x=>x.need>0&&p.G?.items?.[x.item]?.type==='pot'&&(x.held===0||h.hp/Math.max(1,h.max_hp)<cfg.farming.hpBelow||h.mp/Math.max(1,h.max_mp)<cfg.farming.mpBelow));if(!urgent&&!pickup&&!gearRequested&&localBankBatch())continue;
        // Plan and complete inventory preparation BEFORE leaving for the
        // farmer. A full inventory must not hide its own pickup demand.
        if(pickup){
          const permission=bot.merchant?.prepareDeparture?
            bot.merchant.prepareDeparture(h):bot.merchant?.preparePickup?.(h);
          if(permission===false)return;
        }
        if(bot.merchant?.claimService?.(name,urgent)===false)continue;
        if(bot.movement?.order?.owner==="gold")bot.movement.stop();
        if(bot.services?.active||bot.services?.waiting){bot.services.interrupt();if(bot.services.restore())return;}
        if(samePlace(p.c,h)&&distance(p.c,h)<=200){
          if(serviceSite?.name!==name){serviceSite={name,at:Date.now()};
           bot.event?.('logistics.serviceOnSite',{peer:name,leaseMs:ONSITE_MS,gearRequested,trackerRequested});
          }else if(Date.now()-serviceSite.at>=ONSITE_MS){
           // No transfer journal is in progress (travel() admission guard).
           // Finish this visit rather than restarting the same route after
           // a Town/bank detour to pursue an undeliverable, stale demand.
           serviceSite=null;recentVisit.set(name,Date.now()+30000);
           bot.merchant?.finishService?.(name,{cooldownMs:30000,reason:'Empfangsfenster ohne weitere bestätigte Übergabe beendet'});
           bot.event?.('logistics.serviceExhausted',{peer:name,reason:'No further on-site handoff within bounded window'});
           continue;
          }
          if(pickup&&onSiteRoom(h)){
            if(pickupOnSiteName!==name||!pickupOnSiteAt){
              pickupOnSiteName=name;pickupOnSiteAt=Date.now();
              bot.event?.('logistics.pickupOnSite',{peer:name,free:bot.free(),
                offeredSlots:h.lootSlots??0,leaseMs:30000});
            }
          }
          return;
        }
        if(bot.movement.order?.owner==='economy'){if(!demand)continue;bot.movement.stop();}bot.reason='Lieferweg zu '+name;lastDeliveryRetarget=clock();
        const started=bot.movement.go(point,'logistics');
        if(started||bot.movement.order?.owner==='logistics')bot.event?.('logistics.pursuit',{peer:name,decision:'depart',map:h.map,x:h.x,y:h.y});
        else {recentVisit.set(name,Date.now()+2000);bot.event?.('logistics.pursuitDeferred',{peer:name,reason:'movement-admission-failed'});}
        return;
      }
    }
  }
  function yieldUnsent(reason='Anderer Werttransfer hat Vorrang'){
    if(!job||!['offered','accepted'].includes(job.state))return false;
    const old=job;job=null;
    nextOffer.set(old.offerKey??offerKey(old.to,old.item.name),clock()+10000);
    cancelUnsent(old,reason);
    return true;
  }
  return {receive,poll,travel,actionableGearDelivery,actionableElixirDelivery,yieldUnsent,pickupSlots,
    pickupOnSite:()=>!!pickupOnSiteAt&&Date.now()-pickupOnSiteAt<30000&&
      onSitePeer(),
    onSiteServiceWindow:()=>!!serviceSite&&Date.now()-serviceSite.at<ONSITE_MS&&
      !!transport.fresh(serviceSite.name)?.running&&
      samePlace(p.c,transport.fresh(serviceSite.name))&&
      distance(p.c,transport.fresh(serviceSite.name))<=200,
    get pickupCycle(){return pickupCycle;},get handoffActive(){return !!incoming||!!job&&job.state!=='offered';},get itemReserved(){return !!(job||incoming);},get reserved(){return !!(job||incoming||bot.gold?.reserved);},stats(){return {...counters};},
    summary(){
      const rules=allRules().filter(r=>r.enabled&&(r.role==='all'||r.role===me.role)&&(!r.character||r.character===me.name));
      const variants=new Map();for(const r of rules){const candidates=p.c.items.filter(i=>i?.name===r.item&&(i.level??0)>=r.minLevel&&(i.level??0)<=r.maxLevel);if(!candidates.length)candidates.push({name:r.item,level:r.minLevel,stat_type:r.statType,p:r.property,title:r.title});for(const i of candidates){const sig=signature(i);variants.set(JSON.stringify(sig),sig);}}
      if(me.role==='farmer')for(const i of p.c.items??[]){
        if(!i||!p.G?.items?.[i.name]||protectedItem(i))continue;
        const sig=signature(i);variants.set(JSON.stringify(sig),sig);
      }
      if(me.role==='farmer')for(const name of ['hpot0','mpot0']){
        const item={name,level:0,stat_type:'',p:'',title:''};
        if(isPotion(item)&&!variants.has(JSON.stringify(item)))variants.set(JSON.stringify(item),item);
      }
      if(me.role==='farmer'&&p.G?.items?.tracker&&
        trackerDeliveryNeed({running:true,rip:false,realm:p.realm(),
         achievementCarrier:carriedAchievementCarrier(p.c.items),
         inventoryBlocked:!!bot.inventoryBlocked,journal:!!bot.journal,
         free:physicalInventoryCapacity(p.c.items,{inventorySize:p.c.isize})?.free??0},p.realm(),{reserve:cfg.farming?.freeSlots??4})){
        const item={name:'tracker',level:0,stat_type:'',p:'',title:''};
        variants.set(JSON.stringify(item),item);
      }
      const all=[...variants.values()],result=[];let bytes=0;
      for(let n=0;n<Math.min(12,all.length);n++){const item=all[(summaryOffset+n)%all.length],r=ruleFor(item),
        transfer=me.role==='farmer'?sendRule(item,cfg.party.merchant):null,
        countNow=count(item),row={item:item.name,variant:item,
        need:r?demandFor(r,countNow):item.name==='tracker'&&me.role==='farmer'&&
          trackerDeliveryNeed({running:true,rip:false,realm:p.realm(),
           achievementCarrier:carriedAchievementCarrier(p.c.items),
           inventoryBlocked:!!bot.inventoryBlocked,journal:!!bot.journal,
           free:physicalInventoryCapacity(p.c.items,{inventorySize:p.c.isize})?.free??0},p.realm(),{reserve:cfg.farming?.freeSlots??4})?1:
           defaultPotionDemand(item,countNow,true),
        held:isPotion(item)?countNow:undefined,
        surplus:transfer?Math.max(0,countNow-transfer.keep-transfer.teamReserve-
          (bot.production?.reservedQuantity?.(item,transfer.recipient)??0)):0,
        to:transfer?transfer.recipient:''},size=JSON.stringify(row).length;if(bytes+size>2200&&result.length)break;result.push(row);bytes+=size;}
      summaryOffset=(summaryOffset+result.length)%Math.max(1,all.length);return result;
    },
    close(){if(incoming||job?.state==='sent')bot.endValue('unknown');else if(job)cancelUnsent(job,'Sender STOP/Pause vor Versand');job=null;incoming=null;}
  };
}
