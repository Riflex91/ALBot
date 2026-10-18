import {fingerprint,identity} from '../core/policy.mjs';
import {gearCompatible} from './gear.mjs';
import {variantCount,surplusQuantity} from '../core/policy.mjs';
import {capacityAfterConsumption} from '../items/physical-capacity.mjs';

// Verified at source: a pscroll is consumed by the EXISTING upgrade handler.
// The server consumes [1,10,100,1000,9999,...] scrolls at current item
// grade, preserves the equipment level and changes stat_type on success.
// Unknown grade or scroll definitions must not silently become 1 scroll.
const N01_SCROLL_QUANTITIES=[1,10,100,1000,9999,9999,9999];
const N01_STAT_TYPES=new Set(['str','int','dex','vit']);
export function statTailoringCandidate(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 if(me?.role!=='merchant'||!bot.running||!cfg.production?.enabled||
    cfg.production.gear!==true||
    !Array.isArray(cfg.production.gearTargets)||
    !Array.isArray(cfg.characters)||!Array.isArray(p.c?.items)||
    typeof p.call!=='function'||!p.G?.items)return null;
 for(const target of cfg.production.gearTargets){
  if(!target?.enabled||!N01_STAT_TYPES.has(target.statType)||
     typeof target.item!=='string'||!Number.isSafeInteger(target.level)||
     !Number.isFinite(target.budget)||target.budget<0)continue;
  const member=cfg.characters.find(c=>c.enabled&&c.name===target.character);
  const profile=target.character===me.name?
   bot.gear?.snapshot?.():bot.gear?.profile?.(target.character);
  if(!member||!profile?.complete||!profile.slots||
     profile.class!==member.class||profile.realm!==p.realm()||
     !Number.isSafeInteger(profile.at)||profile.at>Date.now()||
     Date.now()-profile.at>60000||
     (profile.slots[target.slot]?.name===target.item&&
      (profile.slots[target.slot]?.level??0)>=target.level&&
      profile.slots[target.slot]?.stat_type===target.statType)||
     !Number.isSafeInteger(profile.level)||profile.level<1||
     !gearCompatible(p.G,profile,{name:target.item,level:target.level},target.slot))
   continue;
  const meta=p.G.items[target.item];
  if(!meta?.upgrade||!meta?.stat)continue;
  for(let slot=0;slot<p.c.items.length;slot++){
   const item=p.c.items[slot];
   if(!item||item.name!==target.item||(item.level??0)!==target.level||
      item.stat_type!==undefined||!e?.safe?.(item)||
      e.explicit?.(item,'inventory')?.action==='keep'||
      e.explicit?.(item,'production')?.action==='keep')continue;
   let grade;
   try{grade=p.call('item_grade',item);}catch{continue;}
   if(!Number.isSafeInteger(grade)||grade<0||
      grade>=N01_SCROLL_QUANTITIES.length)continue;
   const needed=N01_SCROLL_QUANTITIES[grade];
   const idx=p.c.items.findIndex((s,n)=>n!==slot&&s&&
    p.G.items[s.name]?.type==='pscroll'&&
    p.G.items[s.name].stat===target.statType&&
    Number.isFinite(p.G.items[s.name].grade)&&
    p.G.items[s.name].grade>=grade&&
    e.safe(s)&&Number.isSafeInteger(s.q??1)&&
    (s.q??1)>=needed&&
    e.explicit?.(s,'inventory')?.action!=='keep'&&
    e.explicit?.(s,'production')?.action!=='keep'&&
    (e.count?.(s)??0)-(bot.production?.reservedQuantity?.(s)??0)>=
      needed+(e.rules?.(s)?.keep??0)+(e.rules?.(s)?.teamReserve??0));
   if(idx<0)continue;
   const scroll=p.c.items[idx],price=e.value?.(scroll),
    gearValue=e.value?.(item);
   if(!Number.isFinite(price)||price<0||
      !Number.isFinite(gearValue)||gearValue<0||
      !Number.isFinite(price*needed+gearValue)||
      price*needed+gearValue>target.budget)continue;
   return {target,slot,scrollSlot:idx,item:{...item},scroll:{...scroll},
    grade,needed,loss:price*needed+gearValue,
    sourcePrint:fingerprint(item),scrollPrint:fingerprint(scroll)};
  }
 }
 return null;
}
// G12: only an exact Merchant item rule opts in to de-statting. Unlike the
// live pscroll upgrade it returns grade-dependent scrolls from the NPC and
// spends gold. No destat rule is inferred from equipment goals or stock age.
export function destatCandidate(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 if(me?.role!=='merchant'||!bot.running||cfg.production?.enabled!==true||
    !Array.isArray(cfg.items)||!Array.isArray(p.c?.items)||
    !p.G?.items||p.has?.('destat')!==true)return null;
 const ref=p.G.maps?.desertland?.ref?.scrollsmith;
 if(!Number.isFinite(ref?.x)||!Number.isFinite(ref?.y))return null;
 const d={x:ref.x,y:ref.y,map:'desertland'};
 for(let slot=0;slot<p.c.items.length;slot++){
  const item=p.c.items[slot],rule=item&&e.explicit?.(item,'production');
  if(!item||!e.safe?.(item)||!rule||rule.action!=='destat'||
     rule.enabled!==true||rule.role!=='merchant'||
     rule.character!==me.name||rule.statType!==item.stat_type||
     !item.stat_type||!N01_STAT_TYPES.has(item.stat_type)||
     rule.minLevel!==(item.level??0)||rule.maxLevel!==(item.level??0)||
     !Number.isSafeInteger(rule.keep)||rule.keep<1||
     !Number.isSafeInteger(rule.teamReserve)||rule.teamReserve<0||
     !Number.isSafeInteger(rule.maxActions)||rule.maxActions<1||rule.maxActions>20||
     !Number.isSafeInteger(rule.batch)||rule.batch<1||
     cfg.production.gearTargets?.some(g=>g.enabled&&g.item===item.name&&
       g.level===(item.level??0))||
     !p.G.items[item.name]||!p.G.items[item.name].stat)continue;
  const held=variantCount(p.c.items,item),
   reserved=bot.production?.reservedQuantity?.(item);
  if(!Number.isSafeInteger(held)||!Number.isSafeInteger(reserved)||
     surplusQuantity(held,reserved,rule.keep,rule.teamReserve)<1)
   continue;
  let grade;
  try{grade=p.call('item_grade',{name:item.name,level:0});}
  catch{continue;}
  if(!Number.isSafeInteger(grade)||grade<0||
     grade>=N01_SCROLL_QUANTITIES.length)continue;
  const needed=N01_SCROLL_QUANTITIES[grade],
   scrollName=item.stat_type==='mp_cost'?'mpcostscroll':item.stat_type+'scroll',
   scrollMeta=p.G.items[scrollName];
  if(!scrollMeta||!Number.isFinite(scrollMeta.g)||scrollMeta.g<=0)
   continue;
  const cost=needed*scrollMeta.g*10;
  if(!Number.isSafeInteger(cost)||cost<=0||
     !Number.isSafeInteger(p.c.gold)||p.c.gold<cost||
     !Number.isFinite(rule.goldBudget)||cost>rule.goldBudget)continue;
  const output={name:scrollName,level:0},
   room=capacityAfterConsumption(p.c.items,[],output,scrollMeta,
    {inventorySize:p.c.isize});
  if(!room||room.units<needed)continue;
  const beforeValue=e.value?.(item),afterValue=e.value?.({
   ...item,stat_type:undefined});
  if(!Number.isFinite(beforeValue)||!Number.isFinite(afterValue)||
     beforeValue<0||afterValue<0)continue;
  const loss=Math.max(0,beforeValue-afterValue);
  if(!Number.isSafeInteger(loss)||loss>rule.lossBudget)continue;
  return {slot,item:{...item},rule,grade,needed,cost,loss,scrollName,
   scrollMeta,output,d,held,scrollBefore:variantCount(p.c.items,output),
   sourcePrint:fingerprint(item)};
 }
 return null;
}
export function createStatTailoring(bot){
 const {p,cfg,me}=bot;let preview=null;
 const proof=plan=>JSON.stringify([p.G.version,p.G.items?.[plan.item.name],
  p.G.items?.[plan.scroll.name],cfg.production?.gear,
  cfg.production?.minChance,cfg.production?.gearTargets,cfg.items,
  plan.sourcePrint,plan.scrollPrint,plan.grade,plan.needed,plan.loss]);
 function ready(plan,initial){
  if(!bot.running||bot.journal||bot.inventoryBlocked||
     bot.bank?.pending||bot.logistics?.reserved||p.c.rip||
     proof(plan)!==initial)return false;
  const fresh=statTailoringCandidate(bot);
  return !!fresh&&fresh.slot===plan.slot&&
   fresh.scrollSlot===plan.scrollSlot&&
   fresh.sourcePrint===plan.sourcePrint&&fresh.scrollPrint===plan.scrollPrint&&
   fresh.needed===plan.needed&&fresh.loss===plan.loss&&
   fresh.target===plan.target;
 }
 function tick(){
  if(me.role!=='merchant'||bot.journal||bot.inventoryBlocked||
     bot.exec?.busy?.('economy'))return false;
  const plan=statTailoringCandidate(bot);
  if(!plan){preview=null;return false;}
  const initial=proof(plan),key=JSON.stringify([plan.slot,plan.scrollSlot,initial]),
   d=bot.economy.destination?.('newupgrade')??
     bot.economy.destination?.('upgrade');
  if(!d||!bot.economy.npcTravel?.(d,'Stat-Tailoring'))return false;
  if(!preview||preview.key!==key||Date.now()-preview.at>5000){
   const quote={key,at:Date.now(),chance:null};preview=quote;
   const accepted=bot.exec.run('production.stat-preview',['economy'],
    ()=>preview===quote&&ready(plan,initial)&&bot.economy.npcAt(d),
    ()=>Promise.resolve(p.call('upgrade',plan.slot,plan.scrollSlot,null,true))
     .then(r=>{
      if(preview!==quote||!ready(plan,initial))return;
      if(r?.calculate===true&&r?.scroll===plan.scroll.name&&
         r?.item?.name===plan.item.name&&
         (r.item.level??0)===(plan.item.level??0)&&
         r.item.stat_type===undefined&&r?.chance>=0&&r.chance<=1)
       quote.chance=r.chance;
     }),{delay:1000});
   if(!accepted)preview=null;
   return accepted;
  }
  const minimum=Math.max(cfg.production.minChance??1,.65);
  if(!Number.isFinite(preview.chance)||preview.chance<minimum)return false;
  const beforeScroll=plan.scroll.q??1,at=preview.at;
  return bot.economy.perform('upgrade',{
   slots:[plan.slot,plan.scrollSlot],loss:plan.loss,cost:0,
   guard:()=>Date.now()-at<5000&&preview?.key===key&&
     preview.chance>=Math.max(cfg.production.minChance??1,.65)&&
     ready(plan,initial)&&bot.economy.npcAt(d),
   call:()=>p.call('upgrade',plan.slot,plan.scrollSlot,null),
   observe:()=>{
    const actual=p.c.items?.[plan.slot],held=p.c.items?.[plan.scrollSlot];
    return actual?.name===plan.item.name&&
     (actual.level??0)===(plan.item.level??0)&&
     actual.stat_type===plan.target.statType&&
     !p.c.q?.upgrade&&
     (!held||held.name!==plan.scroll.name||
      Number.isSafeInteger(held.q??1)&&
      beforeScroll-(held.q??1)>=plan.needed);
   },
   onConfirmed:()=>{preview=null;return true;},
   details:{item:plan.item.name,variant:identity(plan.item),
    recipient:plan.target.character,gearSlot:plan.target.slot,
    statType:plan.target.statType,quantity:plan.needed,
    riskVariant:identity(plan.item),before:plan.item.level??0},timeout:45000
  });
 }
 function destatTick(){
  if(me.role!=='merchant'||bot.journal||bot.inventoryBlocked||
     bot.exec?.busy?.('economy'))return false;
  const plan=destatCandidate(bot);
  if(!plan||!bot.economy.npcTravel?.(plan.d,'De-Statting'))return false;
  const policy=JSON.stringify([cfg.items,cfg.production?.gearTargets,
   cfg.production?.enabled,p.G.version,p.G.items[plan.item.name],
   p.G.items[plan.scrollName]]);
  const ready=()=>{
   if(!bot.running||bot.journal||bot.inventoryBlocked||
      bot.bank?.pending||bot.logistics?.reserved||p.c.rip||
      !bot.economy.npcAt?.(plan.d)||
      policy!==JSON.stringify([cfg.items,cfg.production?.gearTargets,
       cfg.production?.enabled,p.G.version,p.G.items[plan.item.name],
       p.G.items[plan.scrollName]]))return false;
   const fresh=destatCandidate(bot);
   return !!fresh&&fresh.slot===plan.slot&&fresh.rule===plan.rule&&
    fresh.sourcePrint===plan.sourcePrint&&fresh.scrollName===plan.scrollName&&
    fresh.needed===plan.needed&&fresh.cost===plan.cost&&
    fresh.loss===plan.loss&&fresh.scrollBefore===plan.scrollBefore;
  };
  let response=null,beforeGold=null;
  const expected={...plan.item,stat_type:undefined};
  return bot.economy.perform('destat',{
   slots:[plan.slot],cost:plan.cost,loss:plan.loss,rule:plan.rule,
   guard:ready,
   call:()=>{
    beforeGold=p.c.gold;
    return Promise.resolve(p.call('destat',plan.slot))
     .then(result=>{response=result;return result;});
   },
   observe:()=>response?.num===plan.slot&&
    response.scroll===plan.scrollName&&response.quantity===plan.needed&&
    response.cost===plan.cost&&response.failed!==true&&
    response.success!==false&&p.c.gold===beforeGold-plan.cost&&
    fingerprint(p.c.items[plan.slot])===fingerprint(expected)&&
    variantCount(p.c.items,plan.item)===plan.held-1&&
    variantCount(p.c.items,plan.output)===plan.scrollBefore+plan.needed,
   details:{item:plan.item.name,variant:identity(plan.item),
    scroll:plan.scrollName,quantity:plan.needed,fee:plan.cost,
    riskVariant:identity(plan.item),before:plan.held},timeout:45000
  });
 }
 return {tick,destatTick,status:()=>{const candidate=statTailoringCandidate(bot);
  return {mode:'explicit-gear-targets-only',enabled:!!candidate,
   pendingPreview:!!preview,minimum:Math.max(cfg.production?.minChance??1,.65),
   candidate:candidate?{item:candidate.item.name,target:candidate.target.character,
    requiredScrolls:candidate.needed}:null};},close(){preview=null;}};
}
