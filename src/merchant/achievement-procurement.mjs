import {carriedAchievementCarrier,trackerDeliveryNeed,
 trackerMerchantKeep} from '../items/achievement-utility.mjs';
import {protectedItem,fingerprint} from '../core/policy.mjs';

const COST=4,MAX_CATALOG_AGE_MS=600000;

// Conservative planning only. Every actual bank withdrawal/exchange is
// reverified by the existing durable value-action journal and live game data.
// Daisy's NPC and G.tokens.monstertoken.tracker are server-authoritative.
export function tracktrixProvisionPlan({
 items,G,farmers,fresh,realm,merchantName,bankEnabled=false,
 bankStatus=null,bankRows=[],now=Date.now(),freeReserve=4,
 farmerReserve=4,explicit=false}={}){
 const result=(state,extra={})=>({state,recipient:null,costTokens:COST,...extra});
 if(!Array.isArray(items)||!Array.isArray(farmers)||typeof fresh!=='function')
  return result('inventory-unknown');
 if(explicit)return result('explicit-rule');
 const recipients=farmers.filter(name=>{
  if(typeof name!=='string'||!name||name===merchantName)return false;
  const h=fresh(name);
  return h?.name===name&&trackerDeliveryNeed(h,realm,{reserve:farmerReserve})===1;
 });
 if(!recipients.length)return result('no-confirmed-recipient');
 const recipient=recipients[0],tracked=items.reduce((n,i)=>
  n+(i?.name==='tracker'&&!protectedItem(i)?1:0),0);
 const keep=trackerMerchantKeep(items);
 if(tracked>keep)return result('deliver-existing',{recipient});
 if(bankEnabled){
  const at=bankStatus?.observedAt;
  if(!Number.isSafeInteger(at)||at<=0||at>now||
     now-at>MAX_CATALOG_AGE_MS)return result('inspect-bank',{recipient});
  const saved=(Array.isArray(bankRows)?bankRows:[]).find(x=>
   x?.item?.name==='tracker'&&!protectedItem(x.item)&&
   typeof x.pack==='string');
  if(saved)return result('retrieve-bank',{recipient,bankRow:saved});
 }
 if(G?.tokens?.monstertoken?.tracker!==COST||
    G.items?.monstertoken?.type!=='token'||
    G.items?.monstertoken?.npc!=='monsterhunter'||
    G.npcs?.monsterhunter?.role!=='monstertokens'||
    !G.items?.tracker)return result('game-source-unverified',{recipient});
 const tokenSlot=items.findIndex(i=>i?.name==='monstertoken');
 const item=items[tokenSlot];
 if(tokenSlot<0)return result('need-tokens',{recipient});
 if(protectedItem(item)||!Number.isSafeInteger(item.q)||item.q<COST)
  return result('first-token-stack-not-spendable',{recipient});
 const free=items.filter(i=>!i).length;
 // Although the game can replace a consumed four-token stack in-place,
 // never use scarce Merchant workspace to speculate on optional utilities.
 if(free<=freeReserve)return result('inventory-pressure',{recipient});
 return result('exchange',{recipient,tokenSlot,tokenQuantity:item.q,
  trackerBefore:tracked});
}

export function createTracktrixProvision(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const plan=()=>{
  const bankEnabled=cfg.merchant.bank===true;
  const bankStatus=bankEnabled?bot.bank?.catalogStatus?.():null;
  return tracktrixProvisionPlan({
   items:p.c?.items,G:p.G,farmers:bot.farmers,
   fresh:n=>bot.transport?.fresh?.(n),realm:p.realm(),
   merchantName:me.name,bankEnabled,bankStatus,
   bankRows:bankEnabled?bot.bank?.catalogStock?.(600000)??[]:[],
   freeReserve:Math.max(0,cfg.merchant.minFreeSlots??4),
   farmerReserve:Math.max(0,cfg.farming.freeSlots??4),
   explicit:(cfg.items??[]).some(r=>r?.enabled&&
     ['tracker','monstertoken'].includes(r.item))
  });
 };
 let lastAction='';
 function tick(){
  if(me.role!=='merchant'||!bot.running||p.c.rip||bot.journal||
     bot.inventoryBlocked||bot.logistics?.reserved)return false;
  const d=plan();lastAction=d.state;
  if(d.state==='inspect-bank')return bot.bank?.inspect?.()??false;
  if(d.state==='retrieve-bank'){
   const row=d.bankRow;
   if(!row||bot.free()<=cfg.merchant.minFreeSlots)return false;
   const item={name:'tracker',level:row.item.level??0};
   const quantity=(p.c.items??[]).filter(i=>i?.name==='tracker').length;
   return bot.bank?.retrieve?.(item,{
    enabled:true,name:'Tracktrix aus eigener Bank',item:'tracker',
    action:'retrieve',pack:row.pack,batch:1,maxCount:quantity+1,
    maxActions:0,goldBudget:0,lossBudget:0
   },1)??false;
  }
  if(d.state!=='exchange')return false;
  const dest=e.destination?.('monsterhunter');
  if(!dest||!Number.isFinite(dest.x)||!Number.isFinite(dest.y)||
      dest.map!=='main')return false;
  if(!e.npcTravel(dest,'Tracktrix gegen Monster Tokens'))
   return bot.movement?.order?.owner==='economy';
  const source=p.c.items[d.tokenSlot],fp=fingerprint(source);
  const tokenValue=p.G.items.monstertoken.g;
  if(!Number.isSafeInteger(tokenValue)||tokenValue<0||
     tokenValue>100000000)return false;
  const proof=()=>{
   const next=plan(),live=p.c.items[d.tokenSlot];
   return next.state==='exchange'&&next.recipient===d.recipient&&
    next.tokenSlot===d.tokenSlot&&next.tokenQuantity===d.tokenQuantity&&
    fingerprint(live)===fp&&e.npcAt(dest)&&
    bot.free()>cfg.merchant.minFreeSlots;
  };
  return e.perform('achievement.tracktrix-exchange',{
   slots:[d.tokenSlot],loss:COST*tokenValue,
   guard:proof,
   call:()=>p.call('exchange_buy','monstertoken','tracker'),
   observe:()=>{
    const live=p.c.items[d.tokenSlot],remaining=d.tokenQuantity-COST;
    return (p.c.items??[]).filter(i=>i?.name==='tracker').length===
      d.trackerBefore+1&&
      (remaining===0?live?.name!=='monstertoken':
       live?.name==='monstertoken'&&live.q===remaining);
   },
   details:{item:'monstertoken',output:'tracker',quantity:COST,
    recipient:d.recipient,sourceSlot:d.tokenSlot,
    sourceFingerprint:fp,tokenQuantityBefore:d.tokenQuantity,
    trackerBefore:d.trackerBefore}
  });
 }
 return {tick,status:()=>{const d=plan();return {state:d.state,
  recipient:d.recipient,costTokens:d.costTokens,lastAction};}};
}
