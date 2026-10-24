import {createRewardMail} from './items/reward-mail.mjs';
import {createRevivalClaims} from './combat/revival-claims.mjs';
import {createWorldOpportunities} from './world/opportunities.mjs';
import {createRespawnCalendar} from './world/respawn-calendar.mjs';
import {createCaveEvidence} from './world/cave-evidence.mjs';
import {createCaveLifecycle} from './world/cave-lifecycle.mjs';
import {createCryptLifecycle} from './world/crypt-lifecycle.mjs';
import {createCaveVoteEvidence} from './world/cave-vote.mjs';
import {createCaveVoteJournal} from './world/cave-vote-journal.mjs';
import {createCaveConsensus} from './world/cave-consensus.mjs';
import {createCaveTeamCoordination,inCaveInstance} from './world/cave-team-coordination.mjs';
import {caveCumulativeThreatBudget} from './world/cave-cumulative-threat.mjs';
import {createCaveMultiAggroFocus} from './world/cave-multi-aggro-focus.mjs';
import {createCaveCriticalResponse} from './world/cave-critical-response.mjs';
import {createCaveRetreatConsensus} from './world/cave-retreat-consensus.mjs';
import {createCaveRetreatPreparation} from './world/cave-retreat-preparation.mjs';
import {createCaveRetreatWatchdog} from './world/cave-retreat-watchdog.mjs';
import {createCaveDefensiveCombat} from './world/cave-defensive-combat.mjs';
import {createCaveCriticalHealTriage} from './world/cave-critical-heal-triage.mjs';
import {createCavePriestHealing} from './world/cave-priest-healing.mjs';
import {createCavePriestSupport} from './world/cave-priest-support.mjs';
import {createCaveDirectCohesion} from './world/cave-direct-cohesion.mjs';
import {createCaveEmergencyDirect} from './world/cave-emergency-direct.mjs';
import {createLootDeparture,createLootBacklog} from './items/loot-departure.mjs';
import {createOwnLootReceipts} from './items/loot-receipts.mjs';
import {createActionAdmission} from './core/action-admission.mjs';
import {beginCombatLife} from './combat/recovery-policy.mjs';
import {automaticSupplyReceiver,onlineSupplyFarmers,discoverAccountRoster} from './items/potion-supply.mjs';
import {createAdaptive} from './world/adaptive.mjs';
import {createBosses,bossProfile} from './combat/bosses.mjs';
import {createMarketDemand} from './merchant/market-demand.mjs';
import {createCombatNavigation} from './combat/navigation.mjs';
import {createCombatAssessment} from './combat/threat-capability.mjs';
import {createLearning} from './world/learning.mjs';
import {createCloudSync} from './world/cloud.mjs';
import {createSupplies} from './items/supplies.mjs';
import {createConversions} from './production/conversions.mjs';
import {createEncounter} from './combat/encounter.mjs';
import {createCapabilities} from './party/capabilities.mjs';
import {createContentGuard} from './world/content.mjs';
import {createThreatLedger} from './combat/threats.mjs';
import {createGearAllocation} from './production/allocation.mjs';
import {createRecovery} from './core/recovery.mjs';
import {createRuntimeMetrics} from './core/runtime-metrics.mjs';
import {createImpactIntents} from './combat/impact-intents.mjs';
import {createTeamPlan} from './world/team-plan.mjs';
import {createObjectives} from './world/objectives.mjs';
import {createElixirs} from './items/elixirs.mjs';
import {createSkillWakeups} from './core/skill-wakeups.mjs';
import {createAccountStockLedger} from './items/account-stock-ledger.mjs';
import {createPotionReceipts} from './merchant/potion-receipts.mjs';
import {createSeashellCycle} from './production/seashell-cycle.mjs';
import {createEconomicIntelligence} from './production/intelligence.mjs';
import {createLuckySlotEvidence} from './production/lucky-slot-evidence.mjs';
import {physicalInventoryCapacity} from './items/physical-capacity.mjs';
import {createStoragePlanner} from './merchant/storage-plan.mjs';
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
import {createProgression} from './world/progression.mjs';
import {createTeamTravel,nonPvpRealm} from './party/travel.mjs';
import {createAura} from './party/aura.mjs';
import {ECONOMY_DESCRIPTOR} from './config/live-b.mjs';
import {createEconomy} from './merchant/economy.mjs';
import {createBank} from './merchant/bank.mjs';
import {createAccountLossGuard} from './merchant/account-loss.mjs';
import {createMarket} from './merchant/market.mjs';
import {createSingleSwap} from './merchant/single-swap.mjs';
import {createOwnTradeOffer} from './merchant/trade-offer.mjs';
import {createProduction} from './production/production.mjs';
import {createStatTailoring} from './production/stat-tailoring.mjs';
import {createGear} from './production/gear.mjs';
import {createMerchant} from './merchant/controller.mjs';
import {merchantActionDue} from './merchant/action-cadence.mjs';
import {createSupplyForecast} from './merchant/supply-forecast.mjs';
import {VERSION} from './version.mjs';
import {DESCRIPTOR} from '../editor/lib/schema.mjs';
import {defaultsFor,parseData,validateSchema,validateProfile,addMissingDefaults,applyAutonomousMode} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from './config/live-a.mjs';
import {chooseRule,variantCount,protectedItem,distance,samePlace,fingerprint} from './core/policy.mjs';
import {Executor} from './core/executor.mjs';
import {createPorts} from './runtime/ports.mjs';
import {observedCharacterTelemetry,observedBankTelemetry} from './runtime/telemetry-snapshot.mjs';
import {createGameRelaySender,GAME_RELAY_INTERVAL_MS} from './runtime/telemetry-relay-sender.mjs';
import {createConfigSyncPreview} from './runtime/config-sync-preview.mjs';
import {createVerifiedConfigStaging} from './runtime/config-sync-stage.mjs';
import {captureLocalConfigSafePoint,assessConfigActivationPreflight} from './runtime/config-sync-safe-point.mjs';
import {createConfigActivationReviewJournal} from './runtime/config-sync-review-journal.mjs';
import {createConfigRestartIntentGate} from './runtime/config-sync-restart-intent.mjs';
import {createBootResourceScope} from './runtime/boot-resource-scope.mjs';
import {createAutomaticTelemetrySender,AUTO_TELEMETRY_INTERVAL_MS} from './runtime/telemetry-auto-sender.mjs';
import {createMovement} from './core/movement.mjs';
import {createTransport} from './party/transport.mjs';
import {createLogistics} from './items/logistics.mjs';
import {carriedAchievementCarrier} from './items/achievement-utility.mjs';
import {createSkills} from './combat/skills.mjs';
import {createFarmer,farmPlanOrTeamDefense} from './combat/farmer.mjs';
import {createPanel} from './ui/panel.mjs';
import {createTestReport} from './core/test-report.mjs';
import {createOverwriteLogSaver,stableLogName} from './core/overwrite-log.mjs';
import {inspectMiningJournal} from './core/journal-audit.mjs';
import {createTeamCheck,saveTeamCheck} from './core/team-check.mjs';
import {createCheckpoint,isPotionConsumption,isItemHandoffJournal,releaseItemHandoffJournal} from './core/checkpoint.mjs';
// Live game entity dictionaries may temporarily contain null tombstones
// during spawn/despawn and realm transitions. Never dereference a tombstone
// when resolving the leader or selected combat target.
export function resolveLiveEntity(entities,id,self=null){
 if(typeof id!=='string'||!id)return null;
 if(self?.name===id)return self;
 if(!entities||typeof entities!=='object')return null;
 const direct=entities[id];
 if(direct&&typeof direct==='object')return direct;
 return Object.values(entities).find(e=>
  e&&typeof e==='object'&&e.name===id)??null;
}
export function liveMonsterEntries(entities){
 if(!entities||typeof entities!=='object')return [];
 return Object.entries(entities).filter(([,e])=>
  e&&typeof e==='object'&&e.type==='monster'&&!e.dead&&!e.rip&&
  Number.isFinite(e.hp)&&e.hp>0);
}
export function coordinatedPartyFarmers(bot){
 const fallback=[...(bot.farmers??[])],owner=bot.cfg.party?.merchant;
 const h=owner===bot.me.name?{running:bot.running,realm:bot.p.realm(),
  team:bot.account?.heartbeat?.()}:bot.transport?.fresh?.(owner);
 const selected=h?.team,known=new Set((bot.cfg.characters??[])
  .filter(c=>c.enabled&&c.group===bot.me.group&&c.role==='farmer')
  .map(c=>c.name)),names=selected?.names;
 if(!h?.running||h.realm!==bot.p.realm()||!Array.isArray(names)||
  !names.length||names.length>(bot.cfg.party?.maxFarmers??3)||
  names.some(n=>typeof n!=='string'||!known.has(n))||
  new Set(names).size!==names.length||!names.includes(selected.leader)||
  !known.has(selected.leader))return fallback;
 // Local leader disagreement is exactly what election synchronization
 // repairs. Never require the old local leader to equal the new one.
 return [...names];
}
export function selectedPartyMember(bot,name){
 return typeof name==='string'&&name!==bot.me.name&&bot.teamNames.includes(name)&&
  (coordinatedPartyFarmers(bot).includes(name)||name===bot.cfg.party.merchant);
}
// Deterministic ownership requires a fresh authenticated owner heartbeat.
export function canonicalPartyOwner(bot){
 if(!bot.running||!bot.cfg.party?.enabled)return null;
 const realm=bot.p.realm(),merchant=bot.cfg.party.merchant;
 const selected=new Set((bot.cfg.characters??[]).filter(c=>
  c.enabled&&c.group===bot.me.group&&c.role==='farmer')
  .map(c=>c.name));
 const live=name=>name===bot.me.name?{
  name,party:bot.p.c?.party,realm,running:bot.running,rip:bot.p.c?.rip
 }:bot.transport?.fresh?.(name);
 const ownerVerified=name=>{
  const h=live(name);
  return !!(h?.running&&!h.rip&&h.realm===realm&&h.party===name);
 };
 const m=live(merchant);
 // The real party owner is the server's native party ID, NOT the Merchant:
 // e.g. Merchant.party='My_Ranger1' while three farmers are still unpartied.
 // Require independent confirmation from that owner's fresh heartbeat.
 if(m?.running&&!m.rip&&m.realm===realm){
  if(m.party===merchant&&ownerVerified(merchant))return merchant;
  if(typeof m.party==='string'&&selected.has(m.party)&&
     ownerVerified(m.party))return m.party;
 }
 // No merchant proof: prefer the centrally selected leader if its actual
 // party is self-owned, then fall back to the observed local combat leader.
 const central=coordinatedPartyFarmers(bot);
 const voted=m?.team?.leader;
 if(typeof voted==='string'&&central.includes(voted)&&
    ownerVerified(voted))return voted;
 if(selected.has(bot.leader)&&ownerVerified(bot.leader))return bot.leader;
 return null;
}
export function observedPartyMembers(bot){
 const members=bot.p.parent?.party;
 return (Array.isArray(members)?members.map(v=>typeof v==='string'?v:v?.name):
  members&&typeof members==='object'?Object.keys(members):[])
  .filter(v=>typeof v==='string'&&v);
}
export function splitPartyRepairDecision(bot,owner,stableMs=0){
 const self=bot.me.name,party=bot.p.c?.party,team=new Set([
  ...coordinatedPartyFarmers(bot),bot.cfg.party.merchant]);
 const members=observedPartyMembers(bot);
 if(!owner||party===owner||!party||owner===self)return 'no-split';
 if(!bot.p.has?.('leave_party')||stableMs<12000)return 'await-stable-owner';
 if(!members.includes(self)||!members.length||
  members.some(name=>!team.has(name)))return 'party-roster-unverified';
 if(!bot.running||bot.p.c.rip||bot.p.c.hp/Math.max(1,bot.p.c.max_hp)<.65||
  bot.recovering||bot.inventoryBlocked||bot.journal||
  bot.logistics?.reserved||bot.gold?.reserved||bot.bank?.pending||
  bot.lifecycleChanging||bot.account?.rotationPending?.()||
  bot.teamTravel?.blocked||bot.movement?.order||
  (bot.monsters?.()??[]).some(m=>m?.hp>0&&!m.dead&&team.has(m.target))||
  members.some(name=>name!==self&&(bot.transport?.fresh?.(name)?.threats??0)>0))
  return 'party-repair-unsafe-now';
 return 'leave-split-party';
}
export function currentPartyOwner(bot){
 if(bot.p.c.party)return null;
 const owner=canonicalPartyOwner(bot);
 return owner!==bot.me.name?owner:null;
}
export function canAcceptPartyInvite(bot,name){
 const h=selectedPartyMember(bot,name)?bot.transport.fresh(name):null;
 const owner=canonicalPartyOwner(bot);
 return !!(bot.running&&bot.cfg.party.enabled&&!bot.p.c.party&&h?.running&&h.realm===bot.p.realm()&&
  (owner?name===owner:name===bot.leader||h.party===name));
}
export function canAcceptPartyRequest(bot,name){
 const peer=selectedPartyMember(bot,name)?bot.transport.fresh(name):null;
 const owner=canonicalPartyOwner(bot);
 return !!(bot.running&&bot.cfg.party.enabled&&peer?.running&&peer.realm===bot.p.realm()&&
  (!owner&&bot.me.name===bot.leader&&!bot.p.c?.party||
  owner===bot.me.name&&bot.p.c?.party===bot.me.name));
}
// Complete only ABSENT schema fields before start validation. Explicit invalid
// values remain invalid, and each runtime flavor keeps its own descriptor.
// Older personal CODE settings remain unchanged in the stored source object.
export function startupDescriptor(value){
 return value?.general?.testLogging!==undefined?FULL_DESCRIPTOR:
  value?.production?.strategy?P3P4_DESCRIPTOR:
  value?.world?INTEGRATION_DESCRIPTOR:
  value?.production?ECONOMY_DESCRIPTOR:LIVE_DESCRIPTOR;
}
export function completeStartupConfig(value){
 return addMissingDefaults(startupDescriptor(value).schema,value);
}
export function install(root){
  root.ALBot?.dispose?.();
  const p=createPorts(root),now=()=>Date.now();
  const report=createTestReport(p,VERSION);report.event('boot');
  const replaceableLogs=createOverwriteLogSaver(p,()=>report.getDirectory());
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
    const descriptor=startupDescriptor(value);
    const errors=validateProfile(descriptor,value);if(errors.length)return errors;
    const full=addMissingDefaults(DESCRIPTOR.schema,value);
    if(![FULL_DESCRIPTOR,P3P4_DESCRIPTOR].includes(descriptor))errors.push(...validateProfile(DESCRIPTOR,full));
    if(value.party.selection!=='adaptive'&&value.characters.filter(c=>c.enabled&&c.role==='farmer'&&c.group===value.party.group).length>value.party.maxFarmers)errors.push('Mehr aktive Farmer als maxFarmers.');
    if(value.world&&value.characters.filter(c=>c.enabled&&c.role==='farmer').length>20)errors.push('Höchstens 20 Farmer im Account-Roster.');
    if(value.world?.serverHop&&(!value.world.allowedRealms.length||value.world.allowedRealms.some(r=>!nonPvpRealm(r))))errors.push('Serverwechsel benötigt gültige EU-/US-Nicht-PvP-Realms.');
    if(value.characters.some(c=>c.enabled&&c.group!==value.party.group))errors.push('ALBot benötigt eine gemeinsame Gruppenkennung.');
    if(value.characters.filter(c=>c.enabled&&c.role==='merchant').length>1)errors.push('ALBot verwendet höchstens einen zuständigen Merchant.');
    const merchant=value.characters.find(c=>c.enabled&&c.role==='merchant');if(merchant&&value.merchant.enabled&&value.party.merchant!==merchant.name)errors.push('Zuständigen Merchant unter Gruppe & Skills auswählen.');
    if(value.party.leader&&!value.characters.some(c=>c.enabled&&c.name===value.party.leader&&c.role==='farmer'))errors.push('Leader muss aktiver Farmer sein.');
    if(value.items.some(r=>r.enabled&&r.action==='send'&&(!r.recipient||!value.characters.some(c=>c.enabled&&c.name===r.recipient))))errors.push('Lieferempfänger muss aktiv konfiguriert sein.');
    return errors;
  }
  let cfg;try{cfg=completeStartupConfig(parseData(JSON.stringify(root.ALBotConfig)));if(cfg.general?.testLogging!==undefined&&cfg.general.autonomousSetup===undefined)cfg.general.autonomousSetup=true;cfg=applyAutonomousMode(cfg);cfg=discoverAccountRoster(cfg,p,defaultsFor(FULL_DESCRIPTOR.schema.properties.characters.items));if(cfg.general?.autonomousSetup===true&&cfg.world){cfg.world.allowedBosses=[...new Set([...(cfg.world.allowedBosses??[]),...Object.keys(p.G.monsters??{}).filter(id=>bossProfile(p.G,id)?.supported)])];}const errors=validate(cfg);if(errors.length)throw Error(errors.join('; '));}catch(e){p.log('Konfiguration ungültig: '+e.message);failed('invalid',e.message);return;}
  const configuredMe=cfg.characters.find(c=>c.name===p.c?.name&&c.enabled),me=configuredMe??automaticSupplyReceiver(cfg,p),supplyOnly=!!me&&!configuredMe;
  if(!me){p.log('Eigenen Namen zuerst in der Werkstatt aktivieren.');failed('unconfigured','Eigenen Namen zuerst aktivieren');return;}
  report.configure?.({continuous:cfg.general.testLogging===true});
  const team=cfg.characters.filter(c=>c.enabled&&c.group===me.group),farmers=team.filter(c=>c.role==='farmer').map(c=>c.name);if(cfg.general.testLogging===undefined)farmers.sort();
  const key='albot:live-a:'+me.name+':checkpoint';let timer=null,generation=0,disposed=false,lastEconomy=0,lastMerchant=0,lastTransfer=0,lastPlanning=0,lastHeartbeat=0,reportText='',reportTime=0,lastPublished='',panel;const schedulerTiming={ticks:0,totalMs:0,maxMs:0,lastMs:0};let lastSlow=0;
  const checkpoint=createCheckpoint(p,key,report);let journal=checkpoint.journal;
   // Old releases journaled potion equips. A delayed/unknown potion outcome
   // is not a bank, transfer, gold, or item-upgrade ambiguity. Remove ONLY
   // positively identified potion journals. On storage failure value actions
   // remain guarded by checkpoint.durable; ordinary combat need not lock.
   if(isPotionConsumption(journal,p.G)){
     const previous=journal;
     const persisted=checkpoint.clear(previous);
     report.event('checkpoint.potionReleased',{kind:previous.kind,item:previous.item,persisted,reason:'Potion outcome can remain unknown; no inventory lock'});
     journal=null;
   }
  // Upgrade old send/receive journals without inferring successful delivery
  // or replaying an unknown item handoff. Persistence failure retains the lock.
  if(isItemHandoffJournal(journal)){
   const previous=journal;
   if(releaseItemHandoffJournal(checkpoint,previous)){
    journal=null;report.event('checkpoint.itemHandoffReleased',{
     kind:previous.kind,id:previous.id??null,
     item:typeof previous.item==='string'?previous.item:previous.item?.name??null,
     outcome:'unconfirmed',autoRetry:false,valueActionsBlocked:false});
   }else report.event('checkpoint.itemHandoffReleaseFailed',{
    kind:previous.kind,id:previous.id??null,valueActionsBlocked:true});
  }
  if(journal?.kind==='quest.monsterhunt'&&journal.quest==='monsterhunt'&&journal.cost===0&&journal.loss===0&&Array.isArray(journal.slots)&&journal.slots.length===0&&!p.G.skills?.monsterhunt){if(checkpoint.clear(journal)){report.event('checkpoint.repaired',{kind:journal.kind,reason:'Alter ungültiger use_skill(monsterhunt)-Aufruf ohne Inventarwirkung'});journal=null;}}
  const bot={p,cfg,me,supplyOnly,session:me.name+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8),running:false,reason:'Bereit',target:null,teamNames:team.map(c=>c.name),farmers,leader:cfg.party.leader||farmers[0]||me.name,journal,inventoryBlocked:!!journal,
    checkpoint,
    event(type,data){bot.potionReceipts?.observe(type,data);report.event(type,data);bot.adaptive?.fault(type,data);},
    report(message){if(message!==reportText||now()-reportTime>10000){reportText=message;reportTime=now();p.log(message);report.event('message',{message});}},
    free(){return physicalInventoryCapacity(p.c.items,{inventorySize:p.c.isize})?.free??0;},count(name){return (p.c.items??[]).reduce((n,i)=>n+(i?.name===name?(i.q??1):0),0);},
    entity(id){const e=resolveLiveEntity(p.entities,id,id===me.name?p.c:null);
     return e?{...e,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}:null;},
    monsters(){return liveMonsterEntries(p.entities).map(([id,e])=>
     ({...e,id:e.id??id,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}));},
    allies(){return bot.teamNames.map(n=>bot.entity(n)).filter(e=>e&&samePlace(p.c,e));},
    targets(){if(bot.strategy)return [...new Set([...bot.strategy.targets(),...(bot.bosses?.adds()??[])])];const requested=bot.production?.farmTargets();if(requested)return requested;return me.farmTargets.length?me.farmTargets:cfg.farming.targets;},
    task(){return bot.strategy?.task()??(me.role==='merchant'?'supply':'farm');},
    allowed(e,admission=null){if(!e||e.type!=='monster'||e.dead||e.rip||e.hp<=0||e.invincible||!samePlace(p.c,e)||!farmPlanOrTeamDefense(bot.targets(),e,bot.teamNames)||cfg.world?.excludedMaps.includes(e.map))return false;if(bot.bosses?.canAttack(e)===false)return false;if(bot.threats?.permitted(e)===false||bot.navigation?.permitted(e)===false)return false;if(bot.strategy?.safeTarget?.(e.mtype,e)===false&&bot.combatAssessment?.canDefend(e)!==true)return false;if(!e.target&&bot.combatAssessment?.emergency?.().active)return false;if(!e.target&&(e.mtype===bot.teamPlan?.target()&&bot.teamPlan?.wantsCombat()===false||(bot.encounter?.permit(e)===false&&!(admission?.independentAimedSpawnSkill&&['3shot','5shot'].includes(admission.independentAimedSpawnSkill)&&bot.encounter?.aimedSpawnAssessment?.(e)?.allowed===true)&&!(admission?.independentOneShotSkill&&['3shot','5shot'].includes(admission.independentOneShotSkill)&&bot.encounter?.soloOneShot?.(e,p.G.skills?.[admission.independentOneShotSkill])))))return false;if(cfg.farming.avoidOthers&&e.target&&!bot.teamNames.includes(e.target))return false;const threats=Object.values(p.entities).filter(x=>x.type==='monster'&&x.hp>0&&bot.teamNames.includes(x.target)).length;return !!e.target||threats<cfg.farming.maxAggro;},
    rule(i){if(bot.economy)return bot.economy.rules(i);return chooseRule(cfg.items,i,{role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:me.role==='merchant'?'supply':'farm'});},
    consumable(i){if(protectedItem(i)||bot.bank?.pending)return false;const r=bot.rule(i);return !r||(r.action==='consume'&&variantCount(p.c.items,i)>r.keep+r.teamReserve);},
    canConsumeImplicit(name){if(bot.inventoryBlocked||bot.logistics?.reserved)return false;const first=p.c.items.find(i=>i?.name===name);return !!first&&bot.consumable(first);},
    beginValue(j){if(bot.journal)throw Error('Andere Inventaraktion offen');const next={...j,at:now(),evidence:{realm:p.realm(),gold:p.c.gold,inventory:(p.c.items??[]).map(i=>i?fingerprint(i):null)}};if(!checkpoint.begin(next)){const e=new Error('Lieferung vor Versand blockiert: Checkpoint-Speicher fehlt');e.code='NOT_DISPATCHED';throw e;}bot.journal=next;report.event('inventory.intent',{kind:j.kind,item:typeof j.item==='string'?j.item:JSON.stringify(j.item),before:j.before,quantity:j.quantity,to:j.to,details:JSON.stringify(j)});},
    endValue(result){
     if(!bot.journal||result==='unknown'&&bot.inventoryBlocked)return;
     // A lost CM receipt is not a failed game-server send_item. End the
     // best-effort handoff as unconfirmed without blocking unrelated work.
     if(result!=='confirmed'&&isItemHandoffJournal(bot.journal)){
      const old=bot.journal,persisted=releaseItemHandoffJournal(checkpoint,old);
      report.event('inventory.result',{result,kind:old.kind,
       valueActionsBlocked:!persisted,deliveryConfirmed:false});
      bot.allocation?.settle(old,'unknown');
      if(persisted){
       bot.journal=null;bot.inventoryBlocked=false;
       bot.production?.invalidate?.();
       bot.reason='Itemübergabe unbestätigt – Betrieb läuft weiter';
       report.event('logistics.unconfirmed',{kind:old.kind,id:old.id??null,
        item:typeof old.item==='string'?old.item:old.item?.name??null,
        peer:old.to??old.from??null,quantity:old.quantity??null,
        outcome:'unconfirmed',autoRetry:false,valueActionsBlocked:false});
      }else{
       bot.inventoryBlocked=true;
       bot.reason='Inventar-Checkpoint konnte nicht gespeichert werden';
       report.event('runtime.warning',{where:'inventory',reason:bot.reason,
        kind:old.kind,continued:true,valueActionsBlocked:true});
      }
      return;
     }report.event('inventory.result',{result,kind:bot.journal.kind});if(result==='confirmed'&&(bot.allocation?.settle(bot.journal,result)??true)&&(bot.production?.recordDelivery(bot.journal)??true)&&checkpoint.clear(bot.journal)){bot.journal=null;bot.intelligence?.invalidate();bot.production?.invalidate();}else {bot.allocation?.settle(bot.journal,'unknown');bot.inventoryBlocked=true;bot.reason='Inventaraktion ungeklärt: Bestand prüfen';report.event('runtime.warning',{where:'inventory',reason:bot.reason,kind:bot.journal?.kind,continued:true,valueActionsBlocked:true});bot.report(bot.reason);}},
    measure(target=null){const targetHpRatio=target&&Number.isFinite(target.hp)&&Number.isFinite(target.max_hp)&&target.max_hp>0?target.hp/target.max_hp:undefined;return {hpRatio:p.c.hp/p.c.max_hp,targetHpRatio,mpRatio:p.c.mp/p.c.max_mp,freeSlots:bot.free(),gold:p.c.gold,enemyCount:bot.monsters().filter(e=>distance(p.c,e)<p.c.range).length,map:p.c.map,rip:!!p.c.rip,task:bot.task(),count:bot.count};}
  };
  const cleanup=createBootResourceScope();
  bot.metrics=createRuntimeMetrics({now,memoryBytes:()=>root.performance?.memory?.usedJSHeapSize??null});
   bot.skillWakeups=cleanup.acquire('skill-wakeups',()=>createSkillWakeups({now}));
   bot.potionReceipts=createPotionReceipts({session:bot.session,realm:p.realm(),now});
  bot.impactIntents=createImpactIntents({name:me.name,session:bot.session,realm:p.realm(),now});
  bot.learning=createLearning(bot);bot.cloud=createCloudSync(bot);
  bot.admission=createActionAdmission(bot);
  const originalPortCall=p.call,publicCall=p.call.bind(p);
  const recordingPortCall=(name,...args)=>{if(name==='loot')bot.lootReceipts?.beforeLoot?.(args[0]);bot.admission.record(name,args);return publicCall(name,...args);};
  p.call=recordingPortCall;
  cleanup.add('game-port-wrapper',()=>{if(p.call===recordingPortCall)p.call=originalPortCall;});
  const exec=new Executor({admit:(key,resources)=>bot.admission.allow(key,resources),retryDelay:key=>bot.learning.retryDelay(key),now,active:()=>bot.running,limit:cfg.general.maxPending,onEvent:(type,data)=>{bot.metrics.observe(type,data);bot.learning.observe(type,data);report.event(type,{...data,reason:bot.reason,task:bot.task(),target:bot.target?.id??null});},onError:(key,e)=>{report.error(key,e);bot.report(key+': '+(e?.reason??e?.message??e));}});bot.exec=exec;
  bot.revivals=createRevivalClaims(bot);bot.lootReceipts=createOwnLootReceipts(bot);bot.lootDeparture=createLootDeparture(bot);bot.lootBacklog=createLootBacklog(bot);bot.movement=createMovement(bot);bot.transport=createTransport(bot);bot.logistics=createLogistics(bot);bot.skills=createSkills(bot);if(cfg.general.testLogging!==undefined)bot.capabilities=createCapabilities(bot);bot.farmer=createFarmer(bot);
  if(cfg.production){bot.luckySlots=createLuckySlotEvidence(bot);bot.economy=createEconomy(bot);bot.bank=createBank(bot);bot.lossGuard=createAccountLossGuard(bot);bot.market=createMarket(bot);bot.swaps=createSingleSwap(bot);bot.tradeOffers=createOwnTradeOffer(bot);bot.production=createProduction(bot);bot.gear=createGear(bot);bot.tailoring=createStatTailoring(bot);bot.merchant=createMerchant(bot);bot.supplyForecast=createSupplyForecast(bot);bot.accountStock=createAccountStockLedger(bot);bot.services=createServices(bot);bot.objectives=createObjectives(bot);}
  if(cfg.production?.strategy)bot.observations=createObservations(bot);
  if(cfg.merchant.collectGold!==undefined)bot.gold=createGoldLogistics(bot);
  if(cfg.world){bot.cave=createCaveEvidence(bot);bot.caveLifecycle=createCaveLifecycle(bot,{now});bot.cryptLifecycle=createCryptLifecycle(bot,{now});bot.caveVote=createCaveVoteEvidence(bot,{now});bot.caveVoteJournal=createCaveVoteJournal(bot,{now});bot.caveConsensus=createCaveConsensus(bot,{now});bot.caveTeam=createCaveTeamCoordination(bot,{now});bot.caveMultiAggro=createCaveMultiAggroFocus(bot,{now});bot.caveCriticalResponse=createCaveCriticalResponse(bot,{now});bot.caveRetreat=createCaveRetreatConsensus(bot,{now});bot.caveRetreatPrepare=createCaveRetreatPreparation(bot,{now});bot.caveRetreatWatchdog=createCaveRetreatWatchdog(bot,{now});bot.caveCombat=createCaveDefensiveCombat(bot,{now});bot.caveCriticalTriage=createCaveCriticalHealTriage(bot,{now});bot.cavePriest=createCavePriestHealing(bot,{now});bot.cavePriestSupport=createCavePriestSupport(bot,{now});bot.caveDirect=createCaveDirectCohesion(bot,{now});bot.caveEmergency=createCaveEmergencyDirect(bot,{now});bot.respawns=createRespawnCalendar(bot);bot.farmers=bot.farmers.includes(bot.leader)?[bot.leader,...bot.farmers.filter(n=>n!==bot.leader)].slice(0,cfg.party.maxFarmers):bot.farmers.slice(0,cfg.party.maxFarmers);if(!bot.farmers.includes(bot.leader)&&bot.farmers.length)bot.leader=bot.farmers[0];bot.strategy=createStrategy(bot);bot.behavior=createBehavior(bot);bot.account=createAccount(bot);bot.progression=createProgression(bot);bot.teamTravel=createTeamTravel(bot);bot.aura=createAura(bot);}
  if(cfg.general.testLogging!==undefined){bot.teamPlan=createTeamPlan(bot);bot.encounter=createEncounter(bot);bot.navigation=createCombatNavigation(bot);bot.combatAssessment=createCombatAssessment(bot);bot.elixirs=createElixirs(bot);bot.seashells=createSeashellCycle(bot);bot.supplies=createSupplies(bot);bot.conversions=createConversions(bot);bot.decisionEpoch=0;bot.intelligence=createEconomicIntelligence(bot);bot.storage=createStoragePlanner(bot);bot.adaptive=createAdaptive(bot);bot.bosses=createBosses(bot);bot.marketDemand=createMarketDemand(bot);bot.priority=createPriorityScheduler(bot);bot.recovery=createRecovery(bot);bot.threats=createThreatLedger(bot);bot.allocation=createGearAllocation(bot);bot.content=createContentGuard(bot);bot.opportunities=createWorldOpportunities(bot);bot.rewards=createRewardMail(bot);}
  {const stop=p.watchChestOpened?.(row=>bot.lootReceipts?.observeChest?.(row));if(typeof stop==='function')cleanup.add('chest-watcher',stop);}
  if(bot.tradeOffers){const stop=p.watchOwnTradeSwaps?.(data=>bot.tradeOffers?.observeSwap?.(data));if(typeof stop==='function')cleanup.add('trade-watcher',stop);}
  const game=root.game??p.parent.game;if((bot.observations||bot.impactIntents||bot.respawns)&&typeof game?.on==='function'&&typeof game?.remove==='function')for(const [event,handler] of [['hit',d=>{bot.observations?.hit(d);bot.respawns?.hit(d);bot.impactIntents?.observe(d);bot.threats?.hit(d);bot.combatAssessment?.hit(d);bot.bosses?.hit(d);}],['death',d=>{bot.observations?.death(d);bot.respawns?.death(d);bot.threats?.death(d);}],['trade',d=>bot.marketDemand?.sale(d)]].filter(([event])=>event!=='trade'||bot.marketDemand)){const id=game.on(event,handler);cleanup.add('game-'+event,()=>game.remove(id));}
  if(bot.services&&typeof p.c.on==='function'&&(typeof p.c.remove==='function'||typeof p.c.off==='function')){const events=p.c,handler=data=>bot.services.observeMerrit(data),id=events.on('merrit',handler);cleanup.add('merchant-merrit',()=>typeof events.remove==='function'?events.remove(id):events.off('merrit',handler));}
  if(typeof root.addEventListener==='function')for(const type of ['error','unhandledrejection']){const handler=e=>{report.error(type,e.error??e.reason??e.message);report.flush(true);};root.addEventListener(type,handler);cleanup.add('window-'+type,()=>root.removeEventListener(type,handler));}
  const inviteAllowed=name=>canAcceptPartyInvite(bot,name);
  cleanup.add('party-invite',p.hook('on_party_invite',name=>{if(inviteAllowed(name))exec.run('party',['party'],()=>inviteAllowed(name),()=>p.call('accept_party_invite',name),{delay:3000});}));
  cleanup.add('party-request',p.hook('on_party_request',name=>{
    // The configured merchant is a team member, but not a farmer. Accept its
    // request exactly as a selected farmer, never an unconfigured requester.
    const eligible=()=>canAcceptPartyRequest(bot,name);
    if(eligible())exec.run('party',['party'],eligible,()=>p.call('accept_party_request',name),{delay:3000});
  }));
  if(bot.teamTravel)cleanup.add('magiport',p.hook('on_magiport',name=>bot.teamTravel.accept(name)));
  // Follower-initiated requests supplement lost browser invitation callbacks.
  // Both directions only address live, selected members and are rate limited.
  let lastPartyRequest=0,splitOwner=null,splitSince=0,lastSplitRepair=0;
  function repairSplitParty(){
   const owner=canonicalPartyOwner(bot),current=p.c.party,at=now();
   if(!owner||!current||current===owner){
    splitOwner=null;splitSince=0;return false;
   }
   const signature=owner+'|'+current;
   if(splitOwner!==signature){splitOwner=signature;splitSince=at;return false;}
   if(at-lastSplitRepair<30000)return false;
   if(splitPartyRepairDecision(bot,owner,at-splitSince)!=='leave-split-party')return false;
   const guard=()=>bot.running&&p.c.party===current&&
    canonicalPartyOwner(bot)===owner&&
    splitPartyRepairDecision(bot,owner,now()-splitSince)==='leave-split-party';
   const admitted=exec.run('party.repair.leave',['party'],guard,
    ()=>p.call('leave_party'),{delay:30000,timeout:10000});
   if(admitted){lastSplitRepair=at;bot.event?.('party.splitRepair',{
    from:current,canonicalOwner:owner,reason:'verified-safe-split-party-leave'});}
   return admitted;
  }
  function requestSelectedLeader(){
    if(!bot.running||!cfg.party.enabled||bot.account?.active()===false||p.c.party||!p.has('send_party_request'))return;
    const owner=currentPartyOwner(bot),target=owner??(me.name===bot.leader?null:bot.leader);
    if(!target)return;
    const h=bot.transport.fresh(target),at=now();
    if(!h?.running||h.rip||h.realm!==p.realm()||at-lastPartyRequest<30000)return;
    lastPartyRequest=at;
    exec.run('party.request',['party'],()=>bot.running&&!p.c.party&&bot.account?.active()!==false&&!!bot.transport.fresh(target)?.running,()=>p.call('send_party_request',target),{delay:30000});
  }
  function publish(){try{const text=(bot.running?'ALBot ':'PAUSE ')+bot.reason.slice(0,50);if(text!==lastPublished){lastPublished=text;p.call('set_message',text);}}catch{}panel?.render();}
  function halt(reason){bot.lootBacklog?.reset();bot.lootDeparture?.reset();bot.lootReceipts?.close();bot.cloud.close();bot.learning.flush(true);bot.impactIntents?.close();bot.combatAssessment?.close();bot.running=false;generation++;clearTimeout(timer);timer=null;bot.movement.stop();exec.invalidate();bot.gold?.close();bot.logistics.close();bot.economy?.close();bot.production?.close();bot.tailoring?.close();bot.market?.close();bot.merchant?.close();bot.supplyForecast?.close();bot.skillWakeups?.close();bot.potionReceipts?.close();bot.rewards?.close();bot.services?.interrupt();bot.strategy?.close();bot.teamPlan?.close();bot.encounter?.close();bot.bosses?.close();bot.adaptive?.flush(true);bot.priority?.close();bot.recovery?.close();bot.threats?.close();bot.allocation?.close();bot.content?.close();bot.behavior?.close();bot.account?.close();bot.progression?.close();bot.observations?.close();bot.luckySlots?.close();bot.respawns?.close();bot.cave?.close();bot.caveLifecycle?.close();bot.cryptLifecycle?.close();bot.caveVoteJournal?.close();bot.objectives?.close();bot.teamTravel?.close();bot.target=null;bot.reason=reason;publish();bot.report(reason);report.event('stop',{reason}); /* Export only on explicit user command. */}
  bot.pause=(reason='Pause')=>halt(reason);
  const warningTimes=new Map();let retryAfter=0;function runtimeWarning(where,e){bot.reason='Hinweis: '+(e?.message??e);retryAfter=now()+3000;const key=where+':'+bot.reason;if(now()-(warningTimes.get(key)??0)>30000){if(warningTimes.size>=64)warningTimes.clear();warningTimes.set(key,now());report.error(where,e);report.event('runtime.warning',{where,reason:bot.reason,continued:true,retryMs:3000,valueActionsBlocked:bot.inventoryBlocked});bot.report(bot.reason);}}
  function tick(gen){if(disposed||!bot.running||gen!==generation)return;const tickStarted=now();try{
    if(!p.c||!p.G){runtimeWarning('state','Spielzustand fehlt');return;}
    // Observe transient bank contents while the merchant can actually see them.
    // Retained snapshots are sent later under the Worker's 120-second rate limit.
    if(telemetryAuto?.observeBank())void telemetryAuto.sendOnce();
    // The bank snapshot may arrive after the original action timed out. Only
    // exact, pinned source/destination evidence can release the value lock.
    if(bot.inventoryBlocked&&(['bank.gold','bank.store','gather.fishing','gather.mining','exchange','gold.send','gold.receive','buy','market.buy','ponty.buy','elixir.equip','sell','market.sell'].includes(bot.journal?.kind)))bot.recovery?.reconcile();
    if(now()<retryAfter)return;
    beginCombatLife(bot);bot.revivals.observe();
    bot.decisionEpoch=(bot.decisionEpoch??0)+1;exec.poll();if(bot.priority)exec.beginFrame();bot.movement.poll();bot.threats?.sample();bot.observations?.sample();bot.respawns?.sample();bot.cave?.sample();bot.caveLifecycle?.sample();bot.cryptLifecycle?.sample();bot.caveVoteJournal?.sample();bot.tradeOffers?.sample();bot.lootReceipts?.sample();
    if(!bot.running)return;
    bot.lossGuard?.sample();if(bot.lossGuard?.blocked){bot.transport.heartbeat();bot.pause('Accountgold: mindestens 85 % Verlust innerhalb des Prüfzeitfensters; manuelle Freigabe erforderlich');return;}
    if(bot.lifecycleChanging){bot.teamTravel?.lifecycleTick?.();if(now()-lastHeartbeat>=2000){lastHeartbeat=now();bot.metrics.measure('transport.heartbeat',()=>bot.transport.heartbeat());}return;}
    if(supplyOnly){if(now()-lastHeartbeat>=2000){lastHeartbeat=now();bot.metrics.measure('transport.heartbeat',()=>bot.transport.heartbeat());}bot.logistics.poll(true);exec.flush();return;}
    bot.teamTravel?.tick();if(!bot.running)return;
    if(bot.teamTravel?.blocked){if(now()-lastHeartbeat>=2000){lastHeartbeat=now();bot.metrics.measure('transport.heartbeat',()=>bot.transport.heartbeat());}return;}
    bot.behavior?.tick();if(!bot.running)return;
    if(now()-lastHeartbeat>=2000){lastHeartbeat=now();bot.metrics.measure('transport.heartbeat',()=>bot.transport.heartbeat());}
    const economyDue=now()-lastEconomy>=cfg.general.economyTickMs;if(economyDue)lastEconomy=now();const transferDue=now()-lastTransfer>=(cfg.general.transferIntervalMs??cfg.general.economyTickMs);if(transferDue)lastTransfer=now();bot.gold?.poll(transferDue);bot.logistics.poll(transferDue);
    if(!bot.running)return;
    bot.allocation?.tick();bot.adaptive?.tick();if(economyDue)bot.metrics.measure('economy.supplyForecast',()=>bot.supplyForecast?.tick());if(economyDue)bot.metrics.measure('objectives',()=>bot.objectives?.tick());bot.metrics.measure('team-plan',()=>bot.teamPlan?.tick());bot.metrics.measure('encounter',()=>bot.encounter?.tick());bot.metrics.measure('bosses',()=>bot.bosses?.tick());bot.adaptive?.flush();bot.content?.flush();bot.learning.flush();if(economyDue)bot.cloud.tick();if(economyDue){bot.metrics.measure('economy.strategy',()=>{bot.strategy?.plan();bot.strategy?.sample();});}
    if(economyDue)bot.rewards?.tick();
    const merchantDue=merchantActionDue({
      now:now(),last:lastMerchant,normalDue:economyDue,
      merchant:me.role==='merchant',
      depotActive:!!bot.merchant?.status?.()?.depot,
      hasPending:exec.pending.size>0,
      blocked:!!bot.journal||!!bot.inventoryBlocked||
       !!bot.logistics?.reserved||!!bot.gold?.reserved,
      moving:!!bot.movement.order||!!bot.movement.townActive
    });
    // Collect visible loot outside the combat early-return paths.
    bot.lootBacklog?.tick();
    if(bot.priority){bot.priority.run([
     {id:'recovery',kind:'emergency',exclusive:true,run:()=>bot.farmer.safety()},
     {id:'elixir',kind:'safety',guard:()=>economyDue&&!bot.recovering,run:()=>bot.elixirs.tick()},
     {id:'world',kind:bot.teamPlan.materialActive()?'background':'normal',priority:20,exclusive:true,guard:()=>economyDue&&!inCaveInstance(p.c)&&!bot.account?.rotationPending?.()&&me.role==='farmer'&&(bot.account?.active()??true)&&!p.c.rip&&!bot.journal&&!bot.bank?.pending&&!bot.logistics.reserved&&!bot.monsters().some(m=>m.target===me.name),run:()=>bot.opportunities?.tick()||bot.strategy.anniversary()||bot.strategy.quest()},
     {id:'combat',kind:'normal',priority:10,run:()=>{bot.metrics.measure('farmer',()=>bot.farmer.tick());return !!bot.target||bot.recovering;}},
     {id:'merchant',kind:'normal',guard:()=>merchantDue&&!bot.recovering&&!bot.strategy.busy,run:()=>{lastMerchant=now();if(bot.opportunities?.tick())return true;const before=exec.pending.size;bot.metrics.measure('merchant',()=>bot.merchant.tick());return exec.pending.size>before;}},
     {id:'aura',kind:'safety',run:()=>bot.aura.tick()}
    ]);}else{
    const worldAction=economyDue&&!inCaveInstance(p.c)&&!bot.account?.rotationPending?.()&&me.role==='farmer'&&(bot.account?.active()??true)&&!p.c.rip&&p.c.hp/p.c.max_hp>=cfg.farming.restBelow&&!bot.journal&&!bot.bank?.pending&&!bot.logistics.reserved&&!bot.monsters().some(m=>m.target===me.name)&&(bot.strategy?.anniversary()||bot.strategy?.quest());
    if(!worldAction)bot.metrics.measure('farmer',()=>bot.farmer.tick());if(merchantDue&&bot.running&&!bot.recovering&&!worldAction&&!bot.strategy?.busy){lastMerchant=now();bot.metrics.measure('merchant',()=>bot.merchant?.tick());}bot.aura?.tick();
    }
    bot.metrics.measure('planning.gear.advance',()=>bot.intelligence?.advance());
    if(now()-lastPlanning>=cfg.general.planningTickMs){lastPlanning=now();
     bot.metrics.measure('planning.gear',()=>bot.gear?.refresh());
     bot.metrics.measure('planning.progression',()=>bot.progression?.refresh());
     bot.metrics.measure('planning.production',()=>bot.production?.planGoals());
     bot.metrics.measure('planning.account',()=>bot.account?.tick());
     if(!bot.recovering)bot.metrics.measure('planning.logistics',()=>bot.logistics.travel());
     bot.metrics.measure('planning.party',()=>{repairSplitParty();requestSelectedLeader();});
    const canonical=canonicalPartyOwner(bot);
    if(cfg.party.enabled&&(canonical===me.name||
     !canonical&&me.name===bot.leader&&!p.c.party)){
     const memberNames=[...new Set([...coordinatedPartyFarmers(bot),
      ...(bot.teamNames.includes(cfg.party.merchant)?[cfg.party.merchant]:[])])];
      const roster=p.parent.party;const joined=name=>Array.isArray(roster)?roster.some(x=>(typeof x==='string'?x:x?.name)===name):!!(roster&&typeof roster==='object'&&Object.hasOwn(roster,name));
      for(const name of memberNames){if(name===me.name||joined(name))continue;
        const h=bot.transport.fresh(name),e=bot.entity(name);
        if(!h?.running||h.rip||h.realm!==p.realm()||name!==cfg.party.merchant&&h.inventoryBlocked)continue;
        // A fresh owner heartbeat is stronger than a stale local roster view.
        // Never re-invite an already joined member just because it is offscreen.
        if(p.c.party&&(h.party===p.c.party||e?.party===p.c.party))continue;
        if(!p.c.party||!e||e.party!==p.c.party){
          const eligible=()=>bot.running&&selectedPartyMember(bot,name)&&
            !!bot.transport.fresh(name)?.running&&bot.transport.fresh(name)?.realm===p.realm()&&!joined(name)&&
            (!p.c.party||bot.transport.fresh(name)?.party!==p.c.party);
          exec.run('invite:'+name,['party'],eligible,()=>p.call('send_party_invite',name),{delay:10000});
        }
      }
    }}
    publish();
    bot.metrics.measure('test.sample',()=>report.sample({reason:bot.reason,running:bot.running,task:bot.task(),
      farmArea:bot.teamPlan?.heartbeat?.()?.key??null,
      farmContext:bot.adaptive?.context?.()??null,
      inventoryBlocked:!!bot.inventoryBlocked,
      valueActionPending:!!bot.journal||!!bot.bank?.pending||
       !!bot.logistics?.reserved||!!bot.gold?.reserved}));
  }catch(e){exec.frame=[];runtimeWarning('tick',e);}finally{try{exec.flush();}catch(e){runtimeWarning('dispatch',e);}const elapsed=now()-tickStarted;schedulerTiming.ticks++;schedulerTiming.totalMs+=elapsed;schedulerTiming.lastMs=elapsed;schedulerTiming.maxMs=Math.max(schedulerTiming.maxMs,elapsed);bot.metrics.frame(elapsed);if(elapsed>100&&now()-lastSlow>10000){lastSlow=now();report.event('scheduler.slow',{ms:elapsed,reason:bot.reason});}if(bot.running&&gen===generation)timer=root.setTimeout(()=>tick(gen),me.role==='farmer'&&bot.skillWakeups?
     bot.skillWakeups.nextDelay(cfg.general.combatTickMs):cfg.general.combatTickMs);}}
  // Automatic telemetry uses a private CODE-only write credential, never
  // a secret in the signed public bundle or a Cloudflare deployment token.
  // The existing Access relay remains an optional manual fallback.
  let telemetryRelay=null,telemetryInterval=null,telemetryAuto=null,telemetryAutoInterval=null;
  let configSyncPreview=null,configActivationReview=null,configStaging=null,configRestartIntent=null;
  if(!p.headless){
    try{
      const gameWindow=p.parent;
      if(['https://adventure.land','https://www.adventure.land'].includes(gameWindow?.location?.origin)){
        const fetcher=typeof root.fetch==='function'?root.fetch.bind(root):
          typeof gameWindow.fetch==='function'?gameWindow.fetch.bind(gameWindow):null;
        if(fetcher)telemetryAuto=createAutomaticTelemetrySender({
          fetcher,getCredential:()=>root.ALBOT_AUTO_TELEMETRY_TOKEN,
          getCharacter:()=>p.c,getRealm:()=>p.realm(),
          getBankDefinitions:()=>p.G?.bank_packs??{},role:me.role,
          isRunning:()=>bot.running&&!disposed
        });
        // User-initiated verification only: this cannot change bot.cfg or
        // publish an applied configuration acknowledgment.
        const configCrypto=root.crypto??gameWindow.crypto;
        const readConfigTrust=()=>root.ALBOT_CONFIG_SYNC_TRUST;
        const readConfigStorage=()=>root.localStorage??gameWindow.localStorage;
        configStaging=createVerifiedConfigStaging({
          cryptoObject:configCrypto,
          readTrust:readConfigTrust,readStorage:readConfigStorage,
          // Only the actual in-game character may own a staging receipt.
          readCharacter:()=>p.c?.name
        });
        configSyncPreview=createConfigSyncPreview({
          gameWindow,cryptoObject:configCrypto,staging:configStaging,
          readTrust:readConfigTrust,readStorage:readConfigStorage
        });
        // Explicit review of a locally paused staged revision only.
        // The review journal is metadata, not rollback/activation authority.
        configActivationReview=createConfigActivationReviewJournal({
          readStorage:readConfigStorage,readTrust:readConfigTrust,
          readCharacter:()=>p.c?.name,
          readStage:()=>configSyncPreview?.status()??null,
          readPreflight:()=>assessConfigActivationPreflight(
           captureLocalConfigSafePoint(bot,{disposed}),
           configSyncPreview?.status()??null,{now:now()}),
          now
        });
        // Explicit signed review + detached candidate; never live apply.
        configRestartIntent=createConfigRestartIntentGate({
          readStorage:readConfigStorage,readTrust:readConfigTrust,
          readCharacter:()=>p.c?.name,
          readStage:()=>configSyncPreview?.status()??null,
          readPreflight:()=>assessConfigActivationPreflight(
           captureLocalConfigSafePoint(bot,{disposed}),
           configSyncPreview?.status()??null,{now:now()}),
          readReview:()=>configActivationReview?.status()??null,
          now
        });
        telemetryRelay=createGameRelaySender({
          gameWindow,getCharacter:()=>p.c,getRealm:()=>p.realm(),
          getBankDefinitions:()=>p.G?.bank_packs??{},role:me.role,
          onReady:()=>{if(!disposed)telemetryRelay?.sendOnce();}
        });
      }
    }catch(e){report.event('telemetry.unavailable',{reason:'unsupported-browser'});}
  }
  cleanup.add('telemetry-and-staging',()=>{
    if(telemetryInterval!==null)root.clearInterval?.(telemetryInterval);
    telemetryInterval=null;telemetryRelay?.disconnect();
    if(telemetryAutoInterval!==null)root.clearInterval?.(telemetryAutoInterval);
    telemetryAutoInterval=null;telemetryAuto?.dispose();
    configSyncPreview?.dispose();
    configActivationReview?.dispose();
    configRestartIntent?.dispose();
  });
  // Snapshot-only local safety observation. There is no authority to apply
  // Full-v1 settings or commit an applied cursor from this endpoint.
  const configActivationPreflight=()=>assessConfigActivationPreflight(
   captureLocalConfigSafePoint(bot,{disposed}),
   configSyncPreview?.status()??null,{now:now()});
  const api={version:VERSION,schemaId:cfg.general.testLogging!==undefined?FULL_DESCRIPTOR.schemaId:cfg.production?.strategy?P3P4_DESCRIPTOR.schemaId:cfg.world?INTEGRATION_DESCRIPTOR.schemaId:cfg.production?ECONOMY_DESCRIPTOR.schemaId:LIVE_DESCRIPTOR.schemaId,
    start(){
      if(disposed)return false;if(bot.running)return true;
      const deny=reason=>{bot.reason=reason;publish();bot.report(reason);return false;};
      bot.lossGuard?.sample();if(bot.lossGuard?.blocked)return deny('Accountgold-Verlustsperre aktiv');
      if(me.class!=='auto'&&me.class!==p.c.ctype)return deny('Konfigurierte Klasse stimmt nicht');
      if(me.region+me.server!==p.realm()&&!(cfg.world?.serverHop&&cfg.world.allowedRealms.includes(p.realm())))return deny('Falscher Realm: erwartet '+me.region+me.server);
      if(cfg.general.transport==='ipc'&&!p.ipc)return deny('Lokale IPC nicht verfügbar');
      bot.recovery?.reconcile();if(cfg.production?.autoDisposition===true&&bot.inventoryBlocked&&/^gather\./.test(bot.journal?.kind??''))return deny('AutoDisposition gesperrt: offenes Inventarjournal zuerst nach Bestandsabgleich bestaetigen');if(bot.inventoryBlocked)report.event('runtime.warning',{where:'start',reason:'Offene Inventaraktion: Wertaktionen gesperrt, übriger Betrieb läuft',continued:true});
      bot.cloud.resume();bot.economy?.resume();report.event('start');bot.running=true;bot.reason=supplyOnly?'Automatischer Trankempfänger (kein Farmprofil)':'Start';generation++;if(!supplyOnly)bot.progression?.refresh();
      if(telemetryAuto?.status().configured&&telemetryAutoInterval===null&&typeof root.setInterval==='function'){
        void telemetryAuto.sendOnce();
        telemetryAutoInterval=root.setInterval(()=>{
          if(!disposed&&bot.running)void telemetryAuto.sendOnce();
        },AUTO_TELEMETRY_INTERVAL_MS);
      }
      tick(generation);return bot.running;
    },
    pause:()=>halt('Pause'),stop:()=>halt('STOP'),
    accountGoldStatus:()=>bot.lossGuard?.status()??null,
    acknowledgeAccountGoldLoss:()=>bot.lossGuard?.reset()??false,
    acknowledgeVerifiedTradeOffer:rid=>bot.tradeOffers?.acknowledgeVerified?.(rid)??false,
    restoreLearning:()=>bot.cloud.restore(),
    bossCatalog:()=>bot.bosses?.catalog()??[],
    explainInventorySlot:slot=>bot.intelligence?.explainInventorySlot?.(slot)??{version:1,mode:'read-only',executable:false,state:'unavailable',reason:'economic-intelligence-not-enabled'},
    previewAccountStock:(item,limits)=>bot.accountStock?.preview?.(item,limits)??{version:1,mode:'read-only',executable:false,saleAuthorized:false,status:'unavailable',reason:'account-stock-not-enabled'},
    requestTask:(task,ttl)=>bot.strategy?.requestTask(task,ttl)??false,
    requestSupply:(item,quantity)=>bot.behavior?.requestSupply(item,quantity)??false,
    requestServerHop:realm=>bot.teamTravel?.requestHop(realm)??false,
    refreshCaveVisit:()=>bot.cave?.refreshVisit()??false,
    prepareCaveEntry:()=>bot.caveLifecycle?.prepare()??false,
    cryptPreflight:(mode,instanceName)=>bot.cryptLifecycle?.preflight(mode,instanceName)??null,
    prepareCryptEntry:(mode,instanceName)=>bot.cryptLifecycle?.prepare(mode,instanceName)??false,
    requestCryptEntry:()=>bot.cryptLifecycle?.requestEntry()??false,
    discardPreparedCryptEntry:()=>bot.cryptLifecycle?.discardPrepared()??false,
    requestCaveEntry:()=>bot.caveLifecycle?.requestEntry()??false,
    requestCaveExit:()=>bot.caveLifecycle?.requestExit()??false,
    confirmCaveExit:()=>bot.caveLifecycle?.confirmExit()??false,
    caveVotePreflight:optionId=>bot.caveVote?.preflight(optionId)??null,
    caveConsensusPreview:policy=>bot.caveConsensus?.preview(policy)??null,
    prepareCaveVote:optionId=>bot.caveVoteJournal?.prepare(optionId)??false,
    requestCaveVote:()=>bot.caveVoteJournal?.requestVote()??false,
    discardPreparedCaveVote:()=>bot.caveVoteJournal?.discardPrepared()??false,
    discardPreparedCaveEntry:()=>bot.caveLifecycle?.discardPrepared()??false,
    status:()=>({version:VERSION,elixir:bot.elixirs?.status?.()??null,profile:cfg.general.name,running:bot.running,supplyOnly,accountGold:bot.lossGuard?.status()??null,onlineSupplyFarmers:me.role==='merchant'?onlineSupplyFarmers(bot).map(x=>x.name):[],environment:p.headless?'headless':'browser',ipc:p.ipc,name:me.name,role:me.role,reason:bot.reason,task:bot.task(),target:bot.target?.id??null,pending:exec.pending.size,actionAdmission:bot.admission.status(),lootDeparture:bot.lootDeparture.status(),lootReceipts:bot.lootReceipts?.status()??null,gearAllocationRecovery:bot.allocation?.recoveryStatus?.()??null,observedGearStats:bot.gear?.observedPerformance?.()??[],respawns:bot.respawns?.status()??null,cave:bot.cave?.status()??null,caveLifecycle:bot.caveLifecycle?.status()??null,cryptLifecycle:bot.cryptLifecycle?.status()??null,caveVote:bot.caveVote?.status()??null,caveVoteJournal:bot.caveVoteJournal?.status()??null,caveConsensus:bot.caveConsensus?.status()??null,caveTeam:bot.caveTeam?.status()??null,caveMultiAggro:bot.caveMultiAggro?.status()??null,caveCriticalResponse:bot.caveCriticalResponse?.status()??null,caveRetreat:bot.caveRetreat?.status()??null,caveRetreatPrepare:bot.caveRetreatPrepare?.status()??null,caveRetreatWatchdog:bot.caveRetreatWatchdog?.status()??null,caveCombat:bot.caveCombat?.status()??null,caveCriticalTriage:bot.caveCriticalTriage?.status()??null,cavePriest:bot.cavePriest?.status()??null,cavePriestSupport:bot.cavePriestSupport?.status()??null,caveDirect:bot.caveDirect?.status()??null,caveEmergency:bot.caveEmergency?.status()??null,revivals:bot.revivals.status(),luckySlots:bot.luckySlots?.status()??null,swaps:bot.swaps?.status()??null,tradeOffers:bot.tradeOffers?.status()??null,statTailoring:bot.tailoring?.status()??null,rewardMail:bot.rewards?.status()??null,combatLife:bot.combatLife??null,skillDiagnostics:bot.skills?.diagnostics?.()??{},inventoryBlocked:bot.inventoryBlocked,achievementCarrier:carriedAchievementCarrier(p.c.items),journal:bot.journal?structuredClone(bot.journal):null,gameParty:p.c.party??null,teamLeader:bot.leader,selectedFarmers:[...bot.farmers]}),
    telemetrySnapshot:()=>({
      character:observedCharacterTelemetry(p.c,p.realm()),
      bank:me.role==='merchant'?observedBankTelemetry(
        p.c,p.realm(),p.G?.bank_packs??{}):[]
    }),
    telemetryStatus:()=>telemetryAuto?{
      ...telemetryAuto.status(),
      active:!disposed&&bot.running&&telemetryAutoInterval!==null,
      relay:telemetryRelay?.status()??null
    }:telemetryRelay?{mode:'relay-only',...telemetryRelay.status()}:
      {mode:'unavailable',configured:false,active:false,
       connected:false,opened:false,intervalMs:GAME_RELAY_INTERVAL_MS,unsupported:true},
    openTelemetryRelay(){
      if(disposed||telemetryAuto?.status().configured||!telemetryRelay||typeof root.setInterval!=='function')return false;
      if(!telemetryRelay.open())return false;
      if(telemetryInterval===null){
        telemetryInterval=root.setInterval(()=>{
          if(!disposed)telemetryRelay.sendOnce();
        },GAME_RELAY_INTERVAL_MS);
      }
      return true;
    },
    configSyncStatus:()=>({
      ...(configSyncPreview?.status()??{
       mode:'unavailable',configured:false,applied:false,acknowledged:false
      }),
      safePoint:configActivationPreflight()
    }),
    configActivationPreflight:()=>configActivationPreflight(),
    // Manual detached Full-v1 validation only. Never changes live bot.cfg.
    previewConfigActivationCandidate:async()=>!disposed&&configStaging?
      configStaging.dryRun(bot.cfg):{
       ok:false,reason:'Staging unavailable',readyForActivation:false,
       applied:false,acknowledged:false
      },
    configActivationReviewStatus:()=>configActivationReview?.status()??{
      mode:'unavailable',configured:false,readyForActivation:false,
      applied:false,acknowledged:false
    },
    prepareConfigActivationReview:()=>!disposed&&
      (configActivationReview?.prepare()??false),
    discardConfigActivationReview:()=>!disposed&&
      (configActivationReview?.discard()??false),
    configRestartIntentStatus:()=>configRestartIntent?.status()??{
      mode:'unavailable',configured:false,hasAutomaticRestartAuthority:false,
      readyForActivation:false,transactionCommitted:false,
      applied:false,acknowledged:false
    },
    prepareConfigRestartIntent:async()=>{
      if(disposed||!configRestartIntent||!configStaging)return false;
      const candidate=await configStaging.dryRun(bot.cfg);
      if(disposed)return false;
      return configRestartIntent.prepare(candidate);
    },
    discardConfigRestartIntent:()=>!disposed&&
      (configRestartIntent?.discard()??false),
    // Explicit opt-in fault rehearsal in a detached scratch graph. Requires
    // fresh signed staging AND the prior manual restart review, never commits.
    rehearseConfigRestartRecovery:async()=>{
      const deny=reason=>({ok:false,mode:'detached-sandbox-only',reason,
       controllerReconstructionTested:false,actualRollbackCertified:false,
       restartAuthorized:false,transactionCommitted:false,
       readyForActivation:false,applied:false,acknowledged:false});
      if(disposed||!configStaging||!configRestartIntent||bot.running)
       return deny('Paused game and verified restart review required');
      const before=configRestartIntent.status(),
        safe=configActivationPreflight(),review=configActivationReview?.status();
      if(before.intent?.currentEvidenceValid!==true||
       before.intent.resumeRequiresReverification!==true||
       safe.locallyQuiescent!==true||safe.signedStageVerified!==true||
       safe.blockers?.length!==0||
       review?.review?.currentEvidenceValid!==true)
       return deny('Fresh restart review or local safe point unavailable');
      const result=await configStaging.rehearse(bot.cfg);
      const after=configRestartIntent.status(),
       safeAfter=configActivationPreflight();
      if(disposed||bot.running||
       after.intent?.currentEvidenceValid!==true||
       after.intent.sequence!==before.intent.sequence||
       after.intent.sha256!==before.intent.sha256||
       after.intent.preparedAt!==before.intent.preparedAt||
       safeAfter.locallyQuiescent!==true||
       safeAfter.signedStageVerified!==true||
       safeAfter.blockers?.length!==0||
       result.sequence!==before.intent.sequence||
       result.sha256!==before.intent.sha256)
       return deny('Restart review, signed stage or safe point changed');
      return result;
    },
    openConfigSync(){
      if(disposed||!configSyncPreview)return false;
      return configSyncPreview.open();
    },
    transportStatus:()=>bot.transport.status(),
    teamCheck:()=>createTeamCheck(bot,report.document()),
    exportTeamCheck(){const check=this.teamCheck();return saveTeamCheck(p,check);},
    saveTeamCheck(){return replaceableLogs.save(stableLogName('team',p.c?.name),
      JSON.stringify(this.teamCheck(),null,2));},
    testReport:()=>report.text(),exportTestReport:()=>report.flush(),
    saveTestReport(){return replaceableLogs.save(stableLogName('test',p.c?.name),
      report.text());},
    chooseLogDirectory:()=>report.chooseDirectory(),logCapabilities:()=>report.capabilities(),
    acknowledgeInventory(){if(bot.running)throw Error('Zuerst pausieren und tatsächlichen Bestand prüfen');if(!checkpoint.write(null))throw Error('Speichern fehlgeschlagen');bot.journal=null;bot.inventoryBlocked=false;bot.reason='Inventar manuell abgeglichen';publish();},
    acknowledgeMiningAfterReview(token){
     const audit=inspectMiningJournal(bot);
     if(!audit.eligible||typeof token!=='string'||!token||token!==audit.token)throw Error('Mining-Bestandsabgleich ist nicht mehr gültig; neu prüfen');
     if(!checkpoint.write(null))throw Error('Journal-Speicherung fehlgeschlagen');
     const kind=bot.journal.kind;
     bot.journal=null;bot.inventoryBlocked=false;bot.reason='Gathering-Journal nach manueller Bestandsprüfung freigegeben';
     bot.event('inventory.manualReconcile',{kind,changedItems:audit.changes.length,changes:audit.changes.map(c=>({item:c.item,delta:c.delta})),manualPotionLoss:audit.manualPotionLoss??0,source:'ingame-mining-audit',miningSuccess:'unknown'});
     publish();return true;
    },
    dispose(){if(disposed)return;disposed=true;
     try{halt('Entladen');}
     finally{
      try{bot.transport.close();}catch{}
      const released=cleanup.close();
      if(!released.closed)try{report.event('runtime.warning',{
       where:'boot-resource-cleanup',failures:released.failures});}catch{}
      try{panel?.remove();}catch{}
     }
    }
  };
  root.ALBot=api;panel=createPanel(bot,api);cleanup.add('on-destroy-hook',p.hook('on_destroy',()=>api.dispose()));
  // Read-only heartbeats also while paused allow a complete account balance
  // review and propagate an explicit release without resuming game actions.
  let guardTimer=null;function passiveGoldStatus(){if(disposed)return;if(!bot.running){try{bot.lossGuard?.sample();bot.transport.heartbeat();}catch(e){runtimeWarning('gold-status',e);}}guardTimer=root.setTimeout(passiveGoldStatus,2000);}
  if(cfg.merchant?.budgetMode==='account-loss')guardTimer=root.setTimeout(passiveGoldStatus,2000);
  cleanup.add('passive-gold-timer',()=>root.clearTimeout(guardTimer));
  report.setProvider(()=>{const previous=bot.diagnosticRead;bot.diagnosticRead=true;try{return ({test:cfg.general.testLogging!==undefined?'Vollbetrieb':cfg.production?.strategy?'P3/P4':cfg.world?'Live C':cfg.production?'Live B':'Live A',status:api.status(),schedulerTiming:{...schedulerTiming,meanMs:schedulerTiming.totalMs/Math.max(1,schedulerTiming.ticks)},runtimeMetrics:bot.metrics.status(),skillWakeups:bot.skillWakeups?.status(),potionUse:bot.potionReceipts?.status(),accountPhysicalStock:bot.accountStock?.snapshot(),impactIntents:bot.impactIntents.snapshot(),combatCapability:bot.combatAssessment?.status()??null,itemTransferRecovery:bot.recovery?.itemStatus?.()??null,objectives:bot.objectives?.status(),performanceTrick:{...performanceTrick},checkpointMode:checkpoint.durable?'persistent':'memory-consumption-only',movement:bot.movement.status(),transport:bot.transport.status(),party:{gameParty:p.c.party??null,teamLeader:bot.leader,selectedFarmers:[...bot.farmers]},bankPartial:bot.bank?.status(),logistics:bot.logistics.stats(),goldLogistics:bot.gold?.status(),lootReceipts:bot.lootReceipts?.status(),bankCapacity:bot.bank?.capacity(),production:bot.production?.status(),gear:bot.gear?.suggestions(),gearObservedStats:bot.gear?.observedPerformance?.()??[],gearTargets:bot.gear?.status(),economy:bot.economy?.ledger,market:bot.market?.status(),performance:bot.observations?.heartbeat(),luckySlots:bot.luckySlots?.status(),respawns:bot.respawns?.status(),strategy:bot.strategy?.status(),teamPlan:bot.teamPlan?.status(),encounter:bot.encounter?.status(),capabilities:bot.capabilities?.snapshot(),navigation:bot.navigation?.status(),economicIntelligence:bot.intelligence?.status(),learning:bot.learning.status(),adaptive:bot.adaptive?.status(),bosses:bot.bosses?.status(),marketDemand:bot.marketDemand?.status(),cloud:bot.cloud.status(),priority:bot.priority?.status(),recovery:bot.recovery?.status(),contentQuarantine:bot.content?.status(),threats:bot.threats?.status(),gearAllocation:bot.allocation?.status(),gearAllocationRecovery:bot.allocation?.recoveryStatus?.()??null,achievementProgression:bot.progression?.status(),account:bot.account?.status(),travel:bot.teamTravel?.status(),services:bot.services?.status(),merchantTask:bot.merchant?.status(),supplyForecast:bot.supplyForecast?.status(),settings:{general:cfg.general,farming:cfg.farming,party:cfg.party,merchant:cfg.merchant,production:cfg.production,world:cfg.world,rules:cfg.rules,characters:cfg.characters,skills:cfg.skills.slice(0,30),items:cfg.items.slice(0,80),omittedItemRules:Math.max(0,cfg.items.length-80)},equipment:bot.gear?.snapshot(),itemDecisions:cfg.general.testLogging?(p.c.items??[]).flatMap((i,slot)=>i?["inventory","acquisition","production"].map(phase=>{const r=bot.economy?.rules(i,phase);return {slot,item:i.name,level:i.level??0,phase,rule:r?.name??null,action:r?.action??"keep",priority:r?.priority,protected:protectedItem(i),reserved:bot.production?.observedReservation(i)??null,observation:'cached-not-dispatch-authority',remaining:!r||bot.economy.remaining(r),reason:protectedItem(i)?"Geschütztes Item":r?"Spezifität und Priorität; explizite Regel vor abgeleitetem Ziel":"Keine freigegebene Regel: behalten"};}):[]):undefined,inventory:(p.c.items??[]).map((i,slot)=>i?{slot,name:i.name,level:i.level??0,quantity:i.q??1,locked:!!i.l}:null).filter(Boolean)});}finally{bot.diagnosticRead=previous;}},()=>({status:{target:bot.target?.id??null,task:bot.reason},movement:{owner:bot.movement.order?.owner??null},merchantTask:{task:bot.reason},production:{goal:bot.production?.activeGoal?.name??null},account:{names:bot.farmers}}));
  if(!checkpoint.durable)bot.report('Speicher voll: Verbrauch wird im RAM abgeglichen; Lieferungen bleiben gesperrt. Testlog ohne localStorage.');
  p.log(VERSION+' · '+(p.headless?'Headless':'Browser')+' · '+me.role+' · '+(cfg.general.testLogging!==undefined?'Vollbetrieb':cfg.production?.strategy?'P3/P4':cfg.world?'Live C':cfg.production?'Live B':'Live A')+' Testkandidat');publish();if(cfg.general.autostart)api.start();return api;
}
