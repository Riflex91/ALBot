import {identity,protectedItem} from '../core/policy.mjs';
import {capacityAfterConsumption,physicalInventoryCapacity} from '../items/physical-capacity.mjs';
import {planPhysicalSlotSequence} from '../items/slot-sequence.mjs';
import {exchangeDrops,materialSources} from '../production/materials.mjs';
import {itemPurposes} from '../items/purposes.mjs';
import {defaultsFor} from '../../editor/lib/contract.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';

// Worst-case slots, never the average gold return, authorize an exchange.
export function forecastExchange(G,items,slot,quantity,{inventorySize}={}){
 const next=capacityAfterConsumption(items,[{slot,quantity}],null,null,{inventorySize});
 if(!next)return {known:false,reason:'invalid-consumption'};
 const table=G.drops?.[items[slot]?.name],rows=exchangeDrops(G,table);
 if(!rows.length||rows.some(r=>r.item==='open'))return {known:false,reason:'unknown-rewards'};
 // Nested tables with unknown branches must not disappear in flattening.
 const complete=(t,seen=new Set())=>Array.isArray(t)&&t.length>0&&t.every(r=>Array.isArray(r)&&Number.isFinite(r[0])&&r[0]>=0&&typeof r[1]==='string'&&
  (r[1]==='open'||r[2]===undefined||Number.isSafeInteger(r[2])&&r[2]>0)&&
  (r[1]!=='open'||typeof r[2]==='string'&&!seen.has(r[2])&&seen.size<8&&complete(G.drops?.[r[2]],new Set([...seen,r[2]]))));
 if(!complete(table))return {known:false,reason:'incomplete-rewards'};
 // Adventure Land rewards include non-inventory outcomes. The official
 // drop schema uses 'gold' (wallet), 'shells' (account currency), and
 // 'empty' (no reward). None occupies an inventory slot. Keep every other
 // unknown result fail-closed instead of treating it as a zero-slot reward.
 const nonInventoryRewards=new Set(['gold','shells','empty']);
 // Variants/levels in reward definitions may differ from carried stacks:
 // reserve new slots instead of assuming a speculative merge.
 let worst=0;for(const r of rows){if(nonInventoryRewards.has(r.item))continue;const m=G.items?.[r.item];if(!m||!Number.isSafeInteger(r.quantity)||r.quantity<1)return {known:false,reason:'unknown-output'};
  const max=m.s===true?9999:Number.isSafeInteger(m.s)&&m.s>1?m.s:1;worst=Math.max(worst,Math.ceil(r.quantity/max));}
 return {known:true,freeBefore:physicalInventoryCapacity(items,{inventorySize})?.free??0,freeAfterConsumption:next.free,worstOutputSlots:worst,worstFree:next.free-worst};
}
export function createStoragePlanner(bot){
 const {p,cfg,me}=bot,e=bot.economy;let active=false,last=null,lastReason='',noteAt=0;
 const bankStateKey='albot:storage-bank-pressure:'+me.name,storedPressure=p.read?.(bankStateKey);
 let knownBankPressure=storedPressure?.realm===(p.realm?.()??'')&&storedPressure.pressure===true;
 const deferred=new Map();
 const enabled=()=>me.role==='merchant'&&cfg.merchant.preventiveStorage===true;
 const reserve=()=>Math.min(p.c.items.length,Math.max(cfg.merchant.minFreeSlots??4,cfg.merchant.storageFreeSlots??8));
 const target=()=>Math.min(p.c.items.length,Math.max(reserve()+2,cfg.merchant.storageTargetSlots??12));
 function bankRows(){return bot.bank?.capacityEvidence?.()?.rows??[];}
 function bankPressure(){const rows=bankRows();if(rows.length){const current=rows.every(r=>r.free<=(cfg.merchant.bankWorkspace??2)+2);if(current!==knownBankPressure){knownBankPressure=current;p.write?.(bankStateKey,{pressure:current,realm:p.realm?.()??'',at:Date.now()});}}return knownBankPressure;}
 function refresh(){if(!enabled()){active=false;return;}if(bot.free()<=reserve()||bankPressure())active=true;if(bot.free()>=target()&&!bankPressure())active=false;}
 const plain=i=>!!i&&!protectedItem(i)&&!['data','acc','rid','p','title','stat_type','skin','expires','special','v'].some(k=>i[k]!==undefined&&i[k]!==null&&i[k]!=='');
 function usable(i){const m=p.G.items?.[i?.name],purposes=itemPurposes(p.G,i);return plain(i)&&m&&!m.cash&&!m.cash_item&&!m.exclusive&&!m.rare&&!m.rarity&&purposes.known&&!purposes.protected;}
 function manual(i){return e.explicit?.(i)||e.explicit?.(i,'production')||e.explicit?.(i,'acquisition');}
 const bankStock=()=>bot.bank?.catalogStock?.()??[];
 function replacement(i){
  if((i.level??0)!==0)return null;
  const m=p.G.items[i.name],npc=e.npcFor?.(i.name);
  if(npc&&Number.isFinite(m.g)&&m.g>0)return {kind:'npc',npc:npc.map,price:m.g};
  const allowed=(bot.teamPlan?.candidates?.()??[]).filter(id=>!p.G.monsters?.[id]?.boss&&bot.strategy?.safeTarget?.(id,undefined,true,true)===true);
  const sources=materialSources(p.G,i.name,1,allowed,(cfg.merchant.storageReplacementMinutes??60)/60,
   id=>bot.observations?.rate?.(id)??{value:0,source:'unknown'},
   {state:p.root?.S??p.parent?.S,confidence:'p90',questAllowed:q=>!!p.c.s?.[q]});
  const s=sources.find(s=>s.sourceKind==='monster-drop'&&s.rateSource==='observed-team');
  return s?{kind:'farm',monster:s.monster,hours:s.selectedHours,confidence:'p90-observed'}:null;
 }
 function lowQualityRule(i){
  if(!enabled()||!usable(i)||manual(i)||(i.level??0)!==0)return null;
  const m=p.G.items[i.name],purposes=itemPurposes(p.G,i);
  if(m.e||m.quest||m.event||m.soulbound)return null;
  if((m.upgrade||m.compound||m.wtype)&&bot.intelligence?.gearUse?.(i)?.state!=='no-gear-use')return null;
  const evidence=replacement(i);if(!evidence)return null;
  const required=Math.max(bot.production?.reservedQuantity?.(i)??0,...purposes.recipes.map(r=>r.quantity),0);
  // Exact variants across BOTH stores satisfy the reserve; never count an
  // equipped, protected or speculative offline item as disposable backing.
  // A cached offsite bank fingerprint is advisory, not spend/sale authority.
  // Only current physical bank observation can back a reserve before selling.
  const verifiedBank=bot.bank?.observed===true&&p.c.map?.startsWith('bank');
  const held=(p.c.items??[]).filter(x=>plain(x)&&identity(x)===identity(i)).reduce((n,x)=>n+(x.q??1),0)+
   (verifiedBank?bankStock():[]).filter(r=>plain(r.item)&&identity(r.item)===identity(i)).reduce((n,r)=>n+(r.item.q??1),0);
  const q=i.q??1,price=e.value(i);if(!Number.isSafeInteger(q)||q<1||held-q<required||!Number.isFinite(price)||price<0||price>(cfg.production.autoGearSellMaxValue??1000000))return null;
  return {...defaultsFor(ITEM_RULE),name:'Lagerplanung: ersetzbar '+i.name,item:i.name,action:'sell',batch:q,maxCount:Math.max(held,1),minPrice:price,
   _autoDisposition:true,_capacitySale:true,replacement:evidence,keep:0,teamReserve:0};
 }
 function exchangeAllowed(slot,q){
  if(!enabled())return true;refresh();const f=forecastExchange(p.G,p.c.items,slot,q,{inventorySize:p.c.isize});
  // Recovery hysteresis targets more free slots than the hard safety reserve.
  // A verified exchange must not stall at 9 -> 8 just because earlier cleanup
  // activated at 8. Preserve the strict worst-case reserve, even in recovery.
  // Under bank pressure retain ONLY the old capacity-improving exception;
  // never assume stale/unknown bank capacity is empty.
  const pressure=bankPressure();
  const allowed=f.known&&(
   (!pressure&&f.worstFree>=reserve())||
   (active&&f.worstFree>f.freeBefore)
  );
  if(!allowed){last={kind:'exchange-deferred',item:p.c.items[slot]?.name,...f,requiredFree:reserve(),bankPressure:bankPressure()};
   const key=last.item+':'+(f.reason??'working-space');if(key!==lastReason||Date.now()-noteAt>30000){lastReason=key;noteAt=Date.now();bot.event?.('storage.exchangeDeferred',last);}}
  return allowed;
 }
 function tick(){
  refresh();if(!enabled()||!active||bot.journal||bot.inventoryBlocked||bot.bank?.pending||bot.logistics?.reserved||bot.gold?.reserved||bot.exec.busy('inventory'))return false;
  if(bot.bank?.consolidateInventory?.())return true;
  // Reversible clutter parking precedes any proposed NPC sale. Never use
  // speculative cached/offsite bank room, consume protected quest sources,
  // or override an explicit item disposition.
  const physicalBank=bot.bank?.observed===true&&p.c.map?.startsWith('bank');
  const freeBank=physicalBank&&bot.bank?.capacityEvidence?.()?.rows?.some(r=>
   r.map===p.c.map&&r.free>(cfg.merchant.bankWorkspace??2));
  if(freeBank){
   const clutter=new Set(['partyhat','cake','pumpkinspice','elixirstr0',
    'elixirint0','elixirvit0','seashell']);
   for(let slot=0;slot<p.c.items.length;slot++){
    const i=p.c.items[slot],meta=p.G.items?.[i?.name];
    if(!i||!clutter.has(i.name)||!usable(i)||manual(i)||
       !meta||meta.e||bot.production?.reservedQuantity?.(i)>0)continue;
    const q=i.q??1;
    const rule={name:'Umkehrbares Clutter-Banking '+i.name,item:i.name,
     action:'bank',enabled:true,batch:q,maxCount:999999,
     keep:0,teamReserve:0,maxActions:0,goldBudget:0,lossBudget:0};
    last={kind:'clutter-bank',item:i.name,quantity:q,slot};
    if(bot.bank?.store?.(slot,rule)){
     bot.event?.('storage.clutterBankPlanned',last);return true;
    }
   }
  }
  const candidates=[],groups=new Map(),stock=bankStock();
  const key=i=>identity(i),all=[...(p.c.items??[]).flatMap((item,slot)=>item?[{item,slot}]:[]),...stock];
  for(const row of all){const i=row.item,m=p.G.items?.[i.name];if(!usable(i)||(i.q??1)!==1||!m.compound||!cfg.production.compound||(i.level??0)>=(cfg.production.autoGearMaxLevel??5))continue;
   const explicit=manual(i);if(explicit&&explicit.action!=='compound')continue;
   const r=e.rules?.(i,'production');if((bot.production?.reservedQuantity?.(i)??0)>0&&r?.action!=='compound')continue;
   if(deferred.get(key(i))>Date.now())continue;
   if(!groups.has(key(i)))groups.set(key(i),[]);groups.get(key(i)).push(row);
  }
  for(const rows of groups.values()){
   const local=rows.filter(r=>r.slot!==undefined&&!r.pack),remote=rows.filter(r=>r.pack);if(rows.length<3)continue;
   // Bank inputs are single ordinary gear items. Stage only missing inputs,
   // never more stock than one executable triple can consume.
   const missing=Math.max(0,3-local.length);
   if(missing&&bot.free()<missing)continue;
   // Prove the WHOLE bank staging path before its first withdrawal. The
   // server-side withdrawal, value journal and exact bank-row guard remain
   // with bank.retrieve. Every confirmed stage is planned anew next tick.
   const staging=missing?planPhysicalSlotSequence(p.c.items,
    remote.slice(0,missing).map((r,n)=>({
     id:'bank-withdraw-'+n,kind:'withdraw',item:r.item,
     quantity:r.item.q??1,permitted:!!r.pack
    })),p.G,{inventorySize:p.c.isize}):null;
   if(missing&&(!staging?.feasible||staging.steps.length!==missing))continue;
   if(missing){const chance=bot.intelligence?.chance?.(rows[0].item.name,rows[0].item.level??0,'compound');if(!Number.isFinite(chance)||chance<cfg.production.minChance)continue;}
   const i=rows[0].item,rule=e.rules?.(i,'production')??{...defaultsFor(ITEM_RULE),name:'Lagerplanung: Compound '+i.name,item:i.name,action:'compound',batch:3,targetCount:100,maxCount:100,targetLevel:(i.level??0)+1,minChance:cfg.production.minChance,_autoProduction:true,_capacityProduction:true};
   if(rule.action!=='compound'||rule.targetLevel<=(i.level??0))continue;
   const leave=(rule.keep??0)+(rule.teamReserve??0),recipeReserve=Math.max(0,...itemPurposes(p.G,i).recipes.map(r=>r.quantity));
   if(local.length<3+leave&&leave>0||rows.length-3<recipeReserve)continue;
   candidates.push({kind:'compound',item:i,slot:local[0]?.slot,missing,remote,rule,staging,score:local.length>=3?1000:500});
  }
  candidates.sort((a,b)=>b.score-a.score||(a.item.level??0)-(b.item.level??0));
  for(const c of candidates){
   last={kind:c.missing?'stage-compound':'compound',item:c.item.name,level:c.item.level??0,missing:c.missing,netAccountSlots:2,free:bot.free(),target:target(),stagingProof:c.staging?{physicalOnly:true,steps:c.staging.steps.map(s=>({kind:s.kind,before:s.beforeSignedFree,after:s.afterSignedFree})),confirmed:false}:null};
   const accepted=c.missing?bot.bank.retrieve(c.item,{...c.rule,action:'retrieve',batch:c.missing,maxCount:e.count(c.item)+c.missing},c.missing):bot.production.mutate(c.slot,c.rule);
   if(accepted||bot.movement.order?.owner==='economy'||bot.journal||bot.exec.busy('economy')){bot.event?.('storage.plan',last);return true;}
   deferred.set(key(c.item),Date.now()+60000);if(deferred.size>128)deferred.delete(deferred.keys().next().value);
  }
  for(let slot=0;slot<p.c.items.length;slot++){const i=p.c.items[slot],r=i&&lowQualityRule(i);if(!r)continue;
   last={kind:'sell',item:i.name,slot,netAccountSlots:1,replacement:r.replacement};
   if(e.npcSell(slot,r)||bot.movement.order?.owner==='economy'||bot.journal){bot.event?.('storage.plan',last);return true;}}
  if(bankPressure()&&p.c.map?.startsWith('bank')&&bot.bank.reclaim((cfg.merchant.bankWorkspace??2)+2))return true;
  // Explain *why* surplus stacks are held. An item without a verified,
  // authorized disposition stays in inventory; the log supports later review.
  const watch=new Set(['partyhat','cake','seashell','pumpkinspice',
   'elixirstr0','elixirint0','elixirvit0']);
  const held=(p.c.items??[]).filter(i=>i&&watch.has(i.name)).map(i=>({
   item:i.name,quantity:i.q??1,level:i.level??0,
   authorizedAction:e.explicit?.(i)?.action??e.rules?.(i,'inventory')?.action??'keep',
   productionReserve:bot.production?.reservedQuantity?.(i)??0,
   replaceableSale:!!lowQualityRule(i)}));
  last={kind:'no-actionable-capacity',free:bot.free(),reserve:reserve(),
   target:target(),bankPressure:bankPressure(),bankVerified:bot.bank?.observed===true,
   items:held};
  if(Date.now()-noteAt>=60000){noteAt=Date.now();
   bot.event?.('storage.capacityDeferred',{
    ...last,items:held.map(i=>i.item+':'+i.quantity+':'+i.authorizedAction+
     ':reserve='+i.productionReserve).join('|'),
    reason:'No verified permitted sale/bank recovery; no implicit disposal'});}
  return false;
 }
 return {tick,lowQualityRule,exchangeAllowed,refresh,receiveNewSlots:()=>enabled()?Math.max(0,bot.free()-reserve()):Infinity,get active(){refresh();return active;},status:()=>({enabled:enabled(),active,reserve:reserve(),target:target(),bankPressure:bankPressure(),last})};
}
