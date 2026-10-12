import {validMessage,xy} from '../core/policy.mjs';
// A status heartbeat combines independent modules. Preserve the identity,
// location, balance, journal and item-demand fields needed for safe handoffs;
// shed optional telemetry before the transport's strict 5 KB message limit.
export function fitHeartbeat(data,maxLength=4200){
 const d={...data,items:[...(data.items??[])],materials:[...(data.materials??[])]};
 const length=()=>JSON.stringify(d).length;
 if(length()<=maxLength)return d;
 for(const key of ['performance','stock','capabilities','gearOrders','gear','farmPlan','roles','activity','materialProgress','bankOwner','skills','mluck','elixir','supplies']){
  delete d[key];if(length()<=maxLength)return d;
 }
 // Keep active team identity if possible, but delivery demand takes precedence.
 while(d.materials.length>1&&length()>maxLength)d.materials.pop();
 while(d.items.length>0&&length()>maxLength)d.items.pop();
 if(length()>maxLength)d.materials=[];
 if(length()>maxLength)delete d.team;
 return length()<=maxLength?d:null;
}
export function createTransport(bot){
  const {p,cfg,me}=bot,peers=new Map(),seen=new Map(),retired=new Map();let seq=0;const offs=[];
  const roster=cfg.characters.filter(x=>x.enabled&&x.group===me.group).map(x=>x.name);
  const counters={heartbeatAttempts:0,heartbeatSent:0,heartbeatReceived:0,sendFailed:0,rejected:0,duplicates:0};
  const peerCounters=new Map(roster.filter(n=>n!==me.name).map(n=>[n,{sent:0,received:0,failed:0}]));
  let lastFailure=null;
  function failure(to,type,reason){
    counters.sendFailed++;const peer=peerCounters.get(to);if(peer)peer.failed++;
    lastFailure={to,type,reason,at:Date.now()};return false;
  }
  function success(to,type){
    if(type==='status'){counters.heartbeatSent++;const peer=peerCounters.get(to);if(peer)peer.sent++;}
    return true;
  }
  function status(){
    const at=Date.now(),ttlMs=cfg.general.messageTtlMs;
    return {name:me.name,group:me.group,session:bot.session,mode:cfg.general.transport,ipc:!!p.ipc,ttlMs,
      counters:{...counters},lastFailure:lastFailure?{...lastFailure}:null,
      peers:roster.filter(n=>n!==me.name).map(name=>{
        const d=peers.get(name),counts=peerCounters.get(name),ageMs=d?Math.max(0,at-d.received):null;
        return {name,seen:!!d,fresh:ageMs!==null&&ageMs<ttlMs,ageMs,
          receivedAt:d?.received??null,session:d?.session??null,realm:d?.realm??null,
          running:d?.running??null,heartbeatSent:counts.sent,heartbeatReceived:counts.received,sendFailed:counts.failed};
      })};
  }
  function receive(from,m){
    try{
      if(!validMessage(m,from,me.name,roster,Date.now())||m.group!==me.group){counters.rejected++;return;}
      const old=seen.get(from);if(old&&old.session===m.session&&m.seq<=old.seq){counters.duplicates++;return;}
      if(old&&old.session!==m.session){const past=retired.get(from)??[];if(past.includes(m.session)||m.time<old.time){counters.rejected++;return;}past.push(old.session);retired.set(from,past.slice(-8));}
      seen.set(from,{session:m.session,seq:m.seq,time:m.time});
      if(m.type==='status'){
        const d=m.data;if(!d||typeof d.map!=='string'||!Number.isFinite(d.x)||!Number.isFinite(d.y)||typeof d.realm!=='string'||!Array.isArray(d.items)||d.items.length>25){counters.rejected++;return;}
        peers.set(from,{...d,received:Date.now(),session:m.session});counters.heartbeatReceived++;const peer=peerCounters.get(from);if(peer)peer.received++;
      }else if(bot.running){if(m.type.startsWith('hop')||m.type.startsWith('port'))bot.teamTravel?.receive(from,m);else if(m.type.startsWith('gold'))bot.gold?.receive(from,m);else bot.logistics?.receive(from,m);}
    }catch(e){counters.rejected++;bot.report('Nachricht verworfen: '+e.message);}
  }
  if(p.ipc)offs.push(p.h.onMessage(e=>{if(e.topic==='albot/1')receive(e.from,e.data);}));
  offs.push(p.hook('on_cm',(from,data)=>{if(data?.protocol!=='albot/1')return;if(cfg.general.transport!=='ipc'&&(!p.headless||cfg.general.allowRemoteCM||cfg.general.transport==='cm'))receive(from,data);return true;}));
  function send(to,type,data,id=''){
    if(to===me.name)return Promise.resolve(false);
    if(!roster.includes(to))return Promise.resolve(failure(to,type,'recipient'));
    const m={protocol:'albot/1',from:me.name,to,group:me.group,session:bot.session,seq:++seq,time:Date.now(),ttl:cfg.general.messageTtlMs,type,id,data};
    if(type==='status')counters.heartbeatAttempts++;
    if(JSON.stringify(m).length>=5000)return Promise.resolve(failure(to,type,'size'));
    const mode=cfg.general.transport;
    let result;
    try{
      if(mode!=='cm'&&p.ipc&&(parentSiblings().includes(to)||mode==='ipc'))result=p.h.send(to,'albot/1',m);
      else if(mode==='ipc'||(p.headless&&!cfg.general.allowRemoteCM&&mode!=='cm'))return Promise.resolve(failure(to,type,'channel'));
      else result=p.call('send_cm',to,m);
    }catch(e){bot.report('Teamtransport: '+(e.message??e));return Promise.resolve(failure(to,type,'exception'));}
    return Promise.resolve(result).then(value=>value!==false&&value?.success!==false?success(to,type):failure(to,type,'rejected'),e=>{bot.report('Teamtransport: '+(e.message??e));return failure(to,type,'exception');});
  }
  function parentSiblings(){try{return p.parent.caracAL?.siblings??[];}catch{return [];}}
  return {peers,send,roster,status,fresh(name){const d=peers.get(name);return d&&Date.now()-d.received<cfg.general.messageTtlMs?d:null;},
    heartbeat(){const c=p.c;if(!c)return;const items=bot.logistics?.summary()??[];const d={name:me.name,...xy(c),map:c.map,in:c.in??c.map,realm:p.realm(),party:c.party??null,rip:!!c.rip,hp:c.hp,max_hp:c.max_hp,mp:c.mp,max_mp:c.max_mp,class:c.ctype,level:c.level,stats:{attack:c.attack,frequency:c.frequency,armor:c.armor,resistance:c.resistance,range:c.range},goldBalance:Number.isSafeInteger(c.gold)&&c.gold>=0?c.gold:null,bankGoldBalance:me.name===cfg.party.merchant&&Number.isSafeInteger(c.bank?.gold)&&c.bank.gold>=0?c.bank.gold:null,goldSurplus:bot.gold?.surplus()??0,goldTransferPending:!!bot.gold?.reserved,goldTransferAt:bot.gold?.transferAt??0,target:bot.target?.id??null,free:bot.free(),running:bot.running,reserved:!!bot.logistics?.reserved,journal:!!bot.journal||!!bot.bank?.pending,inventoryBlocked:!!bot.inventoryBlocked,threats:bot.monsters().filter(m=>m.target===me.name).length,pending:bot.exec.pending.size,lootSlots:bot.logistics?.pickupSlots?.()??0,
      potions:Object.fromEntries(['hpot0','mpot0'].map(id=>[id,
        (c.items??[]).reduce((n,i)=>n+(i?.name===id?(i.q??1):0),0)])),
      items,materials:bot.production?.materials()??[],gear:bot.gear?.snapshot(),gearOrders:bot.gear?.goals().filter(g=>g.sourceOwner&&g.sourceOwner!==me.name).slice(0,5).map(g=>({item:g.item,level:g.sourceLevel??g.level,targetLevel:g.level,variant:g.variant,gearSlot:g.gearSlot,recipient:g.recipient,character:g.character,sourceOwner:g.sourceOwner})),activity:bot.strategy?.heartbeat(),questVisit:!!bot.strategy?.busy,team:bot.account?.heartbeat(),performance:bot.observations?.heartbeat(),farmPlan:bot.teamPlan?.heartbeat(),materialAck:bot.teamPlan?.materialAck?.(),roles:bot.teamPlan?.roles(),elixir:bot.elixirs?.request(),supplies:bot.supplies?.request(),materialProgress:bot.production?.progress?.(),bankOwner:bot.recovery?.heartbeat(),stock:(c.items??[]).filter(i=>i&&!i.l&&!i.b&&bot.p.G.items[i.name]&&['weapon','helmet','chest','pants','shoes','ring','earring','amulet','belt','cape','gloves'].includes(bot.p.G.items[i.name].type)).slice(0,16).map(i=>({name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??''})),capabilities:bot.capabilities?.snapshot(),motion:{moving:!!c.moving,speed:c.speed??0,at:Date.now()},mluck:c.s?.mluck??null,skills:['heal','partyheal','revive','taunt','reflection','energize','rspeed','cleansing_light'].filter(id=>{const s=p.G.skills?.[id];return s&&(!s.class||s.class.includes?.(c.ctype))&&(s.level??0)<=c.level;})};const bounded=fitHeartbeat(d);if(!bounded){bot.report('Team-Heartbeat zu groß; keine unvollständige Statusmeldung gesendet');return;}for(const n of roster)send(n,'status',bounded);},
    close(){offs.splice(0).forEach(f=>f());peers.clear();seen.clear();retired.clear();}
  };
}
