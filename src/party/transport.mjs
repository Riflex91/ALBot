import {validMessage,xy} from '../core/policy.mjs';
export function createTransport(bot){
  const {p,cfg,me}=bot,peers=new Map(),seen=new Map(),retired=new Map();let seq=0;const offs=[];
  const roster=cfg.characters.filter(x=>x.enabled&&x.group===me.group).map(x=>x.name);
  function receive(from,m){
    try{
      if(!validMessage(m,from,me.name,roster,Date.now())||m.group!==me.group)return;
      const old=seen.get(from);if(old&&old.session===m.session&&m.seq<=old.seq)return;
      if(old&&old.session!==m.session){const past=retired.get(from)??[];if(past.includes(m.session)||m.time<old.time)return;past.push(old.session);retired.set(from,past.slice(-8));}
      seen.set(from,{session:m.session,seq:m.seq,time:m.time});
      if(m.type==='status'){
        const d=m.data;if(!d||typeof d.map!=='string'||!Number.isFinite(d.x)||!Number.isFinite(d.y)||typeof d.realm!=='string'||!Array.isArray(d.items)||d.items.length>25)return;
        peers.set(from,{...d,received:Date.now(),session:m.session});
      }else if(bot.running)bot.logistics?.receive(from,m);
    }catch(e){bot.report('Nachricht verworfen: '+e.message);}
  }
  if(p.ipc)offs.push(p.h.onMessage(e=>{if(e.topic==='albot/1')receive(e.from,e.data);}));
  offs.push(p.hook('on_cm',(from,data)=>{if(data?.protocol!=='albot/1')return;if(cfg.general.transport!=='ipc'&&(!p.headless||cfg.general.allowRemoteCM||cfg.general.transport==='cm'))receive(from,data);return true;}));
  function send(to,type,data,id=''){
    if(!roster.includes(to)||to===me.name)return Promise.resolve(false);
    const m={protocol:'albot/1',from:me.name,to,group:me.group,session:bot.session,seq:++seq,time:Date.now(),ttl:cfg.general.messageTtlMs,type,id,data};
    if(JSON.stringify(m).length>=5000)return Promise.resolve(false);
    const mode=cfg.general.transport;
    let result;
    try{
      if(mode!=='cm'&&p.ipc&&(parentSiblings().includes(to)||mode==='ipc'))result=p.h.send(to,'albot/1',m);
      else if(mode==='ipc'||(p.headless&&!cfg.general.allowRemoteCM&&mode!=='cm'))return Promise.resolve(false);
      else result=p.call('send_cm',to,m);
    }catch(e){bot.report('Teamtransport: '+(e.message??e));return Promise.resolve(false);}
    return Promise.resolve(result).then(()=>true,e=>{bot.report('Teamtransport: '+(e.message??e));return false;});
  }
  function parentSiblings(){try{return p.parent.caracAL?.siblings??[];}catch{return [];}}
  return {peers,send,roster,fresh(name){const d=peers.get(name);return d&&Date.now()-d.received<cfg.general.messageTtlMs?d:null;},
    heartbeat(){const c=p.c;if(!c)return;const items=bot.logistics?.summary()??[];const d={...xy(c),map:c.map,in:c.in??c.map,realm:p.realm(),rip:!!c.rip,hp:c.hp,max_hp:c.max_hp,mp:c.mp,max_mp:c.max_mp,target:bot.target?.id??null,free:bot.free(),running:bot.running,items,materials:bot.production?.materials()??[],gear:bot.gear?.snapshot()};for(const n of roster)send(n,'status',d);},
    close(){offs.splice(0).forEach(f=>f());peers.clear();seen.clear();retired.clear();}
  };
}
