import {identity,distance,xy} from '../core/policy.mjs';
export function insidePolygon(point,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>point.y)!==(by>point.y)&&point.x<(bx-ax)*(point.y-ay)/(by-ay)+ax)inside=!inside;}return inside;}
export function createServices(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let previousHand=null,gathering=null,merritAt=0,merritBaseline=0;
 function cast(skill,target){const s=p.G.skills?.[skill];if(!s||p.c.level<(s.level??0)||p.c.mp<(s.mp??0)||p.call('is_on_cooldown',skill))return false;return exec.run('service:'+skill,['skill','mana'],()=>bot.running&&!p.c.rip,()=>p.call('use_skill',skill,...(target?[target]:[])),{delay:10000});}
 function restore(){
  if(!previousHand)return false;if(identity(p.c.slots.mainhand)===previousHand){previousHand=null;gathering=null;return false;}
  const slot=p.c.items.findIndex(i=>identity(i)===previousHand);if(slot<0){e.note('Vorherige Waffe für Werkzeugwechsel fehlt');return true;}
  const expected=previousHand;return e.perform('gather.restore',{slots:[slot],call:()=>p.call('equip',slot,'mainhand'),observe:()=>identity(p.c.slots.mainhand)===expected,details:{item:p.c.items[slot].name}});
 }
 function gather(kind){
  const tool=kind==='fishing'?'rod':'pickaxe';if(p.c.q?.[kind])return true;
  if(bot.monsters().some(m=>m.target===p.c.name))return restore();
  const regions=[];for(const [map,data] of Object.entries(p.G.maps??{}))if(data.safe&&!data.pvp&&!data.instance)for(const z of data.zones??[]){if(z.type!==kind||!Array.isArray(z.polygon)||z.polygon.length<3)continue;const polygon=z.polygon;const xs=polygon.map(x=>x[0]),ys=polygon.map(x=>x[1]);let point=null;
   for(let x=1;x<6&&!point;x++)for(let y=1;y<6&&!point;y++){const test={x:Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*x/6,y:Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*y/6};if(insidePolygon(test,polygon))point=test;}
   if(point)regions.push({map,in:map,...point,polygon});
  }
  const zone=regions.find(z=>z.map===p.c.map&&insidePolygon(xy(p.c),z.polygon))??regions[0];if(!zone){e.note('Keine sichere '+kind+'-Zone bekannt');return false;}
  if(!e.travel(zone,kind,5))return true;
  if(p.c.slots.mainhand?.name!==tool){const slot=p.c.items.findIndex(i=>i?.name===tool&&e.safe(i));if(slot<0){const r=e.rules({name:tool,level:0},'acquisition');if(r?.action==='buy')return e.npcBuy({name:tool,level:0},{...r,goldBudget:Math.min(r.goldBudget,cfg.merchant.toolBudget)},1);e.note('Werkzeug fehlt: '+tool);return false;}
   if(p.c.slots.mainhand?.l||p.c.slots.mainhand?.b)return false;previousHand=identity(p.c.slots.mainhand)||null;gathering=kind;
   return e.perform('gather.equip',{slots:[slot],guard:()=>bot.free()>cfg.merchant.minFreeSlots,call:()=>p.call('equip',slot,'mainhand'),observe:()=>p.c.slots.mainhand?.name===tool,details:{item:tool}});
  }
  return cast(kind);
 }
 function tick(){
  if(cfg.merchant.massBuffs&&cfg.production.enabled){const key=cfg.production.exchange?'massproduction':'massproductionpp';if(!p.c.s?.[key]&&cast(key))return true;}
  if(cfg.merchant.merrit){
   const d=e.destination('merrit');if(d&&Date.now()-merritAt>3600000){
    if(!cfg.merchant.stand){e.note('Merrit benötigt aktivierten Stand');return false;}
    const point={...d,x:d.x+60,y:d.y+40};if(!e.travel(point,'Merrit',5))return true;
    if(!p.c.stand)return false;
    if(!Object.entries(p.c.slots??{}).some(([k,v])=>k.startsWith('trade')&&v)){e.note('Merrit wartet auf ein freigegebenes Angebot/Kaufgesuch');return false;}
    if(!merritBaseline)merritBaseline=bot.count('marketparcel')+1;
    if(bot.count('marketparcel')>=merritBaseline){merritAt=Date.now();merritBaseline=0;bot.event('merchant.merrit',{received:true});return false;}
    e.note('Merrit: Stand geöffnet, warte auf Belohnung');return true;
   }
  }
  if(cfg.merchant.fishing||cfg.merchant.mining)return gather(cfg.merchant.fishing?'fishing':'mining');
  return restore();
 }
 return {tick,restore,get active(){return !!gathering;}};
}
