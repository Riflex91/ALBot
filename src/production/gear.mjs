import {gearCatchUpPriority,crossRoleGearPriority,measuredSlotUtilityPriority,observedGearStatDelta} from './gear-fairness.mjs';
import {identity} from '../core/policy.mjs';
export function gearScore(stats,role,ctype=''){
 const weights=role==='tank'?{hp:.01,armor:1,resistance:1,vit:2,vitality:2}:role==='healer'?{attack:2,int:3,mp:.02,frequency:100,armor:.3,resistance:.3,hp:.004,speed:.2}:role==='economy'?{gold:10,luck:10,speed:2,mp:.01,armor:.1,resistance:.1,hp:.002}:{attack:2,apiercing:.3,rpiercing:.3,str:1,dex:1,int:1,frequency:100,crit:2,armor:.2,resistance:.2,hp:.002,mp:.001,speed:.2};
 if(role==='dps'&&ctype){delete weights.str;delete weights.dex;delete weights.int;weights[['ranger','rogue'].includes(ctype)?'dex':['mage','priest'].includes(ctype)?'int':'str']=2;}
 return Object.entries(weights).reduce((n,[key,w])=>n+(Number(stats?.[key])||0)*w,0);
}

/** Hard suitability checks before a weighted Gear score can approve a change.
 * Stats are the live item_properties values, never a static item-level formula. */
