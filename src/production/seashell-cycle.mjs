import {chooseStockedElixir} from '../items/elixirs.mjs';
import {materialSources,exchangeSource} from './materials.mjs';
import {knowledgeFingerprint} from '../world/knowledge.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
import {defaultsFor} from '../../editor/lib/contract.mjs';

// All shell totals are PHYSICAL: current inventory + recently verified bank.
// Missing bank evidence is unknown, not evidence that the stock is zero.
export const SEASHELL_REFILL_TARGET=400;
export function seashellCycleDecision({missingClassElixirs=0,inventory=0,
 bank=0,bankKnown=true,exchangeBatch=0,collecting=false,target=SEASHELL_REFILL_TARGET}={}){
 const total=inventory+bank;
 if(!Number.isSafeInteger(inventory)||inventory<0||
    !Number.isSafeInteger(bank)||bank<0||
    !Number.isSafeInteger(exchangeBatch)||exchangeBatch<1||
    !Number.isSafeInteger(target)||target<exchangeBatch||!bankKnown)
  return {mode:'unknown',collecting,remaining:0,total};
 if(collecting&&(!missingClassElixirs||total>=target))collecting=false;
 if(!collecting&&missingClassElixirs>0&&total<exchangeBatch)collecting=true;
 return {mode:collecting?'collect':total>=exchangeBatch?'exchange':'idle',
  collecting,remaining:collecting?target-total:0,total};
}
export function eligibleSeashellClassNeeds(G,farmers,stock){
 return farmers.filter(h=>h?.running&&!h.rip&&typeof h.class==='string'&&
   h.elixir?.item&&G.items?.[h.elixir.item]?.type==='elixir'&&
   !chooseStockedElixir(G,h.class,stock)).map(h=>({
     farmer:h.name,requested:h.elixir.item,ctype:h.class
   }));
}
export function createSeashellCycle(bot){
 const {p,cfg,me}=bot,key='albot:seashell-refill:'+me.name;
 const saved=p.read?.(key);
 let collecting=saved?.collecting===true,serial=Number.isSafeInteger(saved?.serial)?
  Math.max(0,saved.serial):0,lastNotice='',lastSource=null,sourceUntil=0;
 const enabled=()=>me.role==='merchant'&&cfg.merchant?.enabled!==false&&
  cfg.production?.enabled&&cfg.production?.autonomy&&cfg.production?.exchange&&
  cfg.farming?.elixirs!==false&&p.G.items?.seashell?.e>0;
 const safeShell=item=>item?.name==='seashell'&&!item.l&&!item.b&&
   bot.economy?.safe?.(item)&&
   (!bot.economy.explicit(item,'inventory')||
     bot.economy.explicit(item,'inventory').action==='exchange')&&
   (!bot.economy.explicit(item,'production')||
     bot.economy.explicit(item,'production').action==='exchange');
 function inventoryQty(){return (p.c.items??[]).reduce((n,i)=>
   n+(safeShell(i)?i.q??1:0),0);}
 function bankRows(){return cfg.merchant?.bank===false?[]:
   bot.bank?.catalogStock?.().filter(r=>safeShell(r.item))??[];}
 function stockEvidence(){
  return [...(p.c.items??[]).filter(i=>i&&!i.l&&!i.b),
   ...(cfg.merchant?.bank===false?[]:bot.bank?.catalogStock?.().map(r=>r.item)??[])];
 }
 function missing(){
  return eligibleSeashellClassNeeds(p.G,
   (bot.farmers??[]).map(n=>bot.transport?.fresh?.(n)).filter(h=>
     h?.realm===p.realm()),stockEvidence());
 }
 function persist(next){
  if(collecting===next)return true;
  const value={collecting:next,serial:serial+(next?1:0),at:Date.now()};
  if(typeof p.write==='function'&&p.write(key,value)===false)return false;
  if(next)serial++;
  collecting=next;
  bot.event?.('seashell.cycle',{collecting,serial,goal:SEASHELL_REFILL_TARGET});
  return true;
 }
 function decision(){
  if(!enabled())return {mode:'disabled',collecting:false,remaining:0,total:0};
  const known=cfg.merchant?.bank===false||bot.bank?.observed===true;
  const qty=inventoryQty(),stored=known?bankRows().reduce((n,r)=>n+(r.item.q??1),0):0;
  const need=missing();
  const result=seashellCycleDecision({missingClassElixirs:need.length,
   inventory:qty,bank:stored,bankKnown:known,
   exchangeBatch:p.G.items.seashell.e,collecting});
  if(result.mode!=='unknown'&&result.collecting!==collecting){
   if(!persist(result.collecting))return {...result,mode:'unknown'};
  }
  return {...result,missing:need,bankKnown:known,inventory:qty,bank:stored};
 }
 function note(type,details){
  const fingerprint=JSON.stringify([type,details]);
  if(fingerprint===lastNotice)return;lastNotice=fingerprint;
  bot.event?.(type,details);
 }
 function request(){
  const status=decision();
  if(status.mode!=='collect')return null;
  const candidate=bot.teamPlan?.candidates?.()??(
    cfg.farming.autoTargets?Object.keys(p.G.monsters??{}):
    cfg.farming.targets??[]);
  const permitted=candidate.filter(name=>p.G.monsters?.[name]&&
   bot.strategy?.safeTarget?.(name,undefined,true,true)===true);
  if(!permitted.length)return null;
  const now=Date.now();
  if(!lastSource||now>sourceUntil||!permitted.includes(lastSource.monster)){
   lastSource=materialSources(p.G,'seashell',status.remaining,permitted,
     Infinity,bot.observations?.rate,{
      state:p.root?.S??p.parent?.S??{},
      confidence:cfg.production.farmConfidence,
      questAllowed:q=>!!p.c.s?.[q]})[0]??null;
   sourceUntil=now+30000;
  }
  if(!lastSource){
   note('seashell.farmUnavailable',{reason:'NO_APPROVED_DROP_SOURCE',
     remaining:status.remaining});return null;
  }
  const objective='seashell-refill:'+me.name+':'+serial;
  return {...lastSource,item:'seashell',quantity:status.remaining,
   objective,priority:300,sourceKind:lastSource.sourceKind,
   expires:now+2*(cfg.general.messageTtlMs??10000),
   sourceFingerprint:knowledgeFingerprint([
     p.G.monsters[lastSource.monster],
     p.G.drops?.monsters?.[lastSource.monster]])};
 }
 function exchangeRule(){
  return {...defaultsFor(ITEM_RULE),enabled:true,
   name:'Autonomer Seashell-Kompletttausch',item:'seashell',
   role:'merchant',character:me.name,action:'exchange',
   minLevel:0,maxLevel:0,priority:300,batch:999999,
   keep:0,teamReserve:0,maxActions:0,
   targetCount:999999,maxCount:999999,
   goldBudget:0,lossBudget:cfg.production.lossBudget,
   _autoProduction:true};
 }
 function tick(){
  if(!enabled()||!bot.running||p.c.rip||bot.journal||
    bot.inventoryBlocked||bot.bank?.pending||bot.logistics?.reserved||
    bot.exec?.busy?.('inventory')||bot.movement?.order)return false;
  const status=decision(),batch=p.G.items.seashell.e;
  if(status.mode==='unknown'||status.mode==='collect')return false;
  if(status.mode==='idle')return false;
  const verified=exchangeSource(p.G,'seashell',p.root?.S??p.parent?.S??{});
  if(!verified.ready){note('seashell.exchangeUnavailable',{reason:verified.reason});return false;}
  const rule=exchangeRule(),slot=(p.c.items??[]).findIndex(i=>
   safeShell(i)&&(i.q??1)>=batch);
  if(slot>=0&&bot.free()>=1){
   const started=bot.production?.exchange?.(slot,rule)??false;
   if(started||bot.movement?.order?.owner==='economy'||bot.journal)return true;
  }
  // Retrieve only verified, unprotected shell stacks; bank.retrieve retains
  // its own exact-slot journal and travels to the owning pack first.
  if(cfg.merchant?.bank!==false&&status.bank>0&&bot.free()>0){
   const pulled=bot.bank?.retrieve?.({name:'seashell',level:0},rule,status.bank);
   if(pulled||bot.movement?.order?.owner==='economy'||bot.journal)return true;
  }
  return false;
 }
 return {decision,request,tick,get collecting(){return collecting;}};
}
