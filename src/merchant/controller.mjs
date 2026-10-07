import {identity,distance} from '../core/policy.mjs';
export function createMerchant(bot){
 const {p,cfg,me,exec}=bot,e=bot.economy;let cursor=0;
 function buff(){
  if(me.role!=='merchant'||!cfg.merchant.mluck||!p.G.skills?.mluck)return;
  const skill=p.G.skills.mluck;if(p.c.level<(skill.level??0)||p.c.mp<(skill.mp??0)||p.call('is_on_cooldown','mluck'))return;
  const candidates=cfg.merchant.mluckOthers?Object.values(p.entities).filter(x=>x.type==='character'):bot.allies();
  for(const c of candidates){if(c.rip||distance(p.c,c)>(skill.range??320)||c.s?.mluck?.strong&&c.s.mluck.f!==me.name||c.s?.mluck?.ms>60000)continue;
   exec.run('mluck',['skill','mana'],()=>bot.running&&p.c.mp>=(skill.mp??0),()=>p.call('use_skill','mluck',c.id??c.name),{delay:2000});break;
  }
 }
 function tick(){
  if(!bot.running||p.c.rip||bot.inventoryBlocked||bot.journal||bot.logistics.reserved||exec.busy('inventory'))return;
  if(me.role==='merchant'&&!cfg.merchant.enabled)return;if(me.role==='merchant')bot.production.planGoals();
  buff();if(bot.movement.order?.owner==='logistics'){bot.services?.restore();return;}
  if(me.role==='merchant'&&cfg.merchant.stand&&!p.c.stand&&!p.c.moving&&!bot.movement.order&&p.c.items.some(i=>i&&p.G.items[i.name]?.stand)){
   if(exec.run('stand',['stand'],()=>bot.running&&!p.c.moving,()=>p.call('open_stand'),{delay:5000}))return;
  }
  const items=p.c.items;
  for(let n=0;n<items.length;n++){
   const slot=(cursor+n)%items.length,i=items[slot];if(!e.safe(i))continue;
   const inventoryRule=e.rules(i),productionRule=e.rules(i,'production');
   const r=e.remaining(inventoryRule)?inventoryRule:null,production=e.remaining(productionRule)?productionRule:null;let done=false;
   if(r?.action==='sell')done=e.npcSell(slot,r);
   else if(r?.action==='bank'&&me.role==='merchant')done=bot.bank.store(slot,r);
   else if(r?.action==='list'&&me.role==='merchant')done=bot.market.listing(slot,r);
   else if(r?.action==='equip')done=bot.gear.equip(slot,r);
   if(!done&&me.role==='merchant'&&production?.action==='exchange')done=bot.production.exchange(slot,production);
   if(!done&&me.role==='merchant'&&['upgrade','compound'].includes(production?.action))done=bot.production.mutate(slot,production);
   if(done){cursor=(slot+1)%items.length;return;}if(bot.movement.order?.owner==='economy'){cursor=slot;return;}
  }
  if(me.role!=='merchant')return;
  for(const r of cfg.items.filter(r=>r.enabled&&e.remaining(r))){
   const item={name:r.item,level:r.minLevel,stat_type:r.statType,p:r.property,title:r.title};
   if(e.rules(item,'acquisition')!==r)continue;const n=e.count(item),need=Math.min(r.targetCount,r.maxCount)-n;
   if(need<=0||(r.requestBelow>0&&n>r.requestBelow))continue;
   let done=false;
   if(r.action==='buy')done=e.npcBuy(item,r,need);
   if(r.action==='retrieve')done=bot.bank.retrieve(item,r,need);
   if(r.action==='marketBuy')done=bot.market.buy(item,r);
   if(r.action==='wishlist')done=bot.market.wishlist(item,r);
   if(done||bot.movement.order?.owner==='economy')return;
  }
  for(const r of cfg.items.filter(r=>r.enabled&&r.action==='craft'&&e.remaining(r))){const item={name:r.item,level:0};if(e.rules(item,'production')===r&&e.count(item)<r.targetCount&&bot.production.craft(r.item,r))return;}
  if(bot.production.tick()||bot.bank.gold()||bot.bank.consolidate()||bot.market.background()||bot.services?.tick())return;
  const pos=cfg.merchant.position;if(pos.enabled&&!e.travel({...pos,in:pos.map},'Standplatz',20))return;
  if(cfg.merchant.stand&&!p.c.stand&&p.c.items.some(i=>i?.name==='stand0'||i?.name==='stand1'))exec.run('stand',['stand'],()=>bot.running&&!p.c.moving,()=>p.call('open_stand'),{delay:5000});
 }
 return {tick};
}
