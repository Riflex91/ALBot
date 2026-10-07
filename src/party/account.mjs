export function selectAccountTeam(members,limit,{boss=false,leader='',current=[]}={}){
 const chosen=[],add=x=>{if(x&&!chosen.includes(x.name)&&chosen.length<limit)chosen.push(x.name);};
 for(const x of members)if(x.name===leader||!x.rotation&&current.includes(x.name))add(x);
 const maxLevel=Math.max(1,...members.map(x=>x.level??0));
 const ranked=members.filter(x=>(x.running||x.level>0&&x.class!=='auto')&&(x.rotation||current.includes(x.name)||x.name===leader)).map((x,index)=>({...x,index,score:(x.running?5:0)+(x.catchUp?3+10*(maxLevel-(x.level??0))/maxLevel:0)+(x.level??0)/100+(x.class==='ranger'?2:1)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 if(boss){add(ranked.find(x=>x.class==='priest'));add(ranked.find(x=>['warrior','paladin'].includes(x.class)));}
 for(const x of ranked)add(x);return chosen;
}
export function createAccount(bot){
 const {p,cfg,me,exec}=bot,coordinator=cfg.party.merchant||cfg.party.leader||bot.leader;
 const storageKey='albot:account:'+me.name;let changed=Date.now(),transition=null,sequence=0,blocked=false;
 const validNames=cfg.characters.filter(c=>c.enabled&&c.role==='farmer').map(c=>c.name);
 const saved=p.read(storageKey);if(saved){if(validNames.includes(saved.out)&&validNames.includes(saved.in)&&Array.isArray(saved.original)&&saved.original.every(n=>validNames.includes(n))&&saved.original.includes(saved.originalLeader))transition={...saved,recovering:true};else{blocked=true;bot.report('Charakterwechsel-Checkpoint ungültig; Rotation gesperrt');}}
 const save=next=>{if(!p.write(storageKey,next)){blocked=true;bot.report('Charakterwechsel konnte nicht gespeichert werden; Rotation gesperrt');return false;}transition=next;return true;};
 function heartbeat(){return {names:[...bot.farmers],leader:bot.leader,seq:sequence};}
 function apply(names,leader){if(!Array.isArray(names)||!names.length||names.length>cfg.party.maxFarmers||new Set(names).size!==names.length||names.some(n=>!validNames.includes(n))||!names.includes(leader))return false;
  bot.farmers=[...names];bot.leader=leader;bot.target=null;return true;
 }
 function safe(name){const h=name===me.name?{running:bot.running,rip:p.c.rip,journal:!!bot.journal||!!bot.bank?.pending,pending:exec.pending.size,inventoryBlocked:bot.inventoryBlocked,threats:bot.monsters().filter(m=>m.target===me.name).length}:bot.transport.fresh(name);return h?.running&&!h.rip&&!h.journal&&!h.pending&&!h.inventoryBlocked&&!h.threats;}
 function receive(from,data){if(cfg.party.selection!=='adaptive'||from!==coordinator||!Number.isSafeInteger(data?.seq)||data.seq<sequence)return;const changedTeam=JSON.stringify(data.names)!==JSON.stringify(bot.farmers)||data.leader!==bot.leader;if(apply(data.names,data.leader)){sequence=data.seq;if(changedTeam){bot.movement.stop();bot.event('account.team',{names:data.names.join(','),leader:data.leader});}}}
 function tick(){
  if(cfg.party.selection!=='adaptive'||blocked)return;
  if(me.name!==coordinator){const d=bot.transport.fresh(coordinator);if(d?.team)receive(coordinator,d.team);return;}
  if(transition){
   if(Date.now()>transition.until&&!transition.recovering){transition.recovering=true;bot.report('Charakterwechsel nicht bestätigt; ursprüngliche Gruppe wiederherstellen');}
   let active;try{active=p.call('get_active_characters');}catch{return;}
   if(!active||typeof active!=='object')return;
   if(transition.recovering){
    if(active[transition.in]){exec.run('account.rollback.stop',['lifecycle'],()=>safe(me.name),()=>p.call('stop_character',transition.in),{delay:60000});return;}
    const original=bot.transport.fresh(transition.out);
    if(original?.running&&original.realm===p.realm()&&!original.rip){const next=transition;if(save(null)){apply(next.original,next.originalLeader);changed=Date.now();}return;}
    exec.run('account.rollback.start',['lifecycle'],()=>safe(me.name),()=>p.call('start_character',transition.out),{delay:60000,timeout:55000});return;
   }
   if(active[transition.out])return;
   const peer=bot.transport.fresh(transition.in);if(peer?.running&&peer.realm===p.realm()&&!peer.rip){const next=transition;if(save(null)){apply(next.names,next.leader);sequence++;changed=Date.now();bot.event('account.team',{names:bot.farmers.join(','),leader:bot.leader});}return;}
   if(!transition.started&&safe(me.name)&&p.has('start_character')){transition.started=exec.run('account.start',['lifecycle'],()=>bot.running,()=>p.call('start_character',transition.in),{timeout:55000,delay:60000});}return;
  }
  if(Date.now()-changed<cfg.party.rotationCooldownMs||!bot.farmers.every(safe)||!safe(me.name))return;
  const members=cfg.characters.filter(c=>c.enabled&&c.role==='farmer').map(c=>{const h=bot.transport.fresh(c.name),g=bot.gear?.profile(c.name);return {...c,class:c.class==='auto'?h?.class??g?.class??'auto':c.class,level:h?.level??g?.level??0,running:!!h?.running};});
  const target=selectAccountTeam(members,cfg.party.maxFarmers,{boss:['boss','event'].includes(bot.strategy.task()),leader:cfg.party.leader,current:bot.farmers});
  if(JSON.stringify(target)===JSON.stringify(bot.farmers))return;
  const out=bot.farmers.find(n=>!target.includes(n)),into=target.find(n=>!bot.farmers.includes(n));
  if(!out||!into||out===me.name||!p.has('stop_character')||!p.has('start_character')||!p.has('get_active_characters'))return;
  if(!save({out,in:into,original:[...bot.farmers],originalLeader:bot.leader,names:bot.farmers.filter(n=>n!==out).concat(into),leader:cfg.party.leader||bot.farmers.filter(n=>n!==out).concat(into)[0],until:Date.now()+120000,started:false}))return;
  if(!exec.run('account.stop',['lifecycle'],()=>bot.running&&safe(out),()=>p.call('stop_character',out),{delay:60000})){save(null);return;}
  bot.event('account.rotation',{out,into});
 }
 return {tick,heartbeat,receive,active:()=>me.role==='merchant'||bot.farmers.includes(me.name),status:()=>({coordinator,names:[...bot.farmers],blocked,transition:transition?{out:transition.out,in:transition.in,recovering:!!transition.recovering}:null}),close(){if(transition)transition.recovering=true;}};
}
