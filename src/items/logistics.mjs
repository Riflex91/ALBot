import {protectedItem,variantCount,transferable,fingerprint,distance,samePlace,chooseRule} from '../core/policy.mjs';
export function createLogistics(bot){
  const {p,cfg,me,exec,transport}=bot;let job=null,incoming=null,serial=0,summaryOffset=0;const completed=new Map(),nextOffer=new Map();
  const counters={offersSent:0,offersReceived:0,acceptsSent:0,acceptsReceived:0,sendsStarted:0,receiptsSent:0,receiptsReceived:0,doneSent:0,doneReceived:0,timeouts:0};
  const offerKey=(to,item)=>to+'\u0000'+item;
  const ruleFor=(item)=>bot.rule(item);
  const context=()=>({role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:me.role==='merchant'?'supply':'farm'});
  const sendRecipients=item=>[...new Set(cfg.items.filter(r=>r.enabled&&r.action==='send'&&r.item===item.name&&r.recipient&&r.recipient!==me.name).map(r=>r.recipient))];
  const sendRule=(item,to)=>{const r=chooseRule(cfg.items.filter(r=>r.enabled&&(r.action==='keep'||r.action==='send'&&r.recipient===to)),item,context());return r?.action==='send'&&!bot.production?.reserved(item)?r:null;};
  const demandFor=(rule,n)=>{if(!rule)return 0;const threshold=(rule.requestBelow??0)>0?rule.requestBelow:rule.targetCount;return n<=threshold?Math.max(0,Math.min(rule.targetCount,rule.maxCount)-n):0;};
  const signature=i=>({name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??''});
  const matchingDemand=(d,i)=>d.item===i.name&&(!d.variant||JSON.stringify(d.variant)===JSON.stringify(signature(i)));
  const count=i=>(p.c.items??[]).reduce((n,x)=>n+(x&&x.name===i.name&&(x.level??0)===i.level&&(x.stat_type??'')===i.stat_type&&(x.p??'')===i.p&&(x.title??'')===i.title?(x.q??1):0),0);
  const near=name=>{const e=bot.entity(name),h=transport.fresh(name);return e&&h?.running&&!h.rip&&h.realm===p.realm()&&samePlace(p.c,e)&&samePlace(p.c,h)&&distance(p.c,e)<300&&distance(p.c,h)<300?e:null;};
  const safeItem=i=>i&&typeof i.name==='string'&&/^[a-zA-Z0-9_]+$/.test(i.name)&&Number.isInteger(i.level)&&i.level>=0&&i.level<100&&['stat_type','p','title'].every(k=>typeof i[k]==='string'&&i[k].length<161);
  function capacity(i){const rule=ruleFor(i);if(!rule||protectedItem(i))return 0;const min=me.role==='merchant'?cfg.merchant.minFreeSlots:cfg.farming.freeSlots;if(bot.free()<=min)return 0;return demandFor(rule,count(i));}
  function receive(from,m){
    const d=m.data;if(!d||typeof d!=='object')return;
    if(m.type==='offer'){
      counters.offersReceived++;
      if(bot.checkpoint?.durable===false||job||incoming||bot.journal||exec.busy('inventory')||bot.inventoryBlocked||completed.has(m.id)||!near(from)||!safeItem(d.item)||!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>1000000)return;
      if(me.role==='merchant'&&(!cfg.merchant.enabled||!cfg.merchant.pickup))return;
      const quantity=Math.min(d.quantity,capacity(d.item),cfg.merchant.maxDelivery);if(quantity<1)return;
      incoming={id:m.id,from,session:m.session,item:d.item,quantity,before:count(d.item),until:Date.now()+cfg.general.messageTtlMs};
      // Persist BEFORE acknowledgement; a restart cannot safely infer a retry.
      try{bot.beginValue({kind:'receive',...incoming});}catch(e){incoming=null;throw e;}counters.acceptsSent++;transport.send(from,'accept',{quantity},m.id);
    }else if(m.type==='accept'&&job&&job.state==='offered'&&m.id===job.id&&from===job.to&&m.session===job.session){
      if(!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>job.quantity)return;
      job.quantity=d.quantity;job.state='accepted';counters.acceptsReceived++;
    }else if(m.type==='sent'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session){incoming.sent=true;}
    else if(m.type==='receipt'&&job&&m.id===job.id&&from===job.to&&m.session===job.session&&d.quantity===job.quantity){job.receipt=true;counters.receiptsReceived++;}
    else if(m.type==='done'&&incoming&&m.id===incoming.id&&from===incoming.from&&m.session===incoming.session&&incoming.observed){counters.doneReceived++;completed.set(m.id,Date.now());incoming=null;bot.endValue('confirmed');}
  }
  function poll(allowOffer=true){
    const now=Date.now();for(const [id,t] of completed)if(now-t>120000)completed.delete(id);
    for(const [id,t] of nextOffer)if(t<now)nextOffer.delete(id);
    if(incoming){
      if(count(incoming.item)>=incoming.before+incoming.quantity){incoming.observed=true;if(now-(incoming.lastReceipt??0)>1500){incoming.lastReceipt=now;counters.receiptsSent++;transport.send(incoming.from,'receipt',{quantity:incoming.quantity},incoming.id);}}
      if(now>incoming.until){counters.timeouts++;bot.endValue('unknown');incoming=null;}
    }
    if(job){
      if(job.state==='sent'&&count(job.item)<=job.before-job.quantity&&job.receipt){counters.doneSent++;transport.send(job.to,'done',{},job.id);completed.set(job.id,now);job=null;bot.endValue('confirmed');return;}
      if(now>job.until){counters.timeouts++;if(job.state==='sent'||job.state==='accepted')bot.endValue('unknown');nextOffer.set(job.offerKey??offerKey(job.to,job.item.name),now+10000);job=null;return;}
      if(job.state==='accepted'&&!bot.inventoryBlocked){
        const j=job;
        const guard=()=>{const current=p.c.items[j.slot],rule=current&&sendRule(current,j.to);return bot.running&&near(j.to)&&!incoming&&fingerprint(current)===j.fingerprint&&transferable(p.c.items,j.slot,rule)>=j.quantity;};
        if(!guard()){bot.reason='Lieferung verändert; keine Übergabe';return;}
        exec.run('send',['inventory'],guard,()=>{
          bot.beginValue({kind:'send',...j});j.state='sent';counters.sendsStarted++;
          // Message never claims the transfer succeeded. Receipt checks inventory.
          transport.send(j.to,'sent',{},j.id);
          return p.call('send_item',j.to,j.slot,j.quantity);
        },{value:true,observe:()=>job!==j&&completed.has(j.id),timeout:cfg.general.messageTtlMs,onSettle:state=>{if(state==='unknown'&&job===j){bot.endValue('unknown');job=null;}}});
      }
      return;
    }
    if(bot.checkpoint?.durable===false||!allowOffer||incoming||bot.inventoryBlocked||!bot.running)return;
    if(me.role==='merchant'&&(!cfg.merchant.enabled||!cfg.merchant.supply))return;
    outer:for(let slot=0;slot<p.c.items.length;slot++){
      const item=p.c.items[slot];if(!item||protectedItem(item))continue;
      for(const to of sendRecipients(item)){
        const r=sendRule(item,to);if(!r)continue;
        const key=offerKey(to,item.name);if(nextOffer.has(key))continue;
        const peer=transport.fresh(to);if(!near(to)||!peer)continue;
        const demand=(peer.items??[]).find(x=>matchingDemand(x,item)&&Number.isFinite(x.need)&&x.need>0);if(!demand)continue;
        const quantity=Math.min(transferable(p.c.items,slot,r),cfg.merchant.maxDelivery,Math.floor(demand.need));if(quantity<1)continue;
        job={id:bot.session+':'+(++serial),state:'offered',to,session:peer.session,slot,item:signature(item),fingerprint:fingerprint(item),quantity,before:count(signature(item)),offerKey:key,until:now+Math.min(r.ttlMs,cfg.general.messageTtlMs)};
        nextOffer.set(key,now+5000);counters.offersSent++;transport.send(job.to,'offer',{item:job.item,quantity},job.id);break outer;
      }
    }
  }
  function travel(){
    if(me.role!=='merchant'||!cfg.merchant.enabled||job||incoming||bot.inventoryBlocked)return;
    for(const [name] of transport.peers){const h=transport.fresh(name);if(!h?.running||h.rip||h.realm!==p.realm())continue;
      const demand=(h.items??[]).some(x=>cfg.merchant.supply&&x.need>0&&p.c.items.some(i=>{const r=i&&matchingDemand(x,i)&&sendRule(i,name);return r&&variantCount(p.c.items,i)>r.keep+r.teamReserve;}));
      const pickup=cfg.merchant.pickup&&(h.items??[]).some(x=>x.to===me.name&&x.surplus>0);
      if((demand||pickup)&&(!samePlace(p.c,h)||distance(p.c,h)>200)){bot.reason='Lieferweg zu '+name;bot.movement.go({...h,radius:120},'logistics');return;}
    }
  }
  return {receive,poll,travel,get reserved(){return !!(job||incoming);},stats(){return {...counters};},
    summary(){
      const rules=cfg.items.filter(r=>r.enabled&&(r.role==='all'||r.role===me.role)&&(!r.character||r.character===me.name));
      const variants=new Map();for(const r of rules){const candidates=p.c.items.filter(i=>i?.name===r.item&&(i.level??0)>=r.minLevel&&(i.level??0)<=r.maxLevel);if(!candidates.length)candidates.push({name:r.item,level:r.minLevel,stat_type:r.statType,p:r.property,title:r.title});for(const i of candidates){const sig=signature(i);variants.set(JSON.stringify(sig),sig);}}
      const all=[...variants.values()],page=all.slice(summaryOffset,summaryOffset+12);summaryOffset=(summaryOffset+12)%Math.max(1,all.length);
      return page.map(item=>{const r=ruleFor(item),n=count(item);return {item:item.name,variant:item,need:demandFor(r,n),surplus:r?.action==='send'?Math.max(0,n-r.keep-r.teamReserve):0,to:r?.action==='send'?r.recipient:''};});
    },
    close(){if(incoming||job?.state==='sent'||job?.state==='accepted')bot.endValue('unknown');job=null;incoming=null;}
  };
}