export function gearSuitability(previous,next,role,ctype,mobility='mobile'){
 if(!next||typeof next!=='object'||(previous&&typeof previous!=='object'))return {ok:false,reason:'stats-unavailable'};
 const stat=(v,key)=>{const n=v?.[key];return Number.isFinite(n)?n:0;};
 if(ctype==='merchant'&&mobility!=='stationary'&&stat(next,'speed')+1e-6<stat(previous,'speed'))
  return {ok:false,reason:'merchant-speed-loss'};
 // Measure survival contribution from the replaced equipment, not total character
 // HP: the latter includes class/level bonuses and would conceal slot losses.
 const survival=x=>Math.max(0,stat(x,'hp'))*.01+Math.max(0,stat(x,'max_hp'))*.01+
  Math.max(0,stat(x,'armor'))*.4+Math.max(0,stat(x,'resistance'))*.4+
  Math.max(0,stat(x,'vit'))*2+Math.max(0,stat(x,'vitality'))*2+
  Math.max(0,stat(x,'evasion'))*.25;
 const oldSurvival=survival(previous),nextSurvival=survival(next);
 const floor=['tank','healer','economy'].includes(role)||ctype==='merchant'?.9:.75;
 if(previous&&oldSurvival>0&&nextSurvival+1e-6<oldSurvival*floor)
  return {ok:false,reason:'survival-loss',oldSurvival,nextSurvival};
 return {ok:true,reason:'suitable',oldSurvival,nextSurvival};
}
export function gearCompatible(G,profile,item,target){
 const meta=G.items?.[item.name],cls=G.classes?.[profile.class]??{},type=meta?.type,w=meta?.wtype??type;
 if(!meta||(meta.level??0)>profile.level||meta.class&&!meta.class.includes(profile.class))return false;
 if(['weapon','tool'].includes(type)){if(target==='mainhand')return (Object.hasOwn(cls.mainhand??{},w)||Object.hasOwn(cls.doublehand??{},w))&&(!Object.hasOwn(cls.doublehand??{},w)||!profile.slots.offhand);return target==='offhand'&&Object.hasOwn(cls.offhand??{},w)&&!Object.hasOwn(cls.doublehand??{},G.items[profile.slots.mainhand?.name]?.wtype??'');}
 if(['shield','source','quiver','misc_offhand'].includes(type))return target==='offhand'&&Object.hasOwn(cls.offhand??{},type)&&!Object.hasOwn(cls.doublehand??{},G.items[profile.slots.mainhand?.name]?.wtype??'');
 return type==='ring'?['ring1','ring2'].includes(target):type==='earring'?['earring1','earring2'].includes(target):target===type;
}
// Ordinal scheduling only; spending, success-chance and user level caps
// remain governed by their existing production and gear contracts.
export function gearSlotPriority(slot,characterClass){
 const weights={mainhand:12,offhand:10,helmet:8,chest:8,pants:8,shoes:7,
  gloves:7,amulet:5,belt:5,ring1:4,ring2:4,earring1:3,earring2:3,
  cape:2,orb:2};
 return (weights[slot]??5)+(['ranger','mage','priest'].includes(characterClass)&&
  slot==='mainhand'?4:0);
}
// A level cap never supersedes the user's limit. Weapons may reach +8,
// other equipment +7 only if the wearer has progressed far enough.
export function autoGearTargetLevel(configured,characterLevel,slot){
 const userCap=Number.isInteger(configured)?configured:8;
 const progressionCap=Math.floor(Math.max(1,Number(characterLevel)||1)/10)+3;
 return Math.max(0,Math.min(userCap,slot==='mainhand'?8:7,progressionCap));
}
export function createGear(bot,{now=()=>Date.now()}={}){
 const {p,cfg,me}=bot,e=bot.economy;
 let lastLocalSnapshot=null,observedGearChanges=[];
 const key='albot:gear:'+me.name+':profiles';let profiles=cfg.production.offlineProfiles?(p.read(key)??{}):{},lastSave=0;
 if(!profiles||typeof profiles!=='object'||Array.isArray(profiles))profiles={};
 profiles=Object.fromEntries(Object.entries(profiles).filter(([name,x])=>bot.teamNames.includes(name)&&x&&typeof x==='object'&&x.slots&&typeof x.slots==='object'&&Number.isFinite(x.at)).slice(0,20));
 const gearSlots=['mainhand','offhand','helmet','chest','pants','shoes','gloves','amulet',
  'belt','cape','ring1','ring2','earring1','earring2','orb'];
 function snapshot(){
  const slots=Object.fromEntries(gearSlots.map(slot=>[slot,null]));
  for(const [slot,i] of Object.entries(p.c.slots??{}))
   if(i&&!slot.startsWith('trade'))slots[slot]={name:i.name,level:i.level??0,
    stat_type:i.stat_type??'',p:i.p??'',title:i.title??'',l:!!i.l,b:!!i.b};
  const stats=Object.fromEntries(["attack","frequency","armor","resistance","max_hp","max_mp",
   "range","crit","apiercing","rpiercing"].filter(k=>Number.isFinite(p.c[k])).map(k=>[k,p.c[k]]));
  return {class:p.c.ctype,level:p.c.level,slots,stats,complete:true,at:now(),
   session:bot.session,realm:p.realm()};
 }
 function refresh(){
  if(!cfg.production.gear&&cfg.party.selection!=='adaptive')return;
  // Observe only this living process's own canonical, direct game snapshot.
  // Do not compare stale peer heartbeat timestamps or invent equip receipts.
  const local=snapshot(),change=observedGearStatDelta(
   lastLocalSnapshot,local,{now:local.at});
  lastLocalSnapshot=local;
  if(change)observedGearChanges=[...observedGearChanges.slice(-15),change];
  for(const name of bot.teamNames){const peer=name===me.name?{gear:snapshot(),received:Date.now()}:bot.transport.fresh(name);const data=peer?.gear;
   // The heartbeat may be fresh while its embedded gear snapshot is
   // outdated or belongs to another realm. Do not refresh the timestamp
   // of old gear merely because a peer sent another heartbeat.
   const peerRealm=name===me.name?p.realm():peer?.realm;
   const evidenceAt=data?.at;
   if(!data||typeof data.class!=='string'||!Number.isFinite(data.level)||
      !data.slots||typeof data.slots!=='object'||
      typeof peerRealm!=='string'||peerRealm!==p.realm()||
      data.realm!==peerRealm||!Number.isSafeInteger(evidenceAt)||
      evidenceAt<=0||evidenceAt>Date.now()||
      Date.now()-evidenceAt>604800000)continue;
   // Missing, malformed or unknown equipment is NOT proof of a vacant
   // canonical slot. Do not turn a failed gear observation into an urgent
   // weapon/armor delivery or synthetic cross-role catch-up score.
   const complete=Number.isSafeInteger(data.level)&&data.level>=1&&
    gearSlots.every(slot=>{
     if(!Object.hasOwn(data.slots,slot))return false;
     const i=data.slots[slot];
     return i===null||!!i&&typeof i==='object'&&!Array.isArray(i)&&
      typeof i.name==='string'&&i.name.length>0&&i.name.length<=120&&
      !!p.G.items?.[i.name]&&Number.isSafeInteger(i.level)&&
      i.level>=0&&i.level<=99;
    });
   if(!complete)continue;
   const slots=Object.fromEntries(gearSlots.map(slot=>{
    const i=data.slots[slot];
    return [slot,i?{name:i.name,level:i.level,
     stat_type:typeof i.stat_type==='string'?i.stat_type:'',
     p:typeof i.p==='string'?i.p:'',
     title:typeof i.title==='string'?i.title:'',
     l:!!i.l,b:!!i.b}:null];
   }));
   profiles[name]={class:data.class,level:data.level,slots,complete,session:peer?.session??bot.session,realm:peerRealm,stats:Object.fromEntries(Object.entries(data.stats??{}).filter(([k,v])=>["attack","frequency","armor","resistance","max_hp","max_mp","range","crit","apiercing","rpiercing"].includes(k)&&Number.isFinite(v)&&Math.abs(v)<1e9)),at:evidenceAt};
  }
  profiles=Object.fromEntries(Object.entries(profiles).filter(([name,x])=>bot.teamNames.includes(name)&&Date.now()-x.at<7*86400000).slice(0,20));
  if(cfg.production.offlineProfiles&&Date.now()-lastSave>60000){lastSave=Date.now();p.write(key,profiles);}
 }
 function equip(slot,r){
  const item=p.c.items[slot],target=r.slot;if(!cfg.production.gear||!e.safe(item)||!target||target.startsWith('trade')||!gearCompatible(p.G,{class:p.c.ctype,level:p.c.level,slots:p.c.slots??{}},item,target))return false;
  const meta=p.G.items[item.name];if(!meta||(meta.level??0)>p.c.level||meta.class&&!meta.class.includes(p.c.ctype))return false;
  const cls=p.G.classes?.[p.c.ctype]??{},type=meta.type,w=meta.wtype??type;
  if(type==='ring'&&!['ring1','ring2'].includes(target)||type==='earring'&&!['earring1','earring2'].includes(target))return false;
  if(['weapon','tool'].includes(type)){if(target==='mainhand'){if(!Object.hasOwn(cls.mainhand??{},w)&&!Object.hasOwn(cls.doublehand??{},w))return false;if(Object.hasOwn(cls.doublehand??{},w)&&p.c.slots.offhand)return false;}else if(target!=='offhand'||!Object.hasOwn(cls.offhand??{},w)||Object.hasOwn(cls.doublehand??{},p.G.items[p.c.slots.mainhand?.name]?.wtype??''))return false;}
  else if(['shield','source','quiver','misc_offhand'].includes(type)){if(target!=='offhand'||!Object.hasOwn(cls.offhand??{},type))return false;}
  else if(!['ring','earring'].includes(type)&&target!==type)return false;
  const current=p.c.slots[target];if(current?.l||current?.b||bot.allocation?.equipGuard(item,target)===false)return false;
  const role=me.gearRole==='auto'?(p.c.ctype==='priest'?'healer':p.c.ctype==='merchant'?'economy':'dps'):me.gearRole;
  let nextScore,oldScore;try{const next=p.call('item_properties',item),previous=current?p.call('item_properties',current):null;
   const assessment=gearSuitability(previous,next,role,p.c.ctype,me.merchantMobility);
   if(!assessment.ok){e.note('Gear abgelehnt: '+assessment.reason+' / '+target);return false;}
   nextScore=gearScore(next,role,p.c.ctype);oldScore=previous?gearScore(previous,role,p.c.ctype):0;}catch{return false;}
  if(current&&nextScore<oldScore*(1+cfg.production.minImprovement))return false;
  const oldId=identity(current);
  return e.perform('gear.equip',{slots:[slot],rule:r,guard:()=>identity(p.c.slots[target])===oldId&&bot.allocation?.equipGuard(item,target)!==false&&
    gearSuitability(p.c.slots[target]?p.call('item_properties',p.c.slots[target]):null,p.call('item_properties',p.c.items[slot]),role,p.c.ctype,me.merchantMobility).ok,call:()=>p.call('equip',slot,target),observe:()=>identity(p.c.slots[target])===identity(item),details:{item:item.name,slot:target}});
 }
 function suggestions(){const result=[];if(!cfg.production.gear)return result;for(const [name,profile] of Object.entries(profiles)){
  const member=cfg.characters.find(c=>c.name===name);if(!member)continue;
  for(const rule of cfg.items.filter(r=>r.enabled&&r.action==='equip'&&(!r.character||r.character===name))){const item=p.c.items.find(i=>i?.name===rule.item&&e.safe(i)&&(i.level??0)>=rule.minLevel&&(i.level??0)<=rule.maxLevel);if(!item)continue;const meta=p.G.items[item.name];if(!gearCompatible(p.G,profile,item,rule.slot))continue;
   try{const role=member.gearRole==='auto'?(profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps'):member.gearRole,old=profile.slots[rule.slot];const nextStats=p.call('item_properties',item),oldStats=old?p.call('item_properties',old):null;if(!gearSuitability(oldStats,nextStats,role,profile.class,member.merchantMobility).ok)continue;const score=gearScore(nextStats,role,profile.class),previous=oldStats?gearScore(oldStats,role,profile.class):0;if(score>previous*(1+cfg.production.minImprovement))result.push({character:name,item:item.name,level:item.level??0,slot:rule.slot,score,previous,offline:!bot.transport.fresh(name)&&name!==me.name});}catch{}
  }
 }return result.slice(0,20);}
 function targets(){
  const optimized=bot.intelligence?.targets()??[];
  const fairness=g=>{
   const member=cfg.characters.find(c=>c.enabled&&c.name===g.character);
   if(!member)return 0;
   const current=name=>name===me.name?snapshot():profiles[name];
   const profile=current(g.character);
   const sameRole=cfg.characters.filter(c=>c.enabled&&c.role===member.role).map(c=>current(c.name));
   const classify=(c,p)=>c.gearRole==='auto'?
    (p?.class==='priest'?'healer':p?.class==='merchant'?'economy':'dps'):
    (['healer','tank','economy','dps'].includes(c.gearRole)?c.gearRole:'dps');
   const cohort=cfg.characters.filter(c=>c.enabled).map(c=>({
    profile:current(c.name),role:classify(c,current(c.name))}));
   // Only confirmed equip receipts can start the bounded waiting-age clock.
   // A missing receipt never implies that another character has waited.
   const receipts=bot.allocation?.status?.()??[];
   const last=Math.max(0,...receipts.filter(r=>r.recipient===g.character&&
    r.state==='equipped'&&Number.isSafeInteger(r.settled)&&
    r.settled>0).map(r=>r.settled));
   return Math.min(75,gearCatchUpPriority(profile,sameRole,{now:Date.now()})+
    crossRoleGearPriority(profile,cohort,{
     role:classify(member,profile),slot:g.slot,
     lastImprovedAt:last||null})+
    measuredSlotUtilityPriority(g,optimized,{profile,now:Date.now()}));
  };
  const automatic=optimized.map(g=>({...g,priority:(g.priority??0)+fairness(g)}));
  const result=[...automatic,...(cfg.production.gearTargets??[])].filter(g=>g.enabled).map(g=>({...g}));
  // Prefer a server-compatible, non-protected weapon already in Merchant
  // inventory. A +3 staff held in stock must beat buying/delivering +0.
  // No speculative bank item is counted as a physically available transfer.
  if(cfg.production.gear&&p.G.items?.staff)for(const member of cfg.characters.filter(c=>c.enabled&&c.role==='farmer')){
   const profile=member.name===me.name?snapshot():profiles[member.name];
   if(!['mage','priest'].includes(profile?.class)||!profile.slots||profile.slots.mainhand)continue;
   const role=member.gearRole==='auto'?(profile.class==='priest'?'healer':'dps'):member.gearRole;
   const ready=me.role==='merchant'?(p.c.items??[]).filter(i=>{
    if(!i||!e.safe(i)||i.l||i.b||
       !gearCompatible(p.G,profile,i,'mainhand'))return false;
    const rule=e.explicit?.(i,'inventory');
    return !rule||rule.action==='send'&&rule.recipient===member.name;
   }).flatMap(i=>{
     try{const stats=p.call('item_properties',i);
      if(!gearSuitability(null,stats,role,profile.class,member.merchantMobility).ok)return [];
      return [{item:i,score:gearScore(stats,role,profile.class)}];
     }catch{return [];}
    }).filter(row=>Number.isFinite(row.score)&&row.score>0)
    .sort((a,b)=>b.score-a.score||(b.item.level??0)-(a.item.level??0)):[],
    best=ready[0]?.item;
   if(best){
    const existing=result.find(g=>g.character===member.name&&g.slot==='mainhand'&&
     g.item===best.name&&g.level===(best.level??0));
    if(existing){existing.priority=Math.max(existing.priority??0,1000);existing.urgentStarter=true;}
    else result.unshift({name:'Vorratswaffe '+member.name,enabled:true,character:member.name,
     slot:'mainhand',item:best.name,level:best.level??0,
     budget:Math.max(10000,cfg.production.autoGearBudget??100000),
     priority:1000,urgentStarter:true});
    continue;
   }
   result.unshift({name:'Startwaffe '+member.name,enabled:true,character:member.name,
    slot:'mainhand',item:'staff',level:0,budget:Math.max(10000,cfg.production.autoGearBudget??100000),
    priority:1000,urgentStarter:true});
  }
  // Fill ONE vacant slot per online farmer per planning cycle from physically
  // carried, verified stock before speculatively upgrading other members'
  // existing equipment. A successful equip exposes the next vacancy.
  if(cfg.production.gear&&me.role==='merchant')for(const [memberIndex,name] of (bot.farmers??[]).entries()){
   const member=cfg.characters.find(c=>c.enabled&&c.name===name&&c.role==='farmer'),
    peer=bot.transport?.fresh?.(name),profile=profiles[name];
   if(!member||!peer?.running||peer.rip||peer.realm!==p.realm()||
      !profile?.complete||!profile.slots)continue;
   const role=member.gearRole==='auto'?(profile.class==='priest'?'healer':'dps'):member.gearRole;
   const candidates=[];
   for(const [slot,old] of Object.entries(profile.slots)){
    if(old||slot==='mainhand'||!gearSlots.includes(slot))continue;
    for(const i of p.c.items??[]){
     if(!i||!e.safe(i)||i.l||i.b||!gearCompatible(p.G,profile,i,slot))continue;
     const rule=e.explicit?.(i,'inventory');
     if(rule&&!(rule.action==='send'&&rule.recipient===name))continue;
     try{const stats=p.call('item_properties',i),score=gearScore(stats,role,profile.class);
      if(Number.isFinite(score)&&score>0&&
         gearSuitability(null,stats,role,profile.class,member.merchantMobility).ok)
       candidates.push({slot,item:i,score});
     }catch{}
    }
   }
   candidates.sort((a,b)=>gearSlotPriority(b.slot,profile.class)-
    gearSlotPriority(a.slot,profile.class)||b.score-a.score||
    (b.item.level??0)-(a.item.level??0)||a.slot.localeCompare(b.slot));
   const best=candidates[0];
   if(!best)continue;
   const matching=result.find(g=>g.character===name&&g.slot===best.slot&&
    g.item===best.item.name&&g.level===(best.item.level??0));
   for(let k=result.length-1;k>=0;k--)if(result[k].character===name&&
     result[k].slot===best.slot&&result[k]!==matching)result.splice(k,1);
   const priority=975-Math.min(20,memberIndex);
   if(matching){matching.priority=Math.max(matching.priority??0,priority);
    matching.urgentVacancy=true;}
   else result.unshift({name:'Vorratsausrüstung '+name+' '+best.slot,
    enabled:true,character:name,slot:best.slot,item:best.item.name,
    level:best.item.level??0,budget:cfg.production.autoGearBudget??100000,
    priority,urgentVacancy:true});
  }
  if(cfg.production.autoGear)for(const member of cfg.characters.filter(c=>c.enabled)){const profile=member.name===me.name?snapshot():profiles[member.name];if(!profile)continue;for(const [slot,i] of Object.entries(profile.slots)){if(!i||i.l||i.b||!cfg.production.autoGearItems.includes(i.name)||!p.G.items[i.name]?.upgrade||i.level>=autoGearTargetLevel(cfg.production.autoGearMaxLevel,profile.level,slot)||result.some(g=>g.character===member.name&&g.slot===slot))continue;
   result.push({name:'Auto-Gear '+member.name+' '+slot+' +'+(i.level+1),enabled:true,character:member.name,slot,item:i.name,level:i.level+1,budget:cfg.production.autoGearBudget,priority:(member.catchUp?30:10)+gearSlotPriority(slot,profile.class)+fairness({character:member.name,slot})});
  }}return result;
 }
 function goals(){if(!cfg.production.gear)return [];return targets().flatMap(g=>{
  const profile=g.character===me.name?snapshot():profiles[g.character];if(!profile||!gearCompatible(p.G,profile,{name:g.item,level:g.level},g.slot))return [];
  const old=profile.slots[g.slot];if(old?.l||old?.b||old?.name===g.item&&old.level>=g.level)return [];
  const member=cfg.characters.find(c=>c.name===g.character),role=member?.gearRole==='auto'?(profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps'):member?.gearRole;
  try{const nextStats=p.call('item_properties',{name:g.item,level:g.level}),oldStats=old?p.call('item_properties',old):null;
   if(!gearSuitability(oldStats,nextStats,role,profile.class,member?.merchantMobility).ok)return [];
   if(old&&gearScore(nextStats,role,profile.class)<gearScore(oldStats,role,profile.class)*(1+cfg.production.minImprovement))return [];}catch{return [];}
  return [{...g,name:'Gear: '+g.name,quantity:1,recipient:g.character===me.name?'':g.character,gearSlot:g.slot}];
 });}
 function status(){const eligible=new Set(goals().map(g=>g.name));return targets().slice(0,32).map(g=>{const profile=g.character===me.name?snapshot():profiles[g.character],old=profile?.slots?.[g.slot];return {name:g.name,character:g.character,item:g.item,level:g.level,slot:g.slot,offline:g.character!==me.name&&!bot.transport.fresh(g.character),state:!cfg.production.gear?'disabled':!profile?'unknown-profile':!gearCompatible(p.G,profile,{name:g.item,level:g.level},g.slot)?'incompatible':old?.l||old?.b?'protected':old?.name===g.item&&old.level>=g.level?'equipped':eligible.has('Gear: '+g.name)?'requested':'below-improvement-threshold'};});}
 return {equip,snapshot,refresh,suggestions,goals,status,
  observedPerformance:()=>observedGearChanges.map(x=>structuredClone(x)),
  profile:name=>profiles[name]??null};
}
