import {identity} from '../core/policy.mjs';
export function gearScore(stats,role,ctype=''){
 const weights=role==='tank'?{hp:.01,armor:1,resistance:1,vit:2,vitality:2}:role==='healer'?{attack:2,int:3,mp:.02,frequency:100,armor:.3,resistance:.3,hp:.004,speed:.2}:role==='economy'?{gold:10,luck:10,speed:2,mp:.01,armor:.1,resistance:.1,hp:.002}:{attack:2,apiercing:.3,rpiercing:.3,str:1,dex:1,int:1,frequency:100,crit:2,armor:.2,resistance:.2,hp:.002,mp:.001,speed:.2};
 if(role==='dps'&&ctype){delete weights.str;delete weights.dex;delete weights.int;weights[['ranger','rogue'].includes(ctype)?'dex':['mage','priest'].includes(ctype)?'int':'str']=2;}
 return Object.entries(weights).reduce((n,[key,w])=>n+(Number(stats?.[key])||0)*w,0);
}
export function gearCompatible(G,profile,item,target){
 const meta=G.items?.[item.name],cls=G.classes?.[profile.class]??{},type=meta?.type,w=meta?.wtype??type;
 if(!meta||(meta.level??0)>profile.level||meta.class&&!meta.class.includes(profile.class))return false;
 if(['weapon','tool'].includes(type)){if(target==='mainhand')return (Object.hasOwn(cls.mainhand??{},w)||Object.hasOwn(cls.doublehand??{},w))&&(!Object.hasOwn(cls.doublehand??{},w)||!profile.slots.offhand);return target==='offhand'&&Object.hasOwn(cls.offhand??{},w)&&!Object.hasOwn(cls.doublehand??{},G.items[profile.slots.mainhand?.name]?.wtype??'');}
 if(['shield','source','quiver','misc_offhand'].includes(type))return target==='offhand'&&Object.hasOwn(cls.offhand??{},type)&&!Object.hasOwn(cls.doublehand??{},G.items[profile.slots.mainhand?.name]?.wtype??'');
 return type==='ring'?['ring1','ring2'].includes(target):type==='earring'?['earring1','earring2'].includes(target):target===type;
}
export function createGear(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const key='albot:gear:'+me.name+':profiles';let profiles=cfg.production.offlineProfiles?(p.read(key)??{}):{},lastSave=0;
 if(!profiles||typeof profiles!=='object'||Array.isArray(profiles))profiles={};
 profiles=Object.fromEntries(Object.entries(profiles).filter(([name,x])=>bot.teamNames.includes(name)&&x&&typeof x==='object'&&x.slots&&typeof x.slots==='object'&&Number.isFinite(x.at)).slice(0,20));
 function snapshot(){const slots={};for(const [slot,i] of Object.entries(p.c.slots??{}))if(i&&!slot.startsWith('trade'))slots[slot]={name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??'',l:!!i.l,b:!!i.b};const stats=Object.fromEntries(["attack","frequency","armor","resistance","max_hp","max_mp","range","crit","apiercing","rpiercing"].filter(k=>Number.isFinite(p.c[k])).map(k=>[k,p.c[k]]));return {class:p.c.ctype,level:p.c.level,slots,stats};}
 function refresh(){
  if(!cfg.production.gear&&cfg.party.selection!=='adaptive')return;for(const name of bot.teamNames){const peer=name===me.name?{gear:snapshot(),received:Date.now()}:bot.transport.fresh(name);const data=peer?.gear;
   if(!data||typeof data.class!=='string'||!Number.isFinite(data.level)||!data.slots||typeof data.slots!=='object')continue;
   const slots={};for(const [slot,i] of Object.entries(data.slots).slice(0,16))if(i&&typeof i.name==='string'&&p.G.items[i.name]&&Number.isInteger(i.level)&&i.level>=0&&i.level<=99)slots[slot]={name:i.name,level:i.level,stat_type:typeof i.stat_type==='string'?i.stat_type:'',p:typeof i.p==='string'?i.p:'',title:typeof i.title==='string'?i.title:'',l:!!i.l,b:!!i.b};
   profiles[name]={class:data.class,level:data.level,slots,stats:Object.fromEntries(Object.entries(data.stats??{}).filter(([k,v])=>["attack","frequency","armor","resistance","max_hp","max_mp","range","crit","apiercing","rpiercing"].includes(k)&&Number.isFinite(v)&&Math.abs(v)<1e9)),at:Date.now()};
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
  let nextScore,oldScore;try{nextScore=gearScore(p.call('item_properties',item),role,p.c.ctype);oldScore=current?gearScore(p.call('item_properties',current),role,p.c.ctype):0;}catch{return false;}
  if(current&&nextScore<oldScore*(1+cfg.production.minImprovement))return false;
  const oldId=identity(current);
  return e.perform('gear.equip',{slots:[slot],rule:r,guard:()=>identity(p.c.slots[target])===oldId,call:()=>p.call('equip',slot,target),observe:()=>identity(p.c.slots[target])===identity(item),details:{item:item.name,slot:target}});
 }
 function suggestions(){const result=[];if(!cfg.production.gear)return result;for(const [name,profile] of Object.entries(profiles)){
  const member=cfg.characters.find(c=>c.name===name);if(!member)continue;
  for(const rule of cfg.items.filter(r=>r.enabled&&r.action==='equip'&&(!r.character||r.character===name))){const item=p.c.items.find(i=>i?.name===rule.item&&e.safe(i)&&(i.level??0)>=rule.minLevel&&(i.level??0)<=rule.maxLevel);if(!item)continue;const meta=p.G.items[item.name];if(!gearCompatible(p.G,profile,item,rule.slot))continue;
   try{const role=member.gearRole==='auto'?(profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps'):member.gearRole,old=profile.slots[rule.slot];const score=gearScore(p.call('item_properties',item),role,profile.class),previous=old?gearScore(p.call('item_properties',old),role,profile.class):0;if(score>previous*(1+cfg.production.minImprovement))result.push({character:name,item:item.name,level:item.level??0,slot:rule.slot,score,previous,offline:!bot.transport.fresh(name)&&name!==me.name});}catch{}
  }
 }return result.slice(0,20);}
 function targets(){const result=[...(bot.intelligence?.targets()??[]),...(cfg.production.gearTargets??[])].filter(g=>g.enabled).map(g=>({...g}));
  if(cfg.production.autoGear)for(const member of cfg.characters.filter(c=>c.enabled)){const profile=member.name===me.name?snapshot():profiles[member.name];if(!profile)continue;for(const [slot,i] of Object.entries(profile.slots)){if(!i||i.l||i.b||!cfg.production.autoGearItems.includes(i.name)||!p.G.items[i.name]?.upgrade||i.level>=cfg.production.autoGearMaxLevel||result.some(g=>g.character===member.name&&g.slot===slot))continue;
   result.push({name:'Auto-Gear '+member.name+' '+slot+' +'+(i.level+1),enabled:true,character:member.name,slot,item:i.name,level:i.level+1,budget:cfg.production.autoGearBudget,priority:member.catchUp?30:10});
  }}return result;
 }
 function goals(){if(!cfg.production.gear)return [];return targets().flatMap(g=>{
  const profile=g.character===me.name?snapshot():profiles[g.character];if(!profile||!gearCompatible(p.G,profile,{name:g.item,level:g.level},g.slot))return [];
  const old=profile.slots[g.slot];if(old?.l||old?.b||old?.name===g.item&&old.level>=g.level)return [];
  const member=cfg.characters.find(c=>c.name===g.character),role=member?.gearRole==='auto'?(profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps'):member?.gearRole;
  try{if(old&&gearScore(p.call('item_properties',{name:g.item,level:g.level}),role,profile.class)<gearScore(p.call('item_properties',old),role,profile.class)*(1+cfg.production.minImprovement))return [];}catch{return [];}
  return [{...g,name:'Gear: '+g.name,quantity:1,recipient:g.character===me.name?'':g.character,gearSlot:g.slot}];
 });}
 function status(){const eligible=new Set(goals().map(g=>g.name));return targets().slice(0,32).map(g=>{const profile=g.character===me.name?snapshot():profiles[g.character],old=profile?.slots?.[g.slot];return {name:g.name,character:g.character,item:g.item,level:g.level,slot:g.slot,offline:g.character!==me.name&&!bot.transport.fresh(g.character),state:!cfg.production.gear?'disabled':!profile?'unknown-profile':!gearCompatible(p.G,profile,{name:g.item,level:g.level},g.slot)?'incompatible':old?.l||old?.b?'protected':old?.name===g.item&&old.level>=g.level?'equipped':eligible.has('Gear: '+g.name)?'requested':'below-improvement-threshold'};});}
 return {equip,snapshot,refresh,suggestions,goals,status,profile:name=>profiles[name]??null};
}
