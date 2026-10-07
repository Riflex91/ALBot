import {identity} from '../core/policy.mjs';
export function gearScore(stats,role){
 const weights=role==='tank'?{hp:.01,armor:1,resistance:1,vitality:2}:role==='healer'?{attack:2,int:3,mp:.02,frequency:100}:role==='economy'?{gold:10,luck:10,speed:2,mp:.01}:{attack:2,apiercing:.3,rpiercing:.3,str:1,dex:1,int:1,frequency:100,crit:2};
 return Object.entries(weights).reduce((n,[key,w])=>n+(Number(stats?.[key])||0)*w,0);
}
export function createGear(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const key='albot:gear:'+me.name+':profiles';let profiles=cfg.production.offlineProfiles?(p.read(key)??{}):{},lastSave=0;
 if(!profiles||typeof profiles!=='object'||Array.isArray(profiles))profiles={};
 profiles=Object.fromEntries(Object.entries(profiles).filter(([name,x])=>bot.teamNames.includes(name)&&x&&typeof x==='object'&&x.slots&&typeof x.slots==='object'&&Number.isFinite(x.at)).slice(0,20));
 function snapshot(){const slots={};for(const [slot,i] of Object.entries(p.c.slots??{}))if(i&&!slot.startsWith('trade'))slots[slot]={name:i.name,level:i.level??0};return {class:p.c.ctype,level:p.c.level,slots};}
 function refresh(){
  if(!cfg.production.gear)return;for(const name of bot.teamNames){const peer=name===me.name?{gear:snapshot(),received:Date.now()}:bot.transport.fresh(name);const data=peer?.gear;
   if(!data||typeof data.class!=='string'||!Number.isFinite(data.level)||!data.slots||typeof data.slots!=='object')continue;
   const slots={};for(const [slot,i] of Object.entries(data.slots).slice(0,16))if(i&&typeof i.name==='string'&&p.G.items[i.name]&&Number.isInteger(i.level)&&i.level>=0&&i.level<=99)slots[slot]={name:i.name,level:i.level};
   profiles[name]={class:data.class,level:data.level,slots,at:Date.now()};
  }
  profiles=Object.fromEntries(Object.entries(profiles).filter(([name,x])=>bot.teamNames.includes(name)&&Date.now()-x.at<7*86400000).slice(0,20));
  if(cfg.production.offlineProfiles&&Date.now()-lastSave>60000){lastSave=Date.now();p.write(key,profiles);}
 }
 function equip(slot,r){
  const item=p.c.items[slot],target=r.slot;if(!cfg.production.gear||!e.safe(item)||!target||target.startsWith('trade')||!Object.hasOwn(p.c.slots??{},target))return false;
  const meta=p.G.items[item.name];if(!meta||(meta.level??0)>p.c.level||meta.class&&!meta.class.includes(p.c.ctype))return false;
  const cls=p.G.classes?.[p.c.ctype]??{},type=meta.type,w=meta.wtype??type;
  if(type==='ring'&&!['ring1','ring2'].includes(target)||type==='earring'&&!['earring1','earring2'].includes(target))return false;
  if(['weapon','tool'].includes(type)){if(target==='mainhand'){if(!Object.hasOwn(cls.mainhand??{},w)&&!Object.hasOwn(cls.doublehand??{},w))return false;if(Object.hasOwn(cls.doublehand??{},w)&&p.c.slots.offhand)return false;}else if(target!=='offhand'||!Object.hasOwn(cls.offhand??{},w)||Object.hasOwn(cls.doublehand??{},p.G.items[p.c.slots.mainhand?.name]?.wtype??''))return false;}
  else if(['shield','source','quiver','misc_offhand'].includes(type)){if(target!=='offhand'||!Object.hasOwn(cls.offhand??{},type))return false;}
  else if(!['ring','earring'].includes(type)&&target!==type)return false;
  const current=p.c.slots[target];if(current?.l||current?.b)return false;
  const role=me.gearRole==='auto'?(p.c.ctype==='priest'?'healer':p.c.ctype==='merchant'?'economy':'dps'):me.gearRole;
  let nextScore,oldScore;try{nextScore=gearScore(p.call('item_properties',item),role);oldScore=current?gearScore(p.call('item_properties',current),role):0;}catch{return false;}
  if(current&&nextScore<oldScore*(1+cfg.production.minImprovement))return false;
  const oldId=identity(current);
  return e.perform('gear.equip',{slots:[slot],rule:r,guard:()=>identity(p.c.slots[target])===oldId,call:()=>p.call('equip',slot,target),observe:()=>identity(p.c.slots[target])===identity(item),details:{item:item.name,slot:target}});
 }
 function suggestions(){const result=[];if(!cfg.production.gear)return result;for(const [name,profile] of Object.entries(profiles)){
  const member=cfg.characters.find(c=>c.name===name);if(!member)continue;
  for(const rule of cfg.items.filter(r=>r.enabled&&r.action==='equip'&&(!r.character||r.character===name))){const item=p.c.items.find(i=>i?.name===rule.item&&e.safe(i)&&(i.level??0)>=rule.minLevel&&(i.level??0)<=rule.maxLevel);if(!item)continue;const meta=p.G.items[item.name];if((meta?.level??0)>profile.level||meta?.class&&!meta.class.includes(profile.class))continue;
   try{const role=member.gearRole==='auto'?(profile.class==='priest'?'healer':'dps'):member.gearRole,old=profile.slots[rule.slot];const score=gearScore(p.call('item_properties',item),role),previous=old?gearScore(p.call('item_properties',old),role):0;if(score>previous*(1+cfg.production.minImprovement))result.push({character:name,item:item.name,level:item.level??0,slot:rule.slot,score,previous,offline:!bot.transport.fresh(name)&&name!==me.name});}catch{}
  }
 }return result.slice(0,20);}
 return {equip,snapshot,refresh,suggestions};
}
