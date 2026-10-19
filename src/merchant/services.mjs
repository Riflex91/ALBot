import {identity,distance,xy,protectedItem} from '../core/policy.mjs';
export function insidePolygon(point,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>point.y)!==(by>point.y)&&point.x<(bx-ax)*(point.y-ay)/(by-ay)+ax)inside=!inside;}return inside;}
export const nearGatherZone=(point,polygon)=>[[0,-24],[-24,0],[24,0],[0,24]].some(([x,y])=>insidePolygon({x:point.x+x,y:point.y+y},polygon));
// Prefer reachable shoreline positions, but rotate away from a waypoint whose
// native smart_move was rejected. Do not reject its entire map or polygon.
export function chooseGatherWorksite(regions,character,{failedRecently=()=>false,canMoveTo=()=>false}={}){
 const current=xy(character),ordered=[...regions].sort((a,b)=>Number(b.map===character.map)-Number(a.map===character.map));
 for(const region of ordered){
  if(region.map===character.map&&nearGatherZone(current,region.polygon))return {...region,...current};
  const candidates=(region.points??[]).filter(pt=>!failedRecently({...region,x:pt.x,y:pt.y},'economy'));
  candidates.sort((a,b)=>region.map===character.map?distance(character,a)-distance(character,b):0);
  if(!candidates.length)continue;
  const direct=region.map===character.map?candidates.find(pt=>canMoveTo(pt.x,pt.y)):null;
  return {...region,...(direct??candidates[0])};
 }
 return null;
}
export function createServices(bot){
 const {p,cfg,exec,me}=bot,e=bot.economy,key='albot:tools:'+me.name;
 let record=p.read(key),kind=null,cache=null,version=null,lastKind='mining',nextGather=0,approaching=null;
 let merritUntil=Number(p.read('albot:merrit:'+me.name))||0,anchor=null,baseline=null,since=0,probe=0;
 let merritGift=null,lastReward=null,baselineReceipt=null,sliceStarted=0;
 // This is the official event on the local character, never a CM/IPC payload.
 function observeMerrit(data){if(bot.running&&baseline!==null&&Number.isSafeInteger(data?.shells)&&data.shells>0&&data.shells<=1000)merritGift={shells:data.shells,at:Date.now()};}
 if(record&&(typeof record.mainhand!=='string'||typeof record.offhand!=='string')){e.note('Werkzeug-Checkpoint ungültig; Bestand prüfen');bot.inventoryBlocked=true;record=null;}
 function save(value){if(!p.write(key,value)){e.note('Werkzeugwechsel: Speichern fehlgeschlagen');return false;}record=value;return true;}
 function restore(){
  if(!record)return false;if(p.c.q?.fishing||p.c.q?.mining){e.note('Warte auf Ende des Gathering-Vorgangs');return true;}
  for(const target of ['mainhand','offhand']){
   const wanted=record[target],current=p.c.slots?.[target];if(identity(current)===wanted)continue;
   if(current&&protectedItem(current)){e.note('Werkzeug-Rückwechsel durch geschützte Ausrüstung blockiert');return true;}
   if(!wanted){if(bot.free()<1)return true;return e.perform('gather.restore',{guard:()=>!!p.c.slots[target]&&!protectedItem(p.c.slots[target]),call:()=>p.call('unequip',target),observe:()=>!p.c.slots[target],details:{slot:target}});}
   const slot=p.c.items.findIndex(i=>identity(i)===wanted);if(slot<0||!e.safe(p.c.items[slot])){e.note('Vorherige Ausrüstung für Werkzeugwechsel fehlt');return true;}
   return e.perform('gather.restore',{slots:[slot],guard:()=>!p.c.slots[target]||!protectedItem(p.c.slots[target]),call:()=>p.call('equip',slot,target),observe:()=>identity(p.c.slots[target])===wanted,details:{item:p.c.items[slot].name,slot:target}});
  }if(save(null))kind=null;return !!record;
 }
 function zones(){
  if(cache&&version===p.G)return cache;version=p.G;cache=[];
  for(const [map,data] of Object.entries(p.G.maps??{}))if(!data.pvp&&!data.instance&&!data.ignore&&!cfg.world?.excludedMaps.includes(map))for(const z of data.zones??[]){
   if(!['fishing','mining'].includes(z.type)||!Array.isArray(z.polygon)||z.polygon.length<3||z.polygon.length>100||z.polygon.some(x=>!Array.isArray(x)||!Number.isFinite(x[0])||!Number.isFinite(x[1])))continue;
   const polygon=z.polygon,points=[];
   for(let n=0;n<polygon.length;n++){const a=polygon[n],b=polygon[(n+1)%polygon.length];for(const t of [.25,.5,.75])for(const [dx,dy] of [[0,-16],[-16,0],[16,0],[0,16]]){const point={x:a[0]+(b[0]-a[0])*t+dx,y:a[1]+(b[1]-a[1])*t+dy};if(!insidePolygon(point,polygon)&&nearGatherZone(point,polygon))points.push(point);}}
   if(points.length)cache.push({map,in:map,...points[0],points,polygon,kind:z.type});
  }return cache;
 }
 function gather(activity){
  const skill=p.G.skills?.[activity];if(!skill||p.c.level<(skill.level??0)||p.c.mp<(skill.mp??0)||p.call('is_on_cooldown',activity))return false;
  const tool=activity==='fishing'?'rod':'pickaxe',allRegions=zones().filter(z=>z.kind===activity);
  if(p.c.ctype&&p.c.ctype!=='merchant')return false;
  if((bot.free?.()??p.c.items?.filter(i=>!i).length??0)<1){e.note('Gathering benötigt einen freien Inventarplatz');return false;}
  if(p.c.q?.fishing||p.c.q?.mining)return true;
  const zone=chooseGatherWorksite(allRegions,p.c,{
   failedRecently:(point,owner)=>bot.movement?.failedRecently?.(point,owner)??false,
   canMoveTo:(x,y)=>!!p.has?.('can_move_to')&&!!p.call('can_move_to',x,y)
  });
  if(!zone){approaching=null;e.note(allRegions.length?'Gathering-Arbeitsplätze nach fehlgeschlagenem smart_move vorübergehend ausgesetzt: '+activity:'Keine öffentliche '+activity+'-Zone bekannt');return false;}
  if(bot.monsters().some(m=>m.target===p.c.name)){approaching=null;return restore();}
   if(p.c.slots?.mainhand?.name!==tool&&!p.c.items.some(i=>i?.name===tool&&e.safe(i))){approaching=null;e.note('Werkzeug fehlt: '+tool);return false;}
   if(!e.travel(zone,activity,5)){if(!approaching||approaching.activity!==activity)approaching={activity,at:Date.now()};return true;}
   approaching=null;
   if(p.c.stand){exec.run?.('stand.close',['stand'],()=>bot.running&&!!p.c.stand,()=>p.call('close_stand'),{delay:1000});return true;}
  if(!record&&(p.c.slots?.mainhand&&protectedItem(p.c.slots.mainhand)&&p.c.slots.mainhand.name!==tool||p.c.slots?.offhand&&protectedItem(p.c.slots.offhand))){e.note('Geschützte Ausrüstung verhindert Werkzeugwechsel');return false;}
  if(!record){if(!save({mainhand:identity(p.c.slots?.mainhand),offhand:identity(p.c.slots?.offhand)}))return false;sliceStarted=Date.now();}kind=activity;
  if(p.c.slots.offhand){if(protectedItem(p.c.slots.offhand)||bot.free()<=1){e.note('Gathering benötigt freien Offhand-Slot');return restore();}
   const before=identity(p.c.slots.offhand);return e.perform('gather.offhand',{guard:()=>identity(p.c.slots.offhand)===before,call:()=>p.call('unequip','offhand'),observe:()=>!p.c.slots.offhand,details:{slot:'offhand'}});
  }
  if(p.c.slots.mainhand?.name!==tool){const slot=p.c.items.findIndex(i=>i?.name===tool&&e.safe(i));
   if(slot<0){const r=e.rules({name:tool,level:0},'acquisition');if(r?.action==='buy')return e.npcBuy({name:tool,level:0},{...r,goldBudget:Math.min(r.goldBudget,cfg.merchant.toolBudget)},1);e.note('Werkzeug fehlt: '+tool);return restore();}
   if(p.c.slots.mainhand&&protectedItem(p.c.slots.mainhand))return restore();
   return e.perform('gather.equip',{slots:[slot],guard:()=>!p.c.slots.offhand&&bot.free()>=1&&p.c.items[slot]?.name===tool&&!protectedItem(p.c.slots.mainhand),call:()=>p.call('equip',slot,'mainhand'),observe:()=>p.c.slots.mainhand?.name===tool,details:{item:tool}});
  }
  const ready=()=>{const main=p.c.slots?.mainhand,definition=main&&p.G.items?.[main.name];return main?.name===tool&&(definition?.wtype??main.name)===tool&&!p.c.slots.offhand&&!p.c.stand&&!p.c.moving&&(bot.free?.()??p.c.items?.filter(i=>!i).length??0)>0&&p.c.level>=(skill.level??16)&&p.c.mp>=(skill.mp??120)&&!p.c.q?.[activity]&&!p.call('is_on_cooldown',activity)&&nearGatherZone(xy(p.c),zone.polygon);};
   const accepted=e.perform('gather.'+activity,{guard:ready,call:()=>p.call('use_skill',activity),observe:()=>!!p.c.q?.[activity]||p.call('is_on_cooldown',activity),details:{item:tool},timeout:60000});
  if(accepted){lastKind=activity;nextGather=Date.now()+20000;}return accepted;
 }
 function merrit(){
  if(!cfg.merchant.merrit||Date.now()<merritUntil)return false;if(!cfg.merchant.stand){e.note('Merrit benötigt aktivierten Stand');return false;}
  const meta=p.G.npcs?.citizen22?.market;if(!meta?.areas)return false;
  const receipt=p.c.merrit_receipt??p.c.p?.merrit_receipt,receiptSeen=baseline!==null&&typeof receipt?.id==='string'&&receipt.id!==baselineReceipt&&receipt.id.length<=160&&receipt.name===me.name&&Number.isFinite(receipt.at)&&receipt.at>=since&&receipt.at<=Date.now()+2000&&(receipt.quantity>0||receipt.shells>0);
  if(baseline!==null&&(bot.count('marketparcel')>baseline||merritGift||receiptSeen)){
   const until=Date.now()+(meta.hour_ms??3600000);if(!p.write('albot:merrit:'+me.name,until)){e.note('Merrit-Belohnung beobachtet; Cooldown konnte nicht gespeichert werden');return true;}
   merritUntil=until;lastReward={received:true,source:receiptSeen?'receipt':merritGift?'character-event':'inventory',shells:receiptSeen?receipt.shells??0:merritGift?.shells??0,parcel:bot.count('marketparcel')>baseline};anchor=null;baseline=null;merritGift=null;bot.event('merchant.merrit',lastReward);return false;
  }
  if(Date.now()<probe)return false;
  // Without a permitted offer, Merrit cannot grant the reward. Do not
  // abandon gathering and route to the market just to discover this later.
  const eligible=Object.entries(p.c.slots??{}).some(([k,v])=>/^trade\d+$/.test(k)&&v&&p.G.items[v.name]&&v.name!=='placeholder'&&!v.l&&!v.acl&&!v.v&&v.giveaway===undefined&&!v.want&&Number.isFinite(v.price)&&v.price>0&&(v.q===undefined||v.q>0)&&(!v.b||p.c.gold>=v.price));
  if(baseline===null&&!eligible){anchor=null;probe=Date.now()+60000;e.note('Merrit ausgesetzt: kein freigegebenes Standangebot');return false;}
  const safe=point=>!(p.G.maps?.main?.npcs??[]).some(n=>Array.isArray(n.position)&&distance({x:n.position[0],y:n.position[1]},point)<=(meta.npc_clearance??40))&&!Object.values(p.entities).some(x=>x!==p.c&&(x.npc||x.type==='npc'?distance(x,point)<=(meta.npc_clearance??40):x.stand&&(distance(x,point)<=(meta.stand_clearance??10)||Math.abs(xy(x).x-point.x)<(meta.front_width??10)&&Math.abs(xy(x).y-point.y)<=(meta.front_clearance??15))));
  if(!anchor){const points=[];for(const [x0,y0,x1,y1] of meta.areas.slice(0,8))for(let x=x0+24;x<x1-20;x+=48)for(let y=y0+24;y<y1-20;y+=48)points.push({map:'main',in:'main',x,y});anchor=points.sort((a,b)=>distance(p.c,a)-distance(p.c,b)).find(safe)??null;if(!anchor){e.note('Kein freier Merrit-Standplatz');probe=Date.now()+30000;return false;}}
  if(!e.travel(anchor,'Merrit',3))return true;if(!safe(anchor)){anchor=null;since=0;return false;}
  if(!p.c.stand){exec.run('stand',['stand'],()=>bot.running,()=>p.call('open_stand'),{delay:5000});return true;}
  if(!Object.entries(p.c.slots??{}).some(([k,v])=>/^trade\d+$/.test(k)&&v&&p.G.items[v.name]&&v.name!=='placeholder'&&!v.l&&!v.acl&&!v.v&&v.giveaway===undefined&&!v.want&&Number.isFinite(v.price)&&v.price>0&&(v.q===undefined||v.q>0)&&(!v.b||p.c.gold>=v.price))){e.note('Merrit benötigt freigegebenes Angebot/Kaufgesuch');return false;}
  if(baseline===null){baseline=bot.count('marketparcel');baselineReceipt=receipt?.id??null;since=Date.now();}
  if(Date.now()-since>(meta.settle_ms??120000)+60000){probe=Date.now()+60000;since=0;anchor=null;baseline=null;return false;}
  e.note('Merrit: Warte auf beobachtete Belohnung');return true;
 }
 function castBuff(choices,reason){
  for(const skill of choices){const s=p.G.skills?.[skill];
   const ready=()=>bot.running&&cfg.merchant.massBuffs&&!bot.journal&&!bot.inventoryBlocked&&
    !!s&&!p.c.s?.[s.condition??skill]&&p.c.level>=(s.level??0)&&
    p.c.mp-(s.mp??0)>=p.c.max_mp*.3&&!p.call('is_on_cooldown',skill);
   if(ready()&&exec.run('service:'+skill,['skill','mana'],ready,()=>p.call('use_skill',skill),{delay:10000})){
    bot.event?.('service.buff',{skill,reason});return true;
   }
  }return false;
 }
 function productionBuff(kind){
  if(!cfg.production.enabled||!cfg.merchant.massBuffs||p.c.moving||bot.movement?.order||
     !['upgrade','compound','craft','exchange'].includes(kind))return false;
  return castBuff(kind==='exchange'?['massexchangepp','massexchange']:['massproductionpp','massproduction'],'Ausf�hrbarer Produktionsschritt: '+kind);
 }
 function tick(){
  if(record&&!sliceStarted)sliceStarted=Date.now();if(record&&Date.now()-sliceStarted>=(cfg.merchant.serviceSliceMs??30000)){interrupt();if(bot.movement.order?.owner==='economy')bot.movement.stop();nextGather=Date.now()+cfg.general.economyTickMs;return restore();}
  if(cfg.merchant.massBuffs){
   const threatened=bot.monsters().some(m=>m.target===p.c.name);
   if(castBuff([...(threatened?['mcourage']:[]),...(bot.target?['mfrenzy']:[])],threatened?'Eigener Gefahrenzustand':'Aktueller Kampf'))return true;
  }
  if(record&&(!kind||Date.now()<nextGather||(!cfg.merchant.fishing&&!cfg.merchant.mining)))return restore();
  const requested=bot.strategy?.status().manual?.task;
  if(!approaching&&!record&&(!requested||requested==='merrit')&&merrit())return true;if(Date.now()<nextGather)return false;
  const activities=['fishing','mining'].filter(k=>cfg.merchant[k]&&(!requested||requested===k));
  const lease=approaching?.activity??kind;
  const ordered=lease?activities.filter(k=>k===lease):activities.sort((a,b)=>(a===lastKind?1:0)-(b===lastKind?1:0));
  for(const activity of ordered)if(gather(activity))return true;return restore();
 }
 function interrupt(){kind=null;approaching=null;anchor=null;since=0;baseline=null;merritGift=null;sliceStarted=0;}
 return {tick,productionBuff,restore,merrit,observeMerrit,get active(){return !!record;},get approaching(){return !!approaching;},get waiting(){return !!anchor||baseline!==null;},status:()=>({gathering:kind,approaching:approaching?{...approaching}:null,restorePending:!!record,merritWaiting:!!anchor||baseline!==null,merritCooldownUntil:merritUntil,merritReward:lastReward}),interrupt};
}
