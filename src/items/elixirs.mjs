import {protectedItem,fingerprint,identity} from '../core/policy.mjs';
import {materialSources} from '../production/materials.mjs';
export function chooseElixir(G,ctype){const stat={ranger:'dex',rogue:'dex',warrior:'str',paladin:'str',mage:'int',priest:'int',merchant:'luck'}[ctype];if(!stat)return null;return Object.entries(G.items??{}).filter(([,m])=>m.type==='elixir'&&m[stat]>0&&m.duration>0).map(([name,m])=>({name,stat,utility:m[stat]*m.duration,score:m[stat]*m.duration/Math.max(1,m.g??1),duration:m.duration})).sort((a,b)=>b.score-a.score||b.utility-a.utility||a.name.localeCompare(b.name))[0]??null;}
// Prefer a physically advertised, class-compatible team elixir to a
// theoretically better product with no purchasable offer. Never infer that
// an advertised item is transferable: the sender still enforces explicit
// item rules, reservations and a session-bound delivery handshake.
export function chooseStockedElixir(G,ctype,stock){
 const stat={ranger:'dex',rogue:'dex',warrior:'str',paladin:'str',mage:'int',priest:'int',merchant:'luck'}[ctype];
 if(!stat||!Array.isArray(stock))return null;
 return [...new Set(stock.filter(i=>i&&typeof i.name==='string'&&
  G.items?.[i.name]?.type==='elixir'&&G.items[i.name][stat]>0&&
  G.items[i.name].duration>0).map(i=>i.name))]
  .map(name=>({name,stat,utility:G.items[name][stat]*G.items[name].duration,
   score:G.items[name][stat]*G.items[name].duration/Math.max(1,G.items[name].g??1),
   duration:G.items[name].duration}))
  .sort((a,b)=>b.utility-a.utility||b.score-a.score||a.name.localeCompare(b.name))[0]??null;
}
export function createElixirs(bot){const {p,cfg,me}=bot;let last=0,cycle=p.read('albot:elixir:'+me.name)?.cycle??0,requested=false;
 const remaining=slot=>{if(Number.isFinite(slot?.ms))return slot.ms;const value=typeof slot?.expires==='number'?slot.expires:Date.parse(slot?.expires??'');return Number.isFinite(value)?Math.max(0,value-Date.now()):Infinity;};
 const enabled=()=>cfg.general.testLogging!==undefined&&cfg.farming.elixirs!==false;
 function desired(){
 const preferred=chooseElixir(p.G,p.c.ctype);
 if(!preferred)return null;
 const active=p.c.slots?.elixir;
 // Do not replace a suitable active elixir simply because a different
 // Merchant stock item appeared on a newer heartbeat.
 if(active?.name&&p.G.items?.[active.name]?.type==='elixir'&&
  chooseStockedElixir(p.G,p.c.ctype,[active])&&remaining(active)>60000)
  return {...preferred,name:active.name};
 const inventory=(p.c.items??[]).filter(i=>i&&!protectedItem(i)&&
  bot.consumable(i));
 const merchant=bot.transport?.fresh?.(cfg.party.merchant);
 const stocked=merchant?.running&&!merchant.rip&&merchant.realm===p.realm()?
  merchant.elixirStock??merchant.stock??[]:[];
 const best=chooseStockedElixir(p.G,p.c.ctype,[...inventory,...stocked]);
 const selected=best??preferred;
 const r=bot.economy?.explicit({name:selected.name,level:0});
 return r?.action==='keep'?null:selected;
 }
 function tick(){if(!enabled()||p.c.rip||bot.journal||bot.inventoryBlocked||bot.logistics.reserved||Date.now()-last<5000)return false;last=Date.now();const want=desired();if(!want)return false;const active=p.c.slots?.elixir,ms=remaining(active);if(active?.name===want.name&&(ms===undefined||ms>60000))return false;
  const slot=p.c.items.findIndex(i=>i?.name===want.name&&!protectedItem(i)&&bot.consumable(i));if(slot<0)return false;const before=bot.count(want.name),fp=fingerprint(p.c.items[slot]);return bot.economy.perform('elixir.equip',{slots:[slot],guard:()=>fingerprint(p.c.items[slot])===fp&&bot.consumable(p.c.items[slot]),call:()=>p.call('equip',slot,'elixir'),observe:()=>p.c.slots?.elixir?.name===want.name&&bot.count(want.name)<before,details:{item:want.name,variant:identity(p.c.items[slot]),quantity:1,before,reason:'Klassengeeignetes Elixier fehlt/läuft aus'}});
 }
 function request(){if(!enabled())return null;const want=desired();if(!want)return null;if(p.c.slots?.elixir?.name===want.name&&remaining(p.c.slots.elixir)>60000||bot.count(want.name)>0){requested=false;return null;}if(!requested){cycle++;p.write('albot:elixir:'+me.name,{cycle});requested=true;}return {item:want.name,quantity:1,utility:want.utility,class:p.c.ctype,cycle};}
 function goals(){if(!enabled()||me.role!=='merchant')return [];return [...bot.farmers,me.name].flatMap(name=>{const h=name===me.name?{running:bot.running,elixir:request()}:bot.transport.fresh(name),r=h?.elixir;if(!h?.running||!r?.item||!p.G.items[r.item]||r.quantity!==1)return [];const explicit=bot.economy.explicit({name:r.item,level:0},'acquisition');if(explicit?.action==='keep')return [];return [{name:'Elixier: '+name+' / '+r.item+' / '+r.cycle,enabled:true,item:r.item,level:0,quantity:1,recipient:name===me.name?'':name,budget:cfg.production.helperMaxPrice,priority:175}];});}
 function objective(){const r=request();if(!r)return null;const types=bot.teamPlan?.candidates()??cfg.farming.targets;const source=materialSources(p.G,r.item,1,types,cfg.production.maxFarmHours,bot.observations?.rate,{state:p.root.S??p.parent.S,confidence:cfg.production.farmConfidence,questAllowed:q=>!!p.c.s?.[q]})[0];return source&&source.estimatedHours<Math.max(.25,chooseElixir(p.G,p.c.ctype)?.duration??0)?{...source,elixir:true,objective:'elixir:'+me.name+':'+r.item}:null;}
 return {tick,request,goals,objective};}
