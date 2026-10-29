// A single missed transport heartbeat must not unselect an otherwise healthy
// already-active Farmer. Explicit stop and realm split remove availability;
// a value-action lock MUST NOT remove an otherwise fighting Farmer from the
// combat roster. Unseen peers get a short grace only.
// A heartbeat on another game server is not an available combat member.
// Missing peer evidence remains unknown for controlled browser rotation,
// but explicitly observed cross-realm players cannot enter a live farm team.
export function foreignRunningFarmer(member,realm){
 return member?.running===true&&member.realm!==realm;
}
export function selectedFarmerAvailable(member,{selected=false,lastSeen=0,now=Date.now(),realm}={}){
 // An already selected, recently alive teammate should not vanish from
 // the roster during the ordinary 15s respawn. Otherwise the coordinator
 // briefly selects only the Priest and both Rangers watch instead of farm.
 if(member?.rip===true&&member.running===true&&member.realm===realm&&
    selected&&Number.isFinite(lastSeen)&&
    lastSeen>0&&Number.isFinite(now)&&now>=lastSeen&&now-lastSeen<=45000)
  return true;
 if(member&&(!member.running||member.rip||member.realm!==realm))return false;
 if(member?.running&&member.realm===realm)return true;
 return selected&&Number.isFinite(lastSeen)&&lastSeen>0&&
  Number.isFinite(now)&&now>=lastSeen&&now-lastSeen<=20000;
}
export function selectAccountTeam(members,limit,{boss=false,leader='',current=[],synergy=false,damageType='physical',preferredClasses=[]}={}){
 const chosen=[],add=x=>{if(x&&!chosen.includes(x.name)&&chosen.length<limit)chosen.push(x.name);};
 for(const x of members)if(x.name===leader||!x.rotation&&current.includes(x.name))add(x);
 const maxLevel=Math.max(1,...members.map(x=>x.level??0));
 const ranked=members.filter(x=>(x.running||x.level>0&&x.class!=='auto')&&(x.rotation||current.includes(x.name)||x.name===leader)).map((x,index)=>({...x,index,score:(x.running?5:0)+(x.catchUp?3+10*(maxLevel-(x.level??0))/maxLevel:0)+(x.level??0)/100+(x.class==='ranger'?2:1)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 if(boss){
  for(const c of preferredClasses)add(ranked.find(x=>!chosen.includes(x.name)&&(x.class===c||c==='warrior'&&x.class==='paladin')));
  add(ranked.find(x=>x.class==='priest'));add(ranked.find(x=>['warrior','paladin'].includes(x.class)));
 }
 if(synergy){while(chosen.length<limit){const classes=chosen.map(name=>members.find(x=>x.name===name)?.class),candidates=ranked.filter(x=>!chosen.includes(x.name)).map(x=>{
   const s=x.stats??{},damage=Math.max(0,(s.attack??0)*(s.frequency??1)),defense=damageType==='magical'?s.resistance:s.armor;
   const survivability=Math.log1p(Math.max(0,s.max_hp??0))/2+Math.log1p(Math.max(0,defense??0))/3;
   const utility=(x.class==='priest'&&!classes.includes('priest')?boss?12:4:0)+(x.class==='mage'&&!classes.includes('mage')&&classes.some(c=>['priest','paladin','warrior'].includes(c))?3:0)+(['warrior','paladin'].includes(x.class)&&!classes.some(c=>['warrior','paladin'].includes(c))?boss?8:1:0);
   return {...x,teamScore:x.score+Math.log1p(damage)+survivability+utility-(x.rip?100:0)};
  }).sort((a,b)=>b.teamScore-a.teamScore||a.index-b.index);if(!candidates.length)break;add(candidates[0]);}
 }else for(const x of ranked)add(x);return chosen;
}
// Level evidence must be current or from the account's own character list.
// Gear is handled separately by the gear planner; unequal class DPS is not
// a reliable substitute for level progression (healers/tanks versus rangers).
export function selectCatchUpSwap(members,current,{levelGap=2,protectedNames=[]}={}){
 if(!Array.isArray(members)||!Array.isArray(current)||!Number.isSafeInteger(levelGap)||levelGap<1)return null;
 const fixed=new Set(protectedNames);
 const eligible=members.filter(x=>x?.rotation===true&&typeof x.name==='string'&&
   Number.isSafeInteger(x.level)&&x.level>0&&x.class&&x.class!=='auto');
 const progress=x=>Number.isFinite(x.xp)&&Number.isFinite(x.maxXp)&&x.maxXp>0?
   Math.min(1,Math.max(0,x.xp/x.maxXp)):0;
 const incoming=eligible.filter(x=>!current.includes(x.name)&&!x.running)
   .sort((a,b)=>a.level-b.level||progress(a)-progress(b)||a.name.localeCompare(b.name))[0];
 const outgoing=eligible.filter(x=>current.includes(x.name)&&x.running&&!fixed.has(x.name))
   .sort((a,b)=>b.level-a.level||progress(b)-progress(a)||a.name.localeCompare(b.name))[0];
 if(!incoming||!outgoing||outgoing.level-incoming.level<levelGap)return null;
 return {out:outgoing.name,in:incoming.name,fromLevel:outgoing.level,toLevel:incoming.level,
  gap:outgoing.level-incoming.level};
}
export function chooseCombatLeader(members){return members.filter(x=>x.running&&!x.rip&&x.hp>0&&x.stats?.attack>0).map(x=>({...x,leaderScore:(['warrior','paladin'].includes(x.class)?5:0)+Math.log1p(x.stats.attack*(x.stats.frequency??1))+Math.log1p(x.stats.armor??0)/2+(x.hp/Math.max(1,x.max_hp))*3})).sort((a,b)=>b.leaderScore-a.leaderScore||a.name.localeCompare(b.name))[0]?.name??null;}
// Keep a currently healthy, selected farming leader stable. Re-ranking by
// short-lived health/armor/damage observations every account tick otherwise
// discards shared farm plans and sends followers across the map. A boss/event
// may deliberately elect its best available combat leader instead.
export function electStableCombatLeader(members,target,current,{
 explicit='',bossOrEvent=false
}={}){
 const selected=new Set(target??[]);
 if(explicit&&selected.has(explicit))return explicit;
 const active=(members??[]).filter(m=>selected.has(m.name)&&m.running&&!m.rip&&
  Number.isFinite(m.hp)&&m.hp>0);
 if(!bossOrEvent&&active.some(m=>m.name===current))return current;
 return chooseCombatLeader(active)??(active[0]?.name??null);
}
// Wealth snapshots contain monetary balances only; inventories and transferred
// gold are never added as estimates. Missing/future/stale peers fail conservative.
export function accountRiskSnapshot(balances,bankGold,lossBudget,previous='conservative'){
 const observed=Array.isArray(balances)?balances.filter(x=>Number.isSafeInteger(x)&&x>=0):[];
 const bankValid=Number.isSafeInteger(bankGold)&&bankGold>=0;
 // JS numbers cannot represent arbitrary account totals exactly. Never promote
 // overflowed balances to a "complete" wealthy account with spending authority.
 let liquidFloor=0,overflow=false;
 for(const amount of observed){if(!Number.isSafeInteger(liquidFloor+amount)){overflow=true;break;}liquidFloor+=amount;}
 if(!overflow&&bankValid){if(Number.isSafeInteger(liquidFloor+bankGold))liquidFloor+=bankGold;else overflow=true;}
 if(overflow)liquidFloor=0;
 const complete=!overflow&&observed.length>0&&observed.length===balances?.length&&bankValid;
 const wealth=complete?liquidFloor:null;
 const bound=Number.isFinite(lossBudget)&&lossBudget>=0?lossBudget:0;
 const normal=complete&&wealth>=(previous==='normal'?bound*7:bound*10);
 const mode=normal?'normal':'conservative';
 // Unknown balances are not guessed. The known liquid lower bound still permits
 // tightly capped autonomous work instead of deadlocking away from the bank.
 const riskLimit=Math.min(bound,Math.floor(liquidFloor*(normal?.03:.01)));
 return {mode,wealth,liquidFloor,complete,riskLimit,reason:complete?'account-liquid-gold':'account-wealth-partial'};
}
export function createAccount(bot){
 const {p,cfg,me,exec}=bot;let coordinator=cfg.party.merchant||cfg.party.leader||bot.leader;
 const storageKey='albot:account:'+me.name;let changed=Date.now(),transition=null,sequence=0,blocked=false,riskMode='conservative',rotationPrepare=null,lastAcceptedTeam=null;const lastOnline=new Map();
 const validNames=cfg.characters.filter(c=>c.enabled&&c.role==='farmer').map(c=>c.name);
 const clockKey=storageKey+':training-clock',clockRoster=JSON.stringify([...validNames].sort());
 const clock=p.read(clockKey);let clockBlocked=false;
 if(cfg.party.balanceFarmers===true&&cfg.party.selection==='adaptive'&&clock?.version===1&&clock.realm===p.realm()&&clock.roster===clockRoster&&
    Number.isSafeInteger(clock.since)&&clock.since>0&&clock.since<=Date.now()){changed=clock.since;if(Array.isArray(clock.names)&&(!cfg.party.leader||clock.names.includes(cfg.party.leader)))apply(clock.names,cfg.party.leader||clock.leader);}
 function markChanged(){changed=Date.now();return persistClock();}
 function persistClock(){if(cfg.party.balanceFarmers!==true)return true;clockBlocked=typeof p.write!=='function'||p.write(clockKey,{version:1,realm:p.realm(),roster:clockRoster,since:changed,names:[...bot.farmers],leader:bot.leader})!==true;return !clockBlocked;}
 persistClock();
 const saved=p.read(storageKey);if(saved){if(validNames.includes(saved.out)&&validNames.includes(saved.in)&&Array.isArray(saved.original)&&saved.original.every(n=>validNames.includes(n))&&saved.original.includes(saved.originalLeader))transition={...saved,recovering:true};else{blocked=true;bot.report('Charakterwechsel-Checkpoint ungültig; Rotation gesperrt');}}
 if(transition&&p.headless===false&&!transition.browser)transition={...transition,browser:true,legacyRunner:true};
 const save=next=>{if(!p.write(storageKey,next)){blocked=true;bot.report('Charakterwechsel konnte nicht gespeichert werden; Rotation gesperrt');return false;}transition=next;return true;};
 function risk({production=false}={}){
  if(production){
   const owner=me.role==='merchant'&&me.name===cfg.party.merchant;
   const holdMs=2*Math.max(15000,cfg.general?.messageTtlMs??15000);
   const transfer=bot.gold?.reserved||bot.journal||bot.inventoryBlocked||bot.bank?.pending||Number.isFinite(bot.gold?.transferAt)&&Date.now()-bot.gold.transferAt<holdMs;
   const evidence=!transfer&&owner?bot.bank?.goldEvidence?.():null;
   const balance=owner&&!transfer?p.c.gold:null;
   const snap=accountRiskSnapshot([balance],evidence?.gold??null,cfg.production.lossBudget,riskMode);
   return {...snap,memberCount:1,sessionRiskLimit:owner?snap.riskLimit:0,scope:'designated-merchant-production',bankEvidence:evidence??null};
  }
  const peers=cfg.characters.filter(c=>c.enabled&&c.group===me.group),names=new Set();
  const balances=[];let bankGold=null,complete=true;
  for(const member of peers){
   if(names.has(member.name))continue;names.add(member.name);
   const local=member.name===me.name,h=local?null:bot.transport.fresh(member.name);
   if(!local&&(!h?.running||h.realm!==p.realm()||h.journal||h.reserved||h.inventoryBlocked)){complete=false;continue;}
   // Gold transfers are asynchronous: a new receiver balance can overlap a stale
   // sender heartbeat. Temporarily exclude both sides rather than double-count.
   const transferAt=local?bot.gold?.transferAt:h.goldTransferAt;
   const pendingTransfer=local?bot.gold?.reserved:h.goldTransferPending;
   const holdMs=2*Math.max(15000,cfg.general?.messageTtlMs??15000);
   if(pendingTransfer||(Number.isFinite(transferAt)&&transferAt>0&&Date.now()-transferAt<holdMs)){complete=false;continue;}
   const gold=local?p.c.gold:h.goldBalance;
   if(!Number.isSafeInteger(gold)||gold<0){complete=false;continue;}balances.push(gold);
   if(member.name===cfg.party.merchant){
    const stored=local?p.c.bank?.gold:h.bankGoldBalance;
    if(!Number.isSafeInteger(stored)||stored<0)complete=false;
    else bankGold=stored;
   }
  }
  const snap=accountRiskSnapshot(complete?balances:[...balances,null],bankGold,cfg.production.lossBudget,riskMode);
  // Transport messages and local storage do not provide atomic account-wide
  // reservations. Allocate each configured team member a deterministic share
  // instead of letting every character independently exhaust the same cap.
  const memberCount=Math.max(1,names.size);
  const sessionRiskLimit=Math.floor(snap.riskLimit/memberCount);
  riskMode=snap.mode;return {...snap,memberCount,sessionRiskLimit};
 }
 function spendAllowed(cost,loss=0,options={}){
  if(cost===0&&loss===0)return true;
  if(!Number.isSafeInteger(cost)||cost<0||!Number.isSafeInteger(loss)||loss<0||!Number.isSafeInteger(cost+loss))return false;
  const snap=risk(options);return cost+loss<=snap.sessionRiskLimit;
 }
 function heartbeat(){return {names:[...bot.farmers],leader:bot.leader,seq:sequence,rotationPrepare,rotationSince:changed};}
 function apply(names,leader){if(!Array.isArray(names)||!names.length||names.length>cfg.party.maxFarmers||new Set(names).size!==names.length||names.some(n=>!validNames.includes(n))||!names.includes(leader))return false;
  bot.farmers=[...names];bot.leader=leader;bot.target=null;return true;
 }
 function safe(name){const h=name===me.name?{running:bot.running,rip:p.c.rip,journal:!!bot.journal||!!bot.bank?.pending,pending:exec.pending.size,inventoryBlocked:bot.inventoryBlocked,reserved:!!bot.logistics.reserved,threats:bot.monsters().filter(m=>m.target===me.name).length}:bot.transport.fresh(name);return h?.running&&!h.rip&&!h.journal&&!h.pending&&!h.reserved&&!h.inventoryBlocked&&!h.threats;}
 const handoverKey='albot:account:'+me.name+':incoming';
 let handover=p.read(handoverKey);let lastRotation=p.read(storageKey+':receipt')??null;let rejectedAt=0;
 if(handover?.in===me.name&&handover.coordinator===coordinator&&handover.realm===p.realm()&&handover.until>Date.now()&&handover.until<=Date.now()+120000&&Number.isSafeInteger(handover.seq)&&apply(handover.names,handover.leader)){sequence=handover.seq;}
 function rejectSwap(from,m,reason){
  if(Date.now()-rejectedAt>3000){rejectedAt=Date.now();bot.event('account.swap-rejected',{id:m.id,reason,peer:from});}
  if(from===coordinator)bot.transport.send(from,'accountReject',{reason,out:me.name},m.id);
 }
 function receiveMessage(from,m){
  if(m.type==='accountTeam'){
   // The game/IPC transport already validates configured sender identity,
   // group, envelope TTL, sequence and source. If a full status is oversized
   // the coordinator may NEVER have a fresh status heartbeat; accept the
   // compact election without it. But reject any *present* contradictory
   // session, realm or stopped-status evidence.
   const h=bot.transport.fresh(from),d=m.data;
   if(cfg.party.selection==='adaptive'&&from===coordinator&&
      from!==me.name&&(!h||h.running&&!h.rip&&
       h.session===m.session&&h.realm===p.realm())&&
      d?.realm===p.realm()&&
      d.team&&Number.isSafeInteger(d.team.seq)&&
      d.team.seq>=sequence){
      const before=lastAcceptedTeam;
      receive(from,d.team);
      if(lastAcceptedTeam!==before)lastAcceptedTeam={
       ...lastAcceptedTeam,session:m.session,transport:'accountTeam'};
   }
   return;
  }
  if(m.type==='accountReject'){
   if(me.name===coordinator&&transition?.browser&&from===transition.out&&m.id===transition.id){
    bot.event('account.swap-rejected',{id:m.id,peer:from,reason:String(m.data?.reason??'receiver-rejected').slice(0,100)});
    if(['outgoing-session-changed','capability-unavailable','target-already-online','code-slot-missing','owned-character-api-missing','code-persistence-api-missing','running-code-save-unavailable','window-route-unsupported','window-route-invalid','headless-host','window-navigation-missing','checkpoint-write-failed'].includes(m.data?.reason)){if(save(null))markChanged();}
   }return;
  }
  if(m.type==='accountSwap'){
   const h=bot.transport.fresh(from),d=m.data;
   if(from!==coordinator||!h?.running||h.session!==m.session||h.realm!==p.realm()){rejectSwap(from,m,'coordinator-session-invalid');return;}
   if(d?.protocolVersion===2&&d.outSession!==bot.session){rejectSwap(from,m,'outgoing-session-changed');return;}
   if(!Number.isFinite(d?.until)||d.until<=Date.now()||d.until>Date.now()+120000){rejectSwap(from,m,'request-expired-or-invalid');return;}
   if(d.realm!==p.realm()){rejectSwap(from,m,'request-realm-mismatch');return;}
   if(bot.lifecycleChanging){rejectSwap(from,m,'switch-already-pending');return;}
   if(!safe(me.name)||bot.gold?.reserved){rejectSwap(from,m,'outgoing-busy');return;}
   const capability=p.characterSwitchCapability?.(d?.in);
   if(capability?.supported===false){rejectSwap(from,m,capability.reason);return;}
  }
  if(m.type==='accountAck'){
   if(me.name===coordinator&&transition?.browser&&from===transition.out&&m.id===transition.id&&m.session===transition.outSession&&m.data?.in===transition.in)save({...transition,acked:true});
   return;
  }
  const d=m.data,h=bot.transport.fresh(from);
  if(m.type!=='accountSwap'||cfg.party.selection!=='adaptive'||from!==coordinator||!h?.running||h.session!==m.session||h.realm!==p.realm()||
     d?.out!==me.name||d.in===me.name||!validNames.includes(d.in)||
     !Array.isArray(d.original)||!d.original.includes(me.name)||d.original.includes(d.in)||
     ![JSON.stringify(d.original),JSON.stringify(d.names)].includes(JSON.stringify(bot.farmers))||
     !Array.isArray(d.names)||JSON.stringify(d.names)!==JSON.stringify(d.original.filter(n=>n!==me.name).concat(d.in))||
     !d.names.includes(d.leader)||!Number.isSafeInteger(d.seq)||d.seq<sequence||d.realm!==p.realm()||
     !Number.isFinite(d.until)||d.until<=Date.now()||d.until>Date.now()+120000||bot.lifecycleChanging||
     !safe(me.name)||bot.gold?.reserved||!p.canSwitchCharacter?.(d.in)){if(m.type==='accountSwap')rejectSwap(from,m,'request-or-capability-invalid');return;}
  const checkpoint={...d,coordinator:from,id:m.id};
  if(!p.write('albot:account:'+d.in+':incoming',checkpoint)){rejectSwap(from,m,'checkpoint-write-failed');return;}
  bot.lifecycleChanging=true;bot.movement.stop();
  const accepted=exec.run('account.switch-window',['lifecycle'],()=>bot.running&&!bot.journal&&!bot.inventoryBlocked&&!bot.logistics.reserved&&!bot.gold?.reserved,
   async()=>{
    if(await bot.transport.send(from,'accountAck',{in:d.in},m.id)!==true)throw Error('Fensterwechsel-Zusage nicht zugestellt');
    if(!bot.running||bot.journal||bot.inventoryBlocked||bot.logistics.reserved||bot.gold?.reserved||bot.monsters().some(x=>x.target===me.name)||Date.now()>=d.until)throw Error('Fensterwechsel nicht mehr sicher');
    return p.switchCharacter(d.in,()=>bot.lifecycleChanging&&bot.running&&!bot.journal&&!bot.inventoryBlocked&&!bot.logistics.reserved&&!bot.gold?.reserved&&!bot.monsters().some(x=>x.target===me.name)&&Date.now()<d.until);
   },{timeout:55000,delay:60000,onSettle(result){if(result!=='returned'){bot.lifecycleChanging=false;if(p.read('albot:account:'+d.in+':incoming')?.id===m.id)p.write('albot:account:'+d.in+':incoming',null);bot.report('Fensterwechsel fehlgeschlagen; ursprünglicher Farmer bleibt aktiv');}}});
  if(!accepted){bot.lifecycleChanging=false;p.write('albot:account:'+d.in+':incoming',null);}
 }
 function receive(from,data){if(Array.isArray(data?.names)&&data.names.some(n=>foreignRunningFarmer(bot.transport.fresh(n),p.realm())))return;if(handover?.in===me.name&&Date.now()<handover.until&&JSON.stringify(data?.names)!==JSON.stringify(handover.names))return;if((cfg.party.selection!=='adaptive'&&cfg.party.leader)||cfg.party.selection!=='adaptive'&&JSON.stringify(data?.names)!==JSON.stringify(bot.farmers)||from!==coordinator||!Number.isSafeInteger(data?.seq)||data.seq<sequence)return;const changedTeam=JSON.stringify(data.names)!==JSON.stringify(bot.farmers)||data.leader!==bot.leader;if(apply(data.names,data.leader)){sequence=data.seq;lastAcceptedTeam={from,session:bot.transport.fresh(from)?.session??null,at:Date.now(),seq:sequence,leader:bot.leader,names:[...bot.farmers]};if(Number.isSafeInteger(data.rotationSince)&&data.rotationSince>changed&&data.rotationSince<=Date.now()){changed=data.rotationSince;persistClock();}if(handover?.in===me.name&&JSON.stringify(data.names)===JSON.stringify(handover.names)){p.write(handoverKey,null);handover={...handover,committed:true};}if(changedTeam){bot.movement.stop();bot.event('account.team',{names:data.names.join(','),leader:data.leader});}}}
 function tick(){
  if(clockBlocked)persistClock();
  if(cfg.general.autoRoster){
   const online=cfg.characters.filter(c=>c.enabled&&(c.name===me.name?bot.running:bot.transport.fresh(c.name)?.running&&bot.transport.fresh(c.name)?.realm===p.realm())).map(c=>c.name).sort();
   const next=online.includes(cfg.party.merchant)?cfg.party.merchant:online[0]??me.name;
   if(next!==coordinator&&!handover){coordinator=next;sequence=0;}
  }
  if(me.name===coordinator&&lastRotation?.in&&lastRotation.realm===p.realm()){
   const h=bot.transport.fresh(lastRotation.in),leader=bot.transport.fresh(bot.leader);
   if(h?.running&&h.realm===p.realm()&&leader?.running&&leader.realm===p.realm()){
    if(!lastRotation.joined&&h.party&&h.party===leader.party){lastRotation.joined=true;bot.event('account.party-joined',{id:lastRotation.id,in:lastRotation.in,party:h.party});p.write(storageKey+':receipt',lastRotation);}
    if(lastRotation.joined&&!lastRotation.arrived&&h.map===leader.map&&(h.in??h.map)===(leader.in??leader.map)&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&Math.hypot(h.x-leader.x,h.y-leader.y)<=cfg.party.followDistance){lastRotation.arrived=true;bot.event('account.group-arrived',{id:lastRotation.id,in:lastRotation.in,map:h.map});p.write(storageKey+':receipt',lastRotation);}
   }
  }
  if(blocked)return;
  if(cfg.party.selection!=='adaptive'){if(cfg.party.leader)return;if(me.name!==coordinator){const h=bot.transport.fresh(coordinator);if(h?.team)receive(coordinator,h.team);return;}const current=bot.farmers.map(name=>name===me.name?{name,running:bot.running,rip:p.c.rip,class:p.c.ctype,hp:p.c.hp,max_hp:p.c.max_hp,stats:{attack:p.c.attack,frequency:p.c.frequency,armor:p.c.armor}}:{name,...bot.transport.fresh(name)});const leader=chooseCombatLeader(current.filter(h=>!h.journal&&!h.reserved&&!h.threats));if(leader&&leader!==bot.leader&&apply(bot.farmers,leader)){sequence++;bot.movement.stop();bot.event('account.leader',{leader,reason:'Bekannte lebende Fähigkeiten; feste Farmerliste bleibt erhalten'});}return;}

  if(me.name!==coordinator){const d=bot.transport.fresh(coordinator);if(d?.team)receive(coordinator,d.team);return;}
  if(transition){
   if(Date.now()>transition.until&&!transition.recovering){transition.recovering=true;bot.report('Charakterwechsel nicht bestätigt; ursprüngliche Gruppe wiederherstellen');}
   if(transition.browser){
    const peer=bot.transport.fresh(transition.in),original=bot.transport.fresh(transition.out);
    if(original?.running&&original.session!==transition.outSession&&transition.protocolVersion===2&&!transition.acked){bot.event('account.swap-cancelled',{id:transition.id,reason:'outgoing-session-changed'});if(save(null))markChanged();return;}
    if(transition.acked&&peer?.running&&peer.realm===p.realm()&&!peer.rip&&(transition.protocolVersion!==2||peer.incomingRotation?.id===transition.id&&!original?.running)){const next=transition;const receipt={id:next.id,in:next.in,out:next.out,realm:p.realm(),at:Date.now(),joined:false,arrived:false};
     if(p.write(storageKey+':receipt',receipt)&&save(null)){lastRotation=receipt;apply(next.names,next.leader);sequence++;markChanged();bot.event('account.team',{names:bot.farmers.join(','),leader:bot.leader,reason:'Farmer im bisherigen Fenster online bestätigt'});}return;}
    if(transition.recovering){
     if(transition.legacyRunner){let active;try{active=p.call('get_active_characters');}catch{}
      if(active?.[transition.in]){exec.run('account.rollback.stop',['lifecycle'],()=>safe(me.name),()=>p.call('stop_character',transition.in),{delay:60000});return;}}
     // Never create a replacement iframe on the Merchant when a farmer tab
     // failed to reconnect. Keep the checkpoint for explicit recovery.
     if(original?.running&&original.realm===p.realm()&&!original.rip){const next=transition;if(save(null)){apply(next.original,next.originalLeader);sequence++;markChanged();}}
     return;
    }
    if(!transition.acked&&Date.now()-(transition.sentAt??0)>3000){transition.sentAt=Date.now();bot.transport.send(transition.out,'accountSwap',{...transition,seq:sequence+1,realm:p.realm()},transition.id);}return;
   }
   let active;try{active=p.call('get_active_characters');}catch{return;}
   if(!active||typeof active!=='object')return;
   if(transition.recovering){
    if(active[transition.in]){exec.run('account.rollback.stop',['lifecycle'],()=>safe(me.name),()=>p.call('stop_character',transition.in),{delay:60000});return;}
    const original=bot.transport.fresh(transition.out);
    if(original?.running&&original.realm===p.realm()&&!original.rip){const next=transition;if(save(null)){apply(next.original,next.originalLeader);markChanged();}return;}
    exec.run('account.rollback.start',['lifecycle'],()=>safe(me.name),()=>p.call('start_character',transition.out),{delay:60000,timeout:55000});return;
   }
   if(active[transition.out])return;
   const peer=bot.transport.fresh(transition.in);if(peer?.running&&peer.realm===p.realm()&&!peer.rip){const next=transition;if(save(null)){apply(next.names,next.leader);sequence++;markChanged();bot.event('account.team',{names:bot.farmers.join(','),leader:bot.leader});}return;}
   if(!transition.started&&safe(me.name)&&p.has('start_character')){transition.started=exec.run('account.start',['lifecycle'],()=>bot.running,()=>p.call('start_character',transition.in),{timeout:55000,delay:60000});}return;
  }
  // Fix the adaptive-roster deadlock: a missing selected farmer must not
  // prevent choosing another already running teammate. This does not call
  // start_character/stop_character and does not alter any value operation.
  const online=validNames.filter(name=>{
   const h=cfg.general.autoRoster&&name===me.name?{...p.c,running:bot.running,realm:p.realm(),inventoryBlocked:bot.inventoryBlocked}:bot.transport.fresh(name);
   const seen=h?.running&&!h.rip&&h.realm===p.realm();
   if(seen)lastOnline.set(name,Date.now());
   return selectedFarmerAvailable(h,{selected:bot.farmers.includes(name),
    lastSeen:lastOnline.get(name)??0,realm:p.realm()});
  }),available=new Set(online);
  if((bot.farmers.some(n=>!available.has(n))||!available.has(bot.leader)||bot.farmers.length<Math.min(cfg.party.maxFarmers,online.length))&&online.length&&Date.now()-changed>=(online.length>=cfg.party.maxFarmers?3000:Math.min(15000,cfg.party.rotationCooldownMs))){
   const preferred=available.has(cfg.party.leader)?cfg.party.leader:available.has(bot.leader)?bot.leader:null;
   const leader=preferred??chooseCombatLeader(online.map(name=>({name,...bot.transport.fresh(name)})))??online[0];
   const names=[leader,...bot.farmers.filter(n=>n!==leader&&available.has(n)),...online.filter(n=>n!==leader&&!bot.farmers.includes(n))].slice(0,cfg.party.maxFarmers);
   if(names.length&&(names.join(',')!==bot.farmers.join(',')||leader!==bot.leader)&&apply(names,leader)){
    sequence++;markChanged();bot.event('account.team',{names:names.join(','),leader,reason:'Offline gewählten Farmer durch bereits aktiven Peer ersetzen'});
   }
   return;
  }
  if(Date.now()-changed<cfg.party.rotationCooldownMs)return;
  // get_characters() can supply offline levels; do not infer a zero-level
  // character or use a stale heartbeat as evidence for account rotation.
  const roster=new Map((bot.transport?.ownCharacters?.()??[]).map(c=>[c.name,c]));
  const members=cfg.characters.filter(c=>c.enabled&&c.role==='farmer').map(c=>{
   const h=bot.transport.fresh(c.name),own=roster.get(c.name),g=bot.gear?.profile(c.name);
   const local=c.name===me.name?{...p.c,level:p.c.level,running:bot.running,class:p.c.ctype}:null;
   const seen=local??h;
   return {...c,rotation:c.rotation&&!(p.headless===false&&seen?.browserSwitch?.supported===false),switchReason:seen?.browserSwitch?.reason??null,class:c.class==='auto'?seen?.class??own?.class??g?.class??'auto':c.class,
    level:seen?.level??own?.level??g?.level??0,xp:own?.xp??null,maxXp:own?.maxXp??null,
    running:!!seen?.running,rip:!!seen?.rip,hp:seen?.hp,max_hp:seen?.max_hp,
    stats:seen?.gear?.stats??seen?.stats??g?.stats};
  });
  const leaderActivity=bot.transport.fresh(bot.leader)?.activity;const task=me.role==='merchant'?leaderActivity?.kind:bot.strategy.task();
  const bossObjective=bot.bosses?.objective();
  const training=cfg.party.balanceFarmers===true;
  // Ordinary material farming is still leveling. Team-plan generations
  // reallocate quotas after the confirmed roster change; only quest travel
  // and boss/event ownership postpone catch-up, never select class alternates.
  const catchUpSafe=training&&!['quest','boss','event'].includes(task)&&!bot.bosses?.status?.()?.active;
  const due=!clockBlocked&&Date.now()-changed>=Math.max(cfg.party.rotationCooldownMs,cfg.party.balanceHoldMs??1800000);
  const candidate=training?selectCatchUpSwap(members,bot.farmers,{
   levelGap:cfg.party.balanceLevelGap??2,protectedNames:[cfg.party.leader,me.name,
    ...bot.farmers.filter(name=>bot.transport.fresh(name)?.party===name)].filter(Boolean)
  }):null;
  const swap=catchUpSafe&&due?candidate:null;
  // During ordinary farming the existing group stays stable until an eligible
  // underleveled *offline* farmer is demonstrably behind an active one.
  // Boss/event tasks still select by combat suitability and class synergy.
  const target=training?(swap?bot.farmers.filter(n=>n!==swap.out).concat(swap.in):[...bot.farmers]):
   selectAccountTeam(members.filter(m=>!foreignRunningFarmer(bot.transport.fresh(m.name),p.realm())),cfg.party.maxFarmers,{boss:!!bossObjective||['boss','event'].includes(task),
    preferredClasses:bossObjective?.recommended??[],leader:cfg.party.leader,current:bot.farmers,
    synergy:!!cfg.party.gearSynergy,
    damageType:p.G?.monsters?.[bossObjective?.id??leaderActivity?.target??bot.target?.mtype]?.damage_type});
  bot.accountChoice={names:target,reason:training?'Levelausgleich aus belegten Charakterleveln (kein Wechsel ohne Rückstand und Mindesthaltezeit)':
   cfg.party.gearSynergy?'Klassenbedarf, effektive Gear-/Kampfwerte und feste Teammitglieder':'Klassenbedarf, Level und feste Teammitglieder',
   catchUp:swap??null,eligibleCatchUp:candidate??null,phase:clockBlocked?'clock-storage-unavailable':!due?'hold-time':!catchUpSafe?'activity-postpones-rotation':swap?'ready-to-drain':'no-eligible-level-gap',candidates:members.map(m=>({name:m.name,level:m.level||null,running:m.running,rotation:m.rotation,reason:!m.rotation?m.switchReason??'rotation-disabled':m.name===me.name?'coordinator-protected':bot.transport.fresh(m.name)?.party===m.name?'party-owner-protected':m.name===cfg.party.leader?'configured-leader-protected':!m.level?'level-unknown':m.running?'active':'offline-candidate'})),nextEligibleAt:training?changed+Math.max(cfg.party.rotationCooldownMs,cfg.party.balanceHoldMs??1800000):null};
  rotationPrepare=swap?{out:swap.out,into:swap.in,until:Date.now()+30000}:null;
  if(!bot.farmers.every(safe)){if(swap)bot.accountChoice.phase='draining';bot.accountChoice.waiting='selected-farmers-draining-combat-or-value-work';return;}
  const elected=electStableCombatLeader(members,target,bot.leader,{
   explicit:cfg.party.leader,
   bossOrEvent:!!bossObjective||['boss','event'].includes(task)
  })||target[0]||bot.leader;
  if(JSON.stringify(target)===JSON.stringify(bot.farmers)){if(elected!==bot.leader&&apply(target,elected)){sequence++;bot.event('account.leader',{leader:elected,reason:'Bekannte aktuelle Fähigkeiten, Schutz und Kampfstärke'});}return;}
  const out=bot.farmers.find(n=>!target.includes(n)),into=target.find(n=>!bot.farmers.includes(n));
  if(out&&into&&out!==me.name&&p.headless===false){
   const outPeer=bot.transport.fresh(out);if(!outPeer?.session)return;
   const next={browser:true,protocolVersion:2,id:bot.session+':rotation:'+Date.now(),out,in:into,outSession:outPeer.session,original:[...bot.farmers],originalLeader:bot.leader,names:bot.farmers.filter(n=>n!==out).concat(into),leader:elected,until:Date.now()+120000,started:false,sentAt:0,acked:false};
   if(save(next)){bot.event('account.rotation',{out,into,mode:'same-browser-window'});bot.transport.send(out,'accountSwap',{...next,seq:sequence+1,realm:p.realm()},next.id);next.sentAt=Date.now();}return;
  }
  if(!out||!into||out===me.name||!p.has('stop_character')||!p.has('start_character')||!p.has('get_active_characters'))return;
  if(!save({out,in:into,original:[...bot.farmers],originalLeader:bot.leader,names:bot.farmers.filter(n=>n!==out).concat(into),leader:elected,until:Date.now()+120000,started:false}))return;
  if(!exec.run('account.stop',['lifecycle'],()=>bot.running&&safe(out),()=>p.call('stop_character',out),{delay:60000})){save(null);return;}
  bot.event('account.rotation',{out,into});
 }
 return {rotationPending:()=>{const request=me.name===coordinator?rotationPrepare:bot.transport.fresh(coordinator)?.team?.rotationPrepare;return !!(request&&request.until>Date.now()&&request.until<=Date.now()+30000&&bot.farmers.includes(request.out));},tick,heartbeat,risk,spendAllowed,receive,receiveMessage,incomingRotation:()=>handover?.in===me.name?{id:handover.id,out:handover.out}:null,active:()=>!(handover&&!handover.committed&&Date.now()<handover.until)&&!bot.lifecycleChanging&&(me.role==='merchant'||bot.farmers.includes(me.name)),status:()=>({coordinator,names:[...bot.farmers],lastAcceptedTeam,choice:bot.accountChoice??null,progression:bot.progression?.status()??null,blocked,lastRotation,transition:transition?{out:transition.out,in:transition.in,mode:transition.browser?'same-browser-window':'host-runner',acked:!!transition.acked,recovering:!!transition.recovering}:null}),close(){if(transition)transition.recovering=true;bot.lifecycleChanging=false;}};
}
