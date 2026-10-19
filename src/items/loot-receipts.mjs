import {identity,protectedItem,verifiedExactGoalIdentity} from '../core/policy.mjs';

// W10/W13: a server chest_opened event attributes the individual looter,
// even when someone else opened the party chest. It is NOT proof of an
// inventory deposit unless a pre-loot baseline and exact delta both exist.
const W13_LOOT_WINDOW=3500,W13_LOOT_MAX=64;
const w13Amount=i=>i?.q===undefined?1:i.q;
// Server loot events and account objectives can contain opaque or malformed
// variant data. Never let JSON cycles abort the loot/status heartbeat path.
function w13Identity(item){
 try{
  const key=identity(item);
  return typeof key==='string'&&key.length<=512?key:null;
 }catch{return null;}
}
// Exact recipient suggestions must never reinterpret a malformed variant
// as a generic target or permit name/level substitution.
function w13GearTargetMatches(g,item,variant){
 if(typeof g?.recipient!=='string'||!g.recipient||
    g.item!==item.name||g.level!==(item.level??0))return false;
 if(g.variant===null||g.variant===undefined)return true;
 return verifiedExactGoalIdentity(g)===variant;
}
function w13Stock(items){
 if(!Array.isArray(items)||items.length>256)return null;
 const rows=new Map();
 for(const item of items){
  if(!item)continue;
  const n=w13Amount(item),key=w13Identity(item);
  if(typeof item.name!=='string'||!item.name||!key||
     !Number.isSafeInteger(n)||n<1||n>1000000)return null;
  rows.set(key,(rows.get(key)??0)+n);
  if(!Number.isSafeInteger(rows.get(key))||rows.size>128)return null;
 }
 return rows;
}
function w13SameDelta(before,after,wanted){
 if(!before||!after)return false;
 const keys=new Set([...before.keys(),...after.keys(),...wanted.keys()]);
 for(const key of keys)
  if((after.get(key)??0)-(before.get(key)??0)!==(wanted.get(key)??0))
   return false;
 return true;
}
export function ownChestShare(row,name,G){
 if(!row||row.gone===true||typeof row.id!=='string'||!row.id||
    row.id.length>160||!Array.isArray(row.items)&&row.items!==undefined||
    row.items?.length>64||!G?.items)return null;
 const items=new Map();
 for(const entry of row.items??[]){
  if(!entry||typeof entry.name!=='string'||!G.items[entry.name])return null;
  // Lost-and-found drops have no recipient; they are not own loot.
  if(entry.lostandfound===true&&entry.looter===null)continue;
  if(typeof entry.looter!=='string'||!entry.looter||
     entry.lostandfound===true)return null;
  if(entry.looter!==name)continue;
  const n=w13Amount(entry),key=w13Identity(entry);
  if(!Number.isSafeInteger(n)||n<1||n>1000000||!key)return null;
  items.set(key,(items.get(key)??0)+n);
  if(!Number.isSafeInteger(items.get(key))||items.size>32)return null;
 }
 if(!Number.isSafeInteger(row.gold)||row.gold<0||
    row.gold>Number.MAX_SAFE_INTEGER||
    !items.size&&row.gold===0)return null;
 return {items,gold:row.gold,opener:row.opener===name?'self':'party',
  id:row.id};
}
// Read-only joins of fully confirmed receipts and CURRENT physical stock.
// A matching gear target is a suggestion, not permission to allocate/send.
export function lootPurposeEvidence({proofs=[],inventory=[],reserve=()=>null,
 gearGoals=[],activeGoal=null,now=Date.now()}={}){
 if(!Array.isArray(proofs)||!Array.isArray(inventory)||
    !Array.isArray(gearGoals)||inventory.length>256||
    proofs.length>16||gearGoals.length>128)return [];
 const grouped=new Map();
 for(const proof of proofs){
  if(!proof?.physical||!Number.isSafeInteger(proof.at)||
     proof.at>now||now-proof.at>21600000||!Array.isArray(proof.items)||
     proof.items.length>32)continue;
  for(const x of proof.items){
   if(typeof x?.variant!=='string'||x.variant.length>512||
      !Number.isSafeInteger(x.quantity)||x.quantity<1||
      x.quantity>1000000)continue;
   const entry=grouped.get(x.variant)??{variant:x.variant,receiptUnits:0,
    chestIds:[]};
   if(!entry.chestIds.includes(proof.id)){
    entry.receiptUnits+=x.quantity;
    if(!Number.isSafeInteger(entry.receiptUnits))continue;
    entry.chestIds.push(proof.id);
   }
   grouped.set(x.variant,entry);
  }
 }
 const out=[];
 for(const entry of grouped.values()){
  let held=0,protectedUnits=0,item=null,complete=true;
  for(const x of inventory){
   if(!x)continue;
   const stockVariant=w13Identity(x);
   // An opaque invalid physical item makes this snapshot inadequate to
   // establish an uncommitted copy for ANY purpose.
   if(!stockVariant)return [];
   if(stockVariant!==entry.variant)continue;
   const count=x.q??1;
   if(!Number.isSafeInteger(count)||count<1||count>1000000){
    complete=false;break;
   }
   held+=count;if(protectedItem(x))protectedUnits+=count;
   if(!Number.isSafeInteger(held)){complete=false;break;}
   item=x;
  }
  if(!complete||!item)continue;
  const short={name:item.name,level:item.level??0,
   statType:item.stat_type??'',property:item.p??'',title:item.title??''};
  // Never turn inferred recipient matches or demand into send authority.
  const recipients=[...new Set(gearGoals.filter(g=>
   w13GearTargetMatches(g,item,entry.variant)).map(g=>g.recipient))].slice(0,4);
  const productionMatch=!!activeGoal&&activeGoal.item===item.name&&
   activeGoal.level===(item.level??0);
  let reserved;
  try{reserved=reserve(item);}catch{reserved=null;}
  const proven=Number.isSafeInteger(reserved)&&reserved>=0;
  out.push({...short,variantIdentity:entry.variant,observedUnits:Math.min(entry.receiptUnits,held),
   currentUnits:held,protectedUnits,
   grossReservedUnits:proven?reserved:null,
   uncommittedEstimate:proven?
    Math.max(0,held-protectedUnits-reserved):null,
   candidateRecipients:recipients,
   matchesCurrentProductionGoal:productionMatch,
   evidence:'own-physical-receipt-confirmed',dispatchAuthorized:false,
   state:proven?'read-only-demand-match':'reservation-unverified'});
  if(out.length>=16)break;
 }
 return out;
}
export function createOwnLootReceipts(bot,{now=()=>Date.now()}={}){
 const {p,me}=bot;
 let baselines=new Map(),pending=[],recent=[],confirmed=[],seen=new Map(),realm=p.realm(),session=bot.session;
 function resetIfChanged(){
  if(realm!==p.realm()||session!==bot.session){
   realm=p.realm();session=bot.session;baselines.clear();pending=[];confirmed=[];seen.clear();
  }
  const at=now();
  for(const [id,proof] of baselines)
   if(at-proof.at>W13_LOOT_WINDOW)baselines.delete(id);
  const expired=pending.filter(x=>at-x.at>W13_LOOT_WINDOW);
  if(expired.length){
   for(const x of expired)recent.push({id:x.id,at:x.at,
    source:x.source,opener:x.opener,state:'server-attributed-unverified',
    itemTypes:x.itemTypes,gold:x.gold,physical:false});
   recent=recent.slice(-W13_LOOT_MAX);
  }
  pending=pending.filter(x=>at-x.at<=W13_LOOT_WINDOW);
  recent=recent.filter(x=>at-x.at<=21600000);
  confirmed=confirmed.filter(x=>at-x.at<=21600000);
  for(const [id,time] of seen)if(at-time>21600000)seen.delete(id);
 }
 function baseline(id){
  if(typeof id!=='string'||!id||id.length>160||!bot.running||
     bot.journal||bot.inventoryBlocked||bot.logistics?.reserved||
     bot.bank?.pending||!Number.isSafeInteger(p.c?.gold))return;
  const stock=w13Stock(p.c.items);
  if(stock)baselines.set(id,{at:now(),stock,gold:p.c.gold,
   owner:me.name,realm,session});
  if(baselines.size>16)baselines.delete(baselines.keys().next().value);
 }
 function beforeLoot(arg){
  resetIfChanged();
  // Normal loot() can open up to two currently visible chests. Explicit
  // loot(id) is unambiguous; remote-command loot(true) is not our receipt.
  if(arg===true)return;
  if(typeof arg==='string'){baseline(arg);return;}
  const chests=p.parent?.chests??{};
  if(!chests||typeof chests!=='object')return;
  let seen=0;
  for(const [id,row] of Object.entries(chests)){
   if(seen++>=128)break;
   if(!row||row.map&&row.map!==p.c.map||
      row.in&&row.in!==(p.c.in??p.c.map))continue;
   baseline(id);
  }
 }
 function observeChest(row){
  resetIfChanged();
  if(!bot.running||typeof row?.id!=='string'||seen.has(row.id))return false;
  const share=ownChestShare(row,me.name,p.G);
  if(!share)return false;
  seen.set(share.id,now());if(seen.size>128)seen.delete(seen.keys().next().value);
  const prior=baselines.get(share.id);
  baselines.delete(share.id);
  const basis=prior&&prior.owner===me.name&&prior.realm===realm&&
   prior.session===session&&now()-prior.at<=W13_LOOT_WINDOW?prior:null;
  const status={id:share.id,at:now(),source:'official-chest_opened',
   opener:share.opener,state:'server-attributed-unverified',
   itemTypes:share.items.size,gold:share.gold,physical:false};
  if(!basis){
   recent.push(status);recent=recent.slice(-W13_LOOT_MAX);return true;
  }
  pending.push({...status,basis,wanted:share.items});
  if(pending.length>16)pending.shift();
  return true;
 }
 function sample(){
  resetIfChanged();
  if(!pending.length)return;
  const stock=w13Stock(p.c?.items??[]),gold=p.c?.gold;
  if(!stock||!Number.isSafeInteger(gold)||bot.journal||
     bot.inventoryBlocked||bot.bank?.pending||bot.logistics?.reserved)
   return;
  for(const row of [...pending]){
   if(!pending.includes(row))continue; // invalidated by a preceding proof
   if(!w13SameDelta(row.basis.stock,stock,row.wanted)||
      gold!==row.basis.gold+row.gold)continue;
   const result={id:row.id,at:now(),source:row.source,
    opener:row.opener,state:'own-physical-receipt-confirmed',
    itemTypes:row.itemTypes,gold:row.gold,physical:true};
   recent.push(result);recent=recent.slice(-W13_LOOT_MAX);
   confirmed.push({...result,items:[...row.wanted].map(([variant,quantity])=>({variant,quantity}))});
   confirmed=confirmed.slice(-16);
   // Two chest callbacks captured against the SAME physical starting
   // inventory can both match one resulting delta. Consume that baseline
   // exactly once; leave other chest assignments unverified, not credited.
   const sameBaseline=x=>x.basis.gold===row.basis.gold&&
    x.basis.stock.size===row.basis.stock.size&&
    [...x.basis.stock].every(([k,n])=>x.basis.stock.get(k)===n&&
     row.basis.stock.get(k)===n);
   for(const other of pending){
    if(other===row||!sameBaseline(other))continue;
    recent.push({id:other.id,at:other.at,source:other.source,
     opener:other.opener,state:'server-attributed-unverified',
     itemTypes:other.itemTypes,gold:other.gold,physical:false});
   }
   recent=recent.slice(-W13_LOOT_MAX);
   pending=pending.filter(x=>!sameBaseline(x));
   bot.event?.('loot.ownReceipt',result);
  }
 }
 function status(){
  resetIfChanged();
  return {version:1,mode:'passive-own-chest-attribution',
   authority:'read-only',dispatchAuthorized:false,realm,session,
   pending:pending.length,
   physicalConfirmed:recent.filter(x=>x.physical).length,
   serverOnly:recent.filter(x=>!x.physical).length,
   recent:recent.slice(-8).map(x=>({...x})),
   purposeHints:lootPurposeEvidence({proofs:confirmed,inventory:p.c.items,
    reserve:item=>bot.production?.reservedQuantity?.(item)??null,
    gearGoals:bot.gear?.goals?.()??[],activeGoal:bot.production?.activeGoal??null,
    now:now()})};
 }
 return {beforeLoot,observeChest,sample,status,
  heartbeat:()=>status().recent.filter(x=>x.physical).slice(-2)
   .map(x=>({id:x.id,at:x.at,gold:x.gold,itemTypes:x.itemTypes})),
  close(){baselines.clear();pending=[];recent=[];confirmed=[];seen.clear();}};
}
