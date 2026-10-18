import {identity} from '../core/policy.mjs';

// W10/W13: a server chest_opened event attributes the individual looter,
// even when someone else opened the party chest. It is NOT proof of an
// inventory deposit unless a pre-loot baseline and exact delta both exist.
const W13_LOOT_WINDOW=3500,W13_LOOT_MAX=64;
const w13Amount=i=>i?.q===undefined?1:i.q;
function w13Stock(items){
 if(!Array.isArray(items)||items.length>256)return null;
 const rows=new Map();
 for(const item of items){
  if(!item)continue;
  const n=w13Amount(item),key=identity(item);
  if(typeof item.name!=='string'||!item.name||key.length>512||
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
  const n=w13Amount(entry),key=identity(entry);
  if(!Number.isSafeInteger(n)||n<1||n>1000000||
     key.length>512)return null;
  items.set(key,(items.get(key)??0)+n);
  if(!Number.isSafeInteger(items.get(key))||items.size>32)return null;
 }
 if(!Number.isSafeInteger(row.gold)||row.gold<0||
    !Number.isSafeInteger(row.gold))return null;
 return {items,gold:row.gold,opener:row.opener===name?'self':'party',
  id:row.id};
}
export function createOwnLootReceipts(bot,{now=()=>Date.now()}={}){
 const {p,me}=bot;
 let baselines=new Map(),pending=[],recent=[],realm=p.realm(),session=bot.session;
 function resetIfChanged(){
  if(realm!==p.realm()||session!==bot.session){
   realm=p.realm();session=bot.session;baselines.clear();pending=[];
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
  if(!bot.running||typeof row?.id!=='string')return false;
  const share=ownChestShare(row,me.name,p.G);
  if(!share)return false;
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
   if(!w13SameDelta(row.basis.stock,stock,row.wanted)||
      gold!==row.basis.gold+row.gold)continue;
   const result={id:row.id,at:now(),source:row.source,
    opener:row.opener,state:'own-physical-receipt-confirmed',
    itemTypes:row.itemTypes,gold:row.gold,physical:true};
   recent.push(result);recent=recent.slice(-W13_LOOT_MAX);
   pending=pending.filter(x=>x!==row);
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
   recent:recent.slice(-8).map(x=>({...x}))};
 }
 return {beforeLoot,observeChest,sample,status,
  heartbeat:()=>status().recent.filter(x=>x.physical).slice(-2)
   .map(x=>({id:x.id,at:x.at,gold:x.gold,itemTypes:x.itemTypes})),
  close(){baselines.clear();pending=[];recent=[];}};
}
