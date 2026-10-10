export function selectAccountTeam(members,limit,{boss=false,leader='',current=[],synergy=false,damageType='physical'}={}){
 const chosen=[],add=x=>{if(x&&!chosen.includes(x.name)&&chosen.length<limit)chosen.push(x.name);};
 for(const x of members)if(x.name===leader||!x.rotation&&current.includes(x.name))add(x);
 const maxLevel=Math.max(1,...members.map(x=>x.level??0));
 const ranked=members.filter(x=>(x.running||x.level>0&&x.class!=='auto')&&(x.rotation||current.includes(x.name)||x.name===leader)).map((x,index)=>({...x,index,score:(x.running?5:0)+(x.catchUp?3+10*(maxLevel-(x.level??0))/maxLevel:0)+(x.level??0)/100+(x.class==='ranger'?2:1)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 if(boss){add(ranked.find(x=>x.class==='priest'));add(ranked.find(x=>['warrior','paladin'].includes(x.class)));}
 if(synergy){while(chosen.length<limit){const classes=chosen.map(name=>members.find(x=>x.name===name)?.class),candidates=ranked.filter(x=>!chosen.includes(x.name)).map(x=>{
   const s=x.stats??{},damage=Math.max(0,(s.attack??0)*(s.frequency??1)),defense=damageType==='magical'?s.resistance:s.armor;
   const survivability=Math.log1p(Math.max(0,s.max_hp??0))/2+Math.log1p(Math.max(0,defense??0))/3;
   const utility=(x.class==='priest'&&!classes.includes('priest')?boss?12:4:0)+(x.class==='mage'&&!classes.includes('mage')&&classes.some(c=>['priest','paladin','warrior'].includes(c))?3:0)+(['warrior','paladin'].includes(x.class)&&!classes.some(c=>['warrior','paladin'].includes(c))?boss?8:1:0);
   return {...x,teamScore:x.score+Math.log1p(damage)+survivability+utility-(x.rip?100:0)};
  }).sort((a,b)=>b.teamScore-a.teamScore||a.index-b.index);if(!candidates.length)break;add(candidates[0]);}
 }else for(const x of ranked)add(x);return chosen;
}
export function chooseCombatLeader(members){return members.filter(x=>x.running&&!x.rip&&x.hp>0&&x.stats?.attack>0).map(x=>({...x,leaderScore:(['warrior','paladin'].includes(x.class)?5:0)+Math.log1p(x.stats.attack*(x.stats.frequency??1))+Math.log1p(x.stats.armor??0)/2+(x.hp/Math.max(1,x.max_hp))*3})).sort((a,b)=>b.leaderScore-a.leaderScore||a.name.localeCompare(b.name))[0]?.name??null;}
// Wealth snapshots contain monetary balances only; inventories and transferred
// gold are never added as estimates. Missing/future/stale peers fail conservative.
export function accountRiskSnapshot(balances,bankGold,lossBudget,previous='conservative'){
 const observed=Array.isArray(balances)?balances.filter(x=>Number.isSafeInteger(x)&&x>=0):[];
 const complete=observed.length>0&&observed.length===balances?.length&&Number.isSafeInteger(bankGold)&&bankGold>=0;
 const liquidFloor=observed.reduce((n,x)=>n+x,0)+(Number.isSafeInteger(bankGold)&&bankGold>=0?bankGold:0);
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
 const {p,cfg,me,exec}=bot,coordinator=cfg.party.merchant||cfg.party.leader||bot.leader;
 const storageKey='albot:account:'+me.name;let changed=Date.now(),transition=null,sequence=0,blocked=false,riskMode='conservative';
 const validNames=cfg.characters.filter(c=>c.enabled&&c.role==='farmer').map(c=>c.name);
 const saved=p.read(storageKey);if(saved){if(validNames.includes(saved.out)&&validNames.includes(saved.in)&&Array.isArray(saved.original)&&saved.original.every(n=>validNames.includes(n))&&saved.original.includes(saved.originalLeader))transition={...saved,recovering:true};else{blocked=true;bot.report('Charakterwechsel-Checkpoint ungültig; Rotation gesperrt');}}
 const save=next=>{if(!p.write(storageKey,next)){blocked=true;bot.report('Charakterwechsel konnte nicht gespeichert werden; Rotation gesperrt');return false;}transition=next;return true;};
 function risk(){
  const peers=cfg.characters.filter(c=>c.enabled&&c.group===me.group),names=new Set();
  const balances=[];let bankGold=null,complete=true;
  for(const member of peers){
   if(names.has(member.name))continue;names.add(member.name);
   const local=member.name===me.name,h=local?null:bot.transport.fresh(member.name);
   if(!local&&(!h?.running||h.realm!==p.realm())){complete=false;continue;}
   const gold=local?p.c.gold:h.goldBalance;
   if(!Number.isSafeInteger(gold)||gold<0){complete=false;continue;}balances.push(gold);
   if(member.name===cfg.party.merchant){
    const stored=local?p.c.bank?.gold:h.bankGoldBalance;
    if(!Number.isSafeInteger(stored)||stored<0)complete=false;
    else bankGold=stored;
   }
  }
  const snap=accountRiskSnapshot(complete?balances:[...balances,null],bankGold,cfg.production.lossBudget,riskMode);
  riskMode=snap.mode;return snap;
 }
 function spendAllowed(cost,loss=0){
  if(cost===0&&loss===0)return true;
  if(!Number.isFinite(cost)||cost<0||!Number.isFinite(loss)||loss<0)return false;
  const snap=risk();return cost+loss<=snap.riskLimit;
 }
 function heartbeat(){return {names:[...bot.farmers],leader:bot.leader,seq:sequence};}
 function apply(names,leader){if(!Array.isArray(names)||!names.length||names.length>cfg.party.maxFarmers||new Set(names).size!==names.length||names.some(n=>!validNames.includes(n))||!names.includes(leader))return false;
  bot.farmers=[...names];bot.leader=leader;bot.target=null;return true;
 }
 function safe(name){const h=name===me.name?{running:bot.running,rip:p.c.rip,journal:!!bot.journal||!!bot.bank?.pending,pending:exec.pending.size,inventoryBlocked:bot.inventoryBlocked,reserved:!!bot.logistics.reserved,threats:bot.monsters().filter(m=>m.target===me.name).length}:bot.transport.fresh(name);return h?.running&&!h.rip&&!h.journal&&!h.pending&&!h.reserved&&!h.inventoryBlocked&&!h.threats;}
 function receive(from,data){if((cfg.party.selection!=='adaptive'&&cfg.party.leader)||cfg.party.selection!=='adaptive'&&JSON.stringify(data?.names)!==JSON.stringify(bot.farmers)||from!==coordinator||!Number.isSafeInteger(data?.seq)||data.seq<sequence)return;const changedTeam=JSON.stringify(data.names)!==JSON.stringify(bot.farmers)||data.leader!==bot.leader;if(apply(data.names,data.leader)){sequence=data.seq;if(changedTeam){bot.movement.stop();bot.event('account.team',{names:data.names.join(','),leader:data.leader});}}}
 function tick(){
  if(blocked)return;
  if(cfg.party.selection!=='adaptive'){if(cfg.party.leader)return;if(me.name!==coordinator){const h=bot.transport.fresh(coordinator);if(h?.team)receive(coordinator,h.team);return;}const current=bot.farmers.map(name=>name===me.name?{name,running:bot.running,rip:p.c.rip,class:p.c.ctype,hp:p.c.hp,max_hp:p.c.max_hp,stats:{attack:p.c.attack,frequency:p.c.frequency,armor:p.c.armor}}:{name,...bot.transport.fresh(name)});const leader=chooseCombatLeader(current.filter(h=>!h.journal&&!h.reserved&&!h.threats));if(leader&&leader!==bot.leader&&apply(bot.farmers,leader)){sequence++;bot.movement.stop();bot.event('account.leader',{leader,reason:'Bekannte lebende Fähigkeiten; feste Farmerliste bleibt erhalten'});}return;}

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
  const members=cfg.characters.filter(c=>c.enabled&&c.role==='farmer').map(c=>{const h=bot.transport.fresh(c.name),g=bot.gear?.profile(c.name);return {...c,class:c.class==='auto'?h?.class??g?.class??'auto':c.class,level:h?.level??g?.level??0,running:!!h?.running,rip:!!h?.rip,hp:h?.hp,max_hp:h?.max_hp,stats:h?.gear?.stats??g?.stats};});
  const leaderActivity=bot.transport.fresh(bot.leader)?.activity;const task=me.role==='merchant'?leaderActivity?.kind:bot.strategy.task();
  const target=selectAccountTeam(members,cfg.party.maxFarmers,{boss:['boss','event'].includes(task),leader:cfg.party.leader,current:bot.farmers,synergy:!!cfg.party.gearSynergy,damageType:p.G.monsters[leaderActivity?.target??bot.target?.mtype]?.damage_type});
  bot.accountChoice={names:target,reason:cfg.party.gearSynergy?'Klassenbedarf, effektive Gear-/Kampfwerte, Catch-up und feste Teammitglieder':'Klassenbedarf, Level und feste Teammitglieder'};
  const elected=cfg.party.leader||chooseCombatLeader(members.filter(x=>target.includes(x.name)))||bot.leader;
  if(JSON.stringify(target)===JSON.stringify(bot.farmers)){if(elected!==bot.leader&&apply(target,elected)){sequence++;bot.event('account.leader',{leader:elected,reason:'Bekannte aktuelle Fähigkeiten, Schutz und Kampfstärke'});}return;}
  const out=bot.farmers.find(n=>!target.includes(n)),into=target.find(n=>!bot.farmers.includes(n));
  if(!out||!into||out===me.name||!p.has('stop_character')||!p.has('start_character')||!p.has('get_active_characters'))return;
  if(!save({out,in:into,original:[...bot.farmers],originalLeader:bot.leader,names:bot.farmers.filter(n=>n!==out).concat(into),leader:elected,until:Date.now()+120000,started:false}))return;
  if(!exec.run('account.stop',['lifecycle'],()=>bot.running&&safe(out),()=>p.call('stop_character',out),{delay:60000})){save(null);return;}
  bot.event('account.rotation',{out,into});
 }
 return {tick,heartbeat,risk,spendAllowed,receive,active:()=>me.role==='merchant'||bot.farmers.includes(me.name),status:()=>({coordinator,names:[...bot.farmers],choice:bot.accountChoice??null,progression:bot.progression?.status()??null,blocked,transition:transition?{out:transition.out,in:transition.in,recovering:!!transition.recovering}:null}),close(){if(transition)transition.recovering=true;}};
}
