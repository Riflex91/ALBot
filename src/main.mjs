import {createCombatNavigation} from './combat/navigation.mjs';
import {createEncounter} from './combat/encounter.mjs';
import {createCapabilities} from './party/capabilities.mjs';
import {createContentGuard} from './world/content.mjs';
import {createThreatLedger} from './combat/threats.mjs';
import {createGearAllocation} from './production/allocation.mjs';
import {createRecovery} from './core/recovery.mjs';
import {createTeamPlan} from './world/team-plan.mjs';
import {createElixirs} from './items/elixirs.mjs';
import {createEconomicIntelligence} from './production/intelligence.mjs';
import {createPriorityScheduler} from './core/priority.mjs';
import {createServices} from './merchant/services.mjs';
import {P3P4_DESCRIPTOR} from './config/p3p4.mjs';
import {FULL_DESCRIPTOR} from './config/full.mjs';
import {createGoldLogistics} from './items/gold.mjs';
import {createObservations} from './production/observations.mjs';
import {INTEGRATION_DESCRIPTOR} from './config/live-c.mjs';
import {createStrategy} from './world/strategy.mjs';
import {createBehavior} from './core/behavior.mjs';
import {createAccount} from './party/account.mjs';
import {createTeamTravel} from './party/travel.mjs';
import {createAura} from './party/aura.mjs';
import {ECONOMY_DESCRIPTOR} from './config/live-b.mjs';
import {createEconomy} from './merchant/economy.mjs';
import {createBank} from './merchant/bank.mjs';
import {createMarket} from './merchant/market.mjs';
import {createProduction} from './production/production.mjs';
import {createGear} from './production/gear.mjs';
import {createMerchant} from './merchant/controller.mjs';
import {VERSION} from './version.mjs';
import {DESCRIPTOR} from '../editor/lib/schema.mjs';
import {parseData,validateSchema,validateProfile,addMissingDefaults} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from './config/live-a.mjs';
import {chooseRule,variantCount,protectedItem,distance,samePlace,fingerprint} from './core/policy.mjs';
import {Executor} from './core/executor.mjs';
import {createPorts} from './runtime/ports.mjs';
import {createMovement} from './core/movement.mjs';
import {createTransport} from './party/transport.mjs';
import {createLogistics} from './items/logistics.mjs';
import {createSkills} from './combat/skills.mjs';
import {createFarmer} from './combat/farmer.mjs';
import {createPanel} from './ui/panel.mjs';
import {createTestReport} from './core/test-report.mjs';
import {createCheckpoint} from './core/checkpoint.mjs';
export function install(root){
  root.ALBot?.dispose?.();
  const p=createPorts(root),now=()=>Date.now();
  const report=createTestReport(p,VERSION);report.event('boot');
  const performanceTrick={state:p.headless?'headless-skipped':'pending'};
  if(!p.headless){
    try{
      if(!p.has('performance_trick'))throw Error('Spiel-API performance_trick fehlt');
      if(p.parent.sounds?.empty?.playing?.())performanceTrick.state='already-playing';
      else{p.call('performance_trick');performanceTrick.state='requested';}
      report.event('browser.performance',performanceTrick);
    }catch(e){performanceTrick.state='failed';report.error('performance_trick',e);p.log('performance_trick: '+e.message);}
  }
  const failed=(state,reason)=>{report.error(state,reason);root.ALBot={version:VERSION,status:()=>({state,reason}),testReport:()=>report.text(),exportTestReport:()=>report.flush()};report.flush(true);};
  function validate(value){
    const descriptor=value.general?.testLogging!==undefined?FULL_DESCRIPTOR:value.production?.strategy?P3P4_DESCRIPTOR:value.world?INTEGRATION_DESCRIPTOR:value.production?ECONOMY_DESCRIPTOR:LIVE_DESCRIPTOR;
    const errors=validateProfile(descriptor,value);if(errors.length)return errors;
    const full=addMissingDefaults(DESCRIPTOR.schema,value);
    if(![FULL_DESCRIPTOR,P3P4_DESCRIPTOR].includes(descriptor))errors.push(...validateProfile(DESCRIPTOR,full));
    if(value.party.selection!=='adaptive'&&value.characters.filter(c=>c.enabled&&c.role==='farmer'&&c.group===value.party.group).length>value.party.maxFarmers)errors.push('Mehr aktive Farmer als maxFarmers.');
    if(value.world&&value.characters.filter(c=>c.enabled&&c.role==='farmer').length>20)errors.push('Höchstens 20 Farmer im Account-Roster.');
    if(value.world?.serverHop&&(!value.world.allowedRealms.length||value.world.allowedRealms.some(r=>!/^([A-Z]{2})([A-Za-z0-9]+)$/.test(r))))errors.push('Serverwechsel benötigt gültige erlaubte Realms.');
    if(value.characters.some(c=>c.enabled&&c.group!==value.party.group))errors.push('ALBot benötigt eine gemeinsame Gruppenkennung.');
    if(value.characters.filter(c=>c.enabled&&c.role==='merchant').length>1)errors.push('ALBot verwendet höchstens einen zuständigen Merchant.');
    const merchant=value.characters.find(c=>c.enabled&&c.role==='merchant');if(merchant&&value.merchant.enabled&&value.party.merchant!==merchant.name)errors.push('Zuständigen Merchant unter Gruppe & Skills auswählen.');
    if(value.party.leader&&!value.characters.some(c=>c.enabled&&c.name===value.party.leader&&c.role==='farmer'))errors.push('Leader muss aktiver Farmer sein.');
    if(value.items.some(r=>r.enabled&&r.action==='send'&&(!r.recipient||!value.characters.some(c=>c.enabled&&c.name===r.recipient))))errors.push('Lieferempfänger muss aktiv konfiguriert sein.');
    return errors;
  }
  let cfg;try{cfg=parseData(JSON.stringify(root.ALBotConfig));const errors=validate(cfg);if(errors.length)throw Error(errors.join('; '));}catch(e){p.log('Konfiguration ungültig: '+e.message);failed('invalid',e.message);return;}
  const me=cfg.characters.find(c=>c.name===p.c?.name&&c.enabled);
  if(!me){p.log('Eigenen Namen zuerst in der Werkstatt aktivieren.');failed('unconfigured','Eigenen Namen zuerst aktivieren');return;}
  report.configure?.({continuous:cfg.general.testLogging===true});
  const team=cfg.characters.filter(c=>c.enabled&&c.group===me.group),farmers=team.filter(c=>c.role==='farmer').map(c=>c.name);if(cfg.general.testLogging===undefined)farmers.sort();
  const key='albot:live-a:'+me.name+':checkpoint';let timer=null,generation=0,disposed=false,lastEconomy=0,lastTransfer=0,lastPlanning=0,lastHeartbeat=0,reportText='',reportTime=0,panel;
  const checkpoint=createCheckpoint(p,key,report);let journal=checkpoint.journal;
  if(journal?.kind==='quest.monsterhunt'&&journal.quest==='monsterhunt'&&journal.cost===0&&journal.loss===0&&Array.isArray(journal.slots)&&journal.slots.length===0&&!p.G.skills?.monsterhunt){if(checkpoint.clear(journal)){report.event('checkpoint.repaired',{kind:journal.kind,reason:'Alter ungültiger use_skill(monsterhunt)-Aufruf ohne Inventarwirkung'});journal=null;}}
  const bot={p,cfg,me,session:me.name+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8),running:false,reason:'Bereit',target:null,teamNames:team.map(c=>c.name),farmers,leader:cfg.party.leader||farmers[0]||me.name,journal,inventoryBlocked:!!journal,
    checkpoint,
    event(type,data){report.event(type,data);},
    report(message){if(message!==reportText||now()-reportTime>10000){reportText=message;reportTime=now();p.log(message);report.event('message',{message});}},
    free(){return p.c.items?.filter(i=>!i).length??0;},count(name){return (p.c.items??[]).reduce((n,i)=>n+(i?.name===name?(i.q??1):0),0);},
    entity(id){if(id===me.name)return p.c;const e=p.entities[id]??Object.values(p.entities).find(e=>e.name===id);return e?{...e,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}:null;},
    monsters(){return Object.entries(p.entities).filter(([,e])=>e.type==='monster'&&!e.dead&&!e.rip&&e.hp>0).map(([id,e])=>({...e,id:e.id??id,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}));},
    allies(){return bot.teamNames.map(n=>bot.entity(n)).filter(e=>e&&samePlace(p.c,e));},
    targets(){if(bot.strategy)return bot.strategy.targets();const requested=bot.production?.farmTargets();if(requested)return requested;return me.farmTargets.length?me.farmTargets:cfg.farming.targets;},
    task(){return bot.strategy?.task()??(me.role==='merchant'?'supply':'farm');},
    allowed(e){if(!e||e.type!=='monster'||e.dead||e.rip||e.hp<=0||e.invincible||!samePlace(p.c,e)||!bot.targets().includes(e.mtype)||cfg.world?.excludedMaps.includes(e.map))return false;if(bot.threats?.permitted(e)===false||bot.navigation?.permitted(e)===false)return false;if(bot.strategy?.safeTarget?.(e.mtype,e)===false)return false;if(!e.target&&(e.mtype===bot.teamPlan?.target()&&bot.teamPlan?.wantsCombat()===false||bot.encounter?.permit(e)===false))return false;if(cfg.farming.avoidOthers&&e.target&&!bot.teamNames.includes(e.target))return false;const threats=Object.values(p.entities).filter(x=>x.type==='monster'&&x.hp>0&&bot.teamNames.includes(x.target)).length;return !!e.target||threats<cfg.farming.maxAggro;},
    rule(i){if(bot.economy)return bot.economy.rules(i);return chooseRule(cfg.items,i,{role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:me.role==='merchant'?'supply':'farm'});},
    consumable(i){if(protectedItem(i)||bot.bank?.pending)return false;const r=bot.rule(i);return !r||(r.action==='consume'&&variantCount(p.c.items,i)>r.keep+r.teamReserve);},
    canConsumeImplicit(name){if(bot.inventoryBlocked||bot.logistics?.reserved)return false;const first=p.c.items.find(i=>i?.name===name);return !!first&&bot.consumable(first);},
    beginValue(j){if(bot.journal)throw Error('Andere Inventaraktion offen');const next={...j,at:now(),evidence:{realm:p.realm(),gold:p.c.gold,inventory:(p.c.items??[]).map(i=>i?fingerprint(i):null)}};if(!checkpoint.begin(next)){const e=new Error('Lieferung vor Versand blockiert: Checkpoint-Speicher fehlt');e.code='NOT_DISPATCHED';throw e;}bot.journal=next;report.event('inventory.intent',{kind:j.kind,item:typeof j.item==='string'?j.item:JSON.stringify(j.item),before:j.before,quantity:j.quantity,to:j.to,details:JSON.stringify(j)});},
    endValue(result){if(!bot.journal)return;report.event('inventory.result',{result,kind:bot.journal.kind});if(result==='confirmed'&&(bot.allocation?.settle(bot.journal,result)??true)&&(bot.production?.recordDelivery(bot.journal)??true)&&checkpoint.clear(bot.journal)){bot.journal=null;}else {bot.allocation?.settle(bot.journal,'unknown');bot.inventoryBlocked=true;bot.reason='Inventaraktion ungeklärt: Bestand prüfen';if(cfg.general.pauseOnUnknown&&bot.running)bot.pause(bot.reason);}},
    measure(target=null){const targetHpRatio=target&&Number.isFinite(target.hp)&&Number.isFinite(target.max_hp)&&target.max_hp>0?target.hp/target.max_hp:undefined;return {hpRatio:p.c.hp/p.c.max_hp,targetHpRatio,mpRatio:p.c.mp/p.c.max_mp,freeSlots:bot.free(),gold:p.c.gold,enemyCount:bot.monsters().filter(e=>distance(p.c,e)<p.c.range).length,map:p.c.map,rip:!!p.c.rip,task:bot.task(),count:bot.count};}
  };
  const exec=new Executor({now,active:()=>bot.running,limit:cfg.general.maxPending,onEvent:(type,data)=>report.event(type,{...data,reason:bot.reason,task:bot.task(),target:bot.target?.id??null}),onError:(key,e)=>{report.error(key,e);bot.report(key+': '+(e?.reason??e?.message??e));}});bot.exec=exec;
  bot.movement=createMovement(bot);bot.transport=createTransport(bot);bot.logistics=createLogistics(bot);bot.skills=createSkills(bot);if(cfg.general.testLogging!==undefined)bot.capabilities=createCapabilities(bot);bot.farmer=createFarmer(bot);
  if(cfg.production){bot.economy=createEconomy(bot);bot.bank=createBank(bot);bot.market=createMarket(bot);bot.production=createProduction(bot);bot.gear=createGear(bot);bot.merchant=createMerchant(bot);bot.services=createServices(bot);}
  if(cfg.production?.strategy)bot.observations=createObservations(bot);
  if(cfg.merchant.collectGold!==undefined)bot.gold=createGoldLogistics(bot);
  if(cfg.world){bot.farmers=bot.farmers.includes(bot.leader)?[bot.leader,...bot.farmers.filter(n=>n!==bot.leader)].slice(0,cfg.party.maxFarmers):bot.farmers.slice(0,cfg.party.maxFarmers);if(!bot.farmers.includes(bot.leader)&&bot.farmers.length)bot.leader=bot.farmers[0];bot.strategy=createStrategy(bot);bot.behavior=createBehavior(bot);bot.account=createAccount(bot);bot.teamTravel=createTeamTravel(bot);bot.aura=createAura(bot);}
  if(cfg.general.testLogging!==undefined){bot.teamPlan=createTeamPlan(bot);bot.encounter=createEncounter(bot);bot.navigation=createCombatNavigation(bot);bot.elixirs=createElixirs(bot);bot.intelligence=createEconomicIntelligence(bot);bot.priority=createPriorityScheduler(bot);bot.recovery=createRecovery(bot);bot.threats=createThreatLedger(bot);bot.allocation=createGearAllocation(bot);bot.content=createContentGuard(bot);}
  const cleanup=[];
  const game=root.game??p.parent.game;if(bot.observations&&typeof game?.on==='function'&&typeof game?.remove==='function')for(const [event,handler] of [['hit',d=>{bot.observations.hit(d);bot.threats?.hit(d);}],['death',d=>{bot.observations.death(d);bot.threats?.death(d);}]]){const id=game.on(event,handler);cleanup.push(()=>game.remove(id));}
  if(bot.services&&typeof p.c.on==='function'&&(typeof p.c.remove==='function'||typeof p.c.off==='function')){const events=p.c,handler=data=>bot.services.observeMerrit(data),id=events.on('merrit',handler);cleanup.push(()=>typeof events.remove==='function'?events.remove(id):events.off('merrit',handler));}
  if(typeof root.addEventListener==='function')for(const type of ['error','unhandledrejection']){const handler=e=>{report.error(type,e.error??e.reason??e.message);report.flush(true);};root.addEventListener(type,handler);cleanup.push(()=>root.removeEventListener(type,handler));}
  const inviteAllowed=name=>bot.running&&cfg.party.enabled&&name===bot.leader&&bot.teamNames.includes(name)&&!p.c.party;
  cleanup.push(p.hook('on_party_invite',name=>{if(inviteAllowed(name))exec.run('party',['party'],()=>inviteAllowed(name),()=>p.call('accept_party_invite',name),{delay:3000});}));
  cleanup.push(p.hook('on_party_request',name=>{if(bot.running&&cfg.party.enabled&&me.name===bot.leader&&bot.farmers.includes(name))exec.run('party',['party'],()=>bot.running,()=>p.call('accept_party_request',name),{delay:3000});}));
  if(bot.teamTravel)cleanup.push(p.hook('on_magiport',name=>bot.teamTravel.accept(name)));
  function publish(){try{p.call('set_message',(bot.running?'ALBot ':'PAUSE ')+bot.reason.slice(0,50));}catch{}panel?.render();}
  function halt(reason){bot.running=false;generation++;clearTimeout(timer);timer=null;bot.movement.stop();exec.invalidate();bot.gold?.close();bot.logistics.close();bot.economy?.close();bot.production?.close();bot.market?.close();bot.merchant?.close();bot.services?.interrupt();bot.strategy?.close();bot.teamPlan?.close();bot.encounter?.close();bot.priority?.close();bot.recovery?.close();bot.threats?.close();bot.allocation?.close();bot.content?.close();bot.behavior?.close();bot.account?.close();bot.observations?.close();bot.teamTravel?.close();bot.target=null;bot.reason=reason;publish();bot.report(reason);report.event('stop',{reason});report.flush(true);}
  bot.pause=(reason='Pause')=>halt(reason);
  function tick(gen){if(disposed||!bot.running||gen!==generation)return;try{
    if(!p.c||!p.G){bot.reason='Spielzustand fehlt';return;}
    exec.poll();if(bot.priority)exec.beginFrame();bot.movement.poll();bot.threats?.sample();bot.observations?.sample();
    if(!bot.running)return;
    bot.teamTravel?.tick();if(!bot.running)return;
    if(bot.teamTravel?.blocked)return;
    bot.behavior?.tick();if(!bot.running)return;
    if(now()-lastHeartbeat>=2000){lastHeartbeat=now();bot.transport.heartbeat();}
    const economyDue=now()-lastEconomy>=cfg.general.economyTickMs;if(economyDue)lastEconomy=now();const transferDue=now()-lastTransfer>=(cfg.general.transferIntervalMs??cfg.general.economyTickMs);if(transferDue)lastTransfer=now();bot.gold?.poll(transferDue);bot.logistics.poll(transferDue);
    if(!bot.running)return;
    bot.allocation?.tick();bot.teamPlan?.tick();bot.encounter?.tick();bot.content?.flush();if(economyDue){bot.strategy?.plan();bot.strategy?.sample();}
    if(bot.priority){bot.priority.run([
     {id:'recovery',kind:'emergency',exclusive:true,run:()=>bot.farmer.safety()},
     {id:'elixir',kind:'safety',guard:()=>economyDue&&!bot.recovering,run:()=>bot.elixirs.tick()},
     {id:'world',kind:bot.teamPlan.materialActive()?'background':'normal',priority:20,exclusive:true,guard:()=>economyDue&&me.role==='farmer'&&(bot.account?.active()??true)&&!p.c.rip&&!bot.journal&&!bot.bank?.pending&&!bot.logistics.reserved&&!bot.monsters().some(m=>m.target===me.name),run:()=>bot.strategy.anniversary()||bot.strategy.quest()},
     {id:'combat',kind:'normal',priority:10,run:()=>{bot.farmer.tick();return !!bot.target||bot.recovering;}},
     {id:'merchant',kind:'normal',guard:()=>economyDue&&!bot.recovering&&!bot.strategy.busy,run:()=>{const before=exec.pending.size;bot.merchant.tick();return exec.pending.size>before;}},
     {id:'aura',kind:'safety',run:()=>bot.aura.tick()}
    ]);}else{
    const worldAction=economyDue&&me.role==='farmer'&&(bot.account?.active()??true)&&!p.c.rip&&p.c.hp/p.c.max_hp>=cfg.farming.restBelow&&!bot.journal&&!bot.bank?.pending&&!bot.logistics.reserved&&!bot.monsters().some(m=>m.target===me.name)&&(bot.strategy?.anniversary()||bot.strategy?.quest());
    if(!worldAction)bot.farmer.tick();if(economyDue&&bot.running&&!bot.recovering&&!worldAction&&!bot.strategy?.busy)bot.merchant?.tick();bot.aura?.tick();
    }
    if(now()-lastPlanning>=cfg.general.planningTickMs){lastPlanning=now();bot.gear?.refresh();bot.production?.planGoals();bot.account?.tick();if(!bot.recovering)bot.logistics.travel();if(cfg.party.enabled&&me.name===bot.leader)for(const name of bot.farmers){const e=bot.entity(name);if(name!==me.name&&(!e||e.party!==p.c.party||!p.c.party))exec.run('invite:'+name,['party'],()=>bot.running,()=>p.call('send_party_invite',name),{delay:10000});}}
    publish();
    report.sample({reason:bot.reason,running:bot.running});
  }catch(e){report.error('tick',e);bot.pause('Fehler: '+(e.message??e));bot.report(bot.reason);}finally{try{exec.flush();}catch(e){report.error('dispatch',e);bot.pause('Fehler bei Aktionsauswahl: '+(e.message??e));}if(bot.running&&gen===generation)timer=root.setTimeout(()=>tick(gen),cfg.general.combatTickMs);}}
  const api={version:VERSION,schemaId:cfg.general.testLogging!==undefined?FULL_DESCRIPTOR.schemaId:cfg.production?.strategy?P3P4_DESCRIPTOR.schemaId:cfg.world?INTEGRATION_DESCRIPTOR.schemaId:cfg.production?ECONOMY_DESCRIPTOR.schemaId:LIVE_DESCRIPTOR.schemaId,
    start(){
      if(disposed)return false;if(bot.running)return true;
      const deny=reason=>{bot.reason=reason;publish();bot.report(reason);return false;};
      if(me.class!=='auto'&&me.class!==p.c.ctype)return deny('Konfigurierte Klasse stimmt nicht');
      if(me.region+me.server!==p.realm()&&!(cfg.world?.serverHop&&cfg.world.allowedRealms.includes(p.realm())))return deny('Falscher Realm: erwartet '+me.region+me.server);
      if(cfg.general.transport==='ipc'&&!p.ipc)return deny('Lokale IPC nicht verfügbar');
      bot.recovery?.reconcile();if(bot.inventoryBlocked&&cfg.general.pauseOnUnknown)return deny('Offene Inventaraktion zuerst abgleichen');
      bot.economy?.resume();report.event('start');bot.running=true;bot.reason='Start';generation++;tick(generation);return bot.running;
    },
    pause:()=>halt('Pause'),stop:()=>halt('STOP'),
    requestTask:(task,ttl)=>bot.strategy?.requestTask(task,ttl)??false,
    requestSupply:(item,quantity)=>bot.behavior?.requestSupply(item,quantity)??false,
    requestServerHop:realm=>bot.teamTravel?.requestHop(realm)??false,
    status:()=>({version:VERSION,profile:cfg.general.name,running:bot.running,environment:p.headless?'headless':'browser',ipc:p.ipc,name:me.name,role:me.role,reason:bot.reason,task:bot.task(),target:bot.target?.id??null,pending:exec.pending.size,inventoryBlocked:bot.inventoryBlocked,journal:bot.journal?structuredClone(bot.journal):null}),
    testReport:()=>report.text(),exportTestReport:()=>report.flush(),
    chooseLogDirectory:()=>report.chooseDirectory(),logCapabilities:()=>report.capabilities(),
    acknowledgeInventory(){if(bot.running)throw Error('Zuerst pausieren und tatsächlichen Bestand prüfen');if(!checkpoint.write(null))throw Error('Speichern fehlgeschlagen');bot.journal=null;bot.inventoryBlocked=false;bot.reason='Inventar manuell abgeglichen';publish();},
    dispose(){if(disposed)return;halt('Entladen');disposed=true;bot.transport.close();cleanup.splice(0).forEach(f=>f());panel?.remove();}
  };
  root.ALBot=api;panel=createPanel(bot,api);cleanup.push(p.hook('on_destroy',()=>api.dispose()));
  report.setProvider(()=>({test:cfg.general.testLogging!==undefined?'Vollbetrieb':cfg.production?.strategy?'P3/P4':cfg.world?'Live C':cfg.production?'Live B':'Live A',status:api.status(),performanceTrick:{...performanceTrick},checkpointMode:checkpoint.durable?'persistent':'memory-consumption-only',movement:bot.movement.status(),bankPartial:bot.bank?.status(),logistics:bot.logistics.stats(),goldLogistics:bot.gold?.status(),bankCapacity:bot.bank?.capacity(),production:bot.production?.status(),gear:bot.gear?.suggestions(),gearTargets:bot.gear?.status(),economy:bot.economy?.ledger,market:bot.market?.status(),performance:bot.observations?.heartbeat(),strategy:bot.strategy?.status(),teamPlan:bot.teamPlan?.status(),encounter:bot.encounter?.status(),capabilities:bot.capabilities?.snapshot(),navigation:bot.navigation?.status(),economicIntelligence:bot.intelligence?.status(),priority:bot.priority?.status(),recovery:bot.recovery?.status(),contentQuarantine:bot.content?.status(),threats:bot.threats?.status(),gearAllocation:bot.allocation?.status(),account:bot.account?.status(),travel:bot.teamTravel?.status(),services:bot.services?.status(),merchantTask:bot.merchant?.status(),settings:{general:cfg.general,farming:cfg.farming,party:cfg.party,merchant:cfg.merchant,production:cfg.production,world:cfg.world,rules:cfg.rules,characters:cfg.characters,skills:cfg.skills.slice(0,30),items:cfg.items.slice(0,80),omittedItemRules:Math.max(0,cfg.items.length-80)},equipment:bot.gear?.snapshot(),itemDecisions:cfg.general.testLogging?(p.c.items??[]).flatMap((i,slot)=>i?["inventory","acquisition","production"].map(phase=>{const r=bot.economy?.rules(i,phase);return {slot,item:i.name,level:i.level??0,phase,rule:r?.name??null,action:r?.action??"keep",priority:r?.priority,protected:protectedItem(i),reserved:bot.production?.reservedQuantity(i)??0,remaining:!r||bot.economy.remaining(r),reason:protectedItem(i)?"Geschütztes Item":r?"Spezifität und Priorität; explizite Regel vor abgeleitetem Ziel":"Keine freigegebene Regel: behalten"};}):[]):undefined,inventory:(p.c.items??[]).map((i,slot)=>i?{slot,name:i.name,level:i.level??0,quantity:i.q??1,locked:!!i.l}:null).filter(Boolean)}));
  if(!checkpoint.durable)bot.report('Speicher voll: Verbrauch wird im RAM abgeglichen; Lieferungen bleiben gesperrt. Testlog ohne localStorage.');
  p.log(VERSION+' · '+(p.headless?'Headless':'Browser')+' · '+me.role+' · '+(cfg.general.testLogging!==undefined?'Vollbetrieb':cfg.production?.strategy?'P3/P4':cfg.world?'Live C':cfg.production?'Live B':'Live A')+' Testkandidat');publish();if(cfg.general.autostart)api.start();return api;
}
