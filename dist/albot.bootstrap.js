// ALBot 0.52.0-candidate | Personalisiertes Profil vom 13.10.2026
globalThis.ALBotConfig={"general":{"name":"ALBot - Automatische Account-Erkennung","autostart":true,"environment":"auto","combatTickMs":250,"economyTickMs":2000,"planningTickMs":10000,"transport":"auto","allowRemoteCM":true,"maxPending":32,"messageTtlMs":10000,"ui":true,"pauseOnUnknown":true,"testLogging":true,"transferIntervalMs":250,"autonomousSetup":true,"autoRoster":true},"characters":[],"farming":{"enabled":true,"targets":["goo","bee"],"mode":"balanced","autoTravel":true,"loot":true,"lootEveryMs":1000,"freeSlots":3,"hpBelow":0.7,"mpBelow":0.5,"restBelow":0.4,"resumeAbove":0.85,"potions":true,"respawn":true,"respawnDelayMs":15000,"maxDeaths":3,"deathWindowMs":600000,"kiting":true,"rangeBuffer":15,"maxAggro":12,"avoidOthers":true,"pvp":false,"autoTargets":true,"elixirs":true,"switchImprovement":0.45,"planHoldMs":300000,"maxCombatSeconds":45,"adaptivePull":true,"pullHp":0.75,"pullMp":0.3,"potionUtilization":0.65,"orbit":true,"orbitRadius":220,"knowledgeFreshMs":21600000,"potionCarryMax":10000},"party":{"enabled":true,"group":"team1","leader":"","merchant":"","selection":"adaptive","maxFarmers":3,"followDistance":180,"focusFire":true,"waitForTeam":true,"healing":true,"energize":true,"buffs":true,"revive":true,"aoe":true,"aoeMaxTargets":5,"rotationCooldownMs":60000,"balanceFarmers":true,"balanceLevelGap":2,"balanceHoldMs":1800000,"aura":"auto","auraHoldMs":30000,"gearSynergy":true,"advancedSkills":true},"skills":[{"name":"Neue Skill-Regel","enabled":true,"skill":"3shot","class":"ranger","character":"","priority":1,"target":"enemy","minMp":0.2,"maxTargets":15,"everyMs":100,"conditions":[],"minTargets":2,"minInjured":2,"hpThreshold":0.7,"manaBudget":0.2}],"merchant":{"enabled":true,"goldReserve":100000,"maxSpendPerHour":5000000,"pickup":true,"supply":true,"maxDelivery":3000,"minFreeSlots":4,"position":{"enabled":false,"map":"main","x":0,"y":0},"stand":true,"mluck":true,"mluckOthers":false,"massBuffs":true,"bank":true,"consolidate":true,"expandBank":true,"bankBudget":500000,"bankGold":true,"goldTarget":200000,"partialBank":true,"partialBankMaxStack":9999,"taskHoldMs":300000,"starvationMs":120000,"ponty":true,"pontyMaxSpend":100000,"bargainRatio":0.65,"giveaways":true,"merrit":true,"fishing":false,"mining":false,"toolBudget":10000,"marketHistory":true,"marketHistoryTtlMs":21600000,"serviceSliceMs":30000,"collectGold":true,"goldTransferMax":100000,"goldCollectBelow":10000,"bankWorkspace":2,"bankReclaim":true,"pickupThreshold":30,"bankExpandGoldFraction":0.75,"marketMinSamples":3,"mluckTravel":true,"townTravel":true,"townMinSavingsMs":3000,"servicePositionError":70,"discoverOwnFarmers":true,"hpPotionTarget":3000,"mpPotionTarget":3000,"autoMarket":true,"listingTtlMs":3600000,"potionTeamRefill":true,"potionAlertBelow":50,"budgetMode":"account-loss","accountLossWindowMs":900000,"offlineGoldBalances":[{"name":"My_Mage","gold":0},{"name":"My_Priest","gold":0},{"name":"My_Rogue","gold":0},{"name":"My_Warrior","gold":0}],"preventiveStorage":true,"storageFreeSlots":8,"storageTargetSlots":12,"storageReplacementMinutes":60},"items":[{"name":"Farmer fordert HP-Tränke nach","enabled":true,"priority":0,"item":"hpot0","role":"farmer","character":"","minLevel":0,"maxLevel":99,"statType":"","property":"","title":"","map":"","server":"","task":"","action":"consume","keep":0,"targetCount":3050,"requestBelow":50,"maxCount":10000,"batch":3000,"recipient":"","teamReserve":0,"maxActions":0,"minPrice":1,"maxPrice":1000,"priceSource":"fixed","goldBudget":10000,"lossBudget":0,"targetLevel":1,"scroll":"","offering":"","minChance":1,"recipe":"","pack":"","slot":"","fallback":"hold","ttlMs":120000},{"name":"Farmer fordert MP-Tränke nach","enabled":true,"priority":0,"item":"mpot0","role":"farmer","character":"","minLevel":0,"maxLevel":99,"statType":"","property":"","title":"","map":"","server":"","task":"","action":"consume","keep":0,"targetCount":3050,"requestBelow":50,"maxCount":10000,"batch":3000,"recipient":"","teamReserve":0,"maxActions":0,"minPrice":1,"maxPrice":1000,"priceSource":"fixed","goldBudget":10000,"lossBudget":0,"targetLevel":1,"scroll":"","offering":"","minChance":1,"recipe":"","pack":"","slot":"","fallback":"hold","ttlMs":120000}],"production":{"enabled":true,"upgrade":true,"compound":true,"exchange":true,"craft":true,"gear":true,"offlineProfiles":true,"minImprovement":0.05,"lossBudget":250000,"minChance":0.65,"maxChainDepth":8,"maxFarmHours":12,"acquireBy":["bank","npc","farm","craft","exchange","market"],"goals":[],"autonomy":true,"strategy":"balanced","fallbackKillsPerHour":20,"goldPerHour":100000,"travelSpeed":50,"helperMaxPrice":100000,"gearTargets":[],"progressionAdvice":true,"autoGear":true,"autoGearMaxLevel":5,"autoGearBudget":100000,"autoGearItems":["helmet","coat","pants","shoes","gloves","bow","staff","sword","blade","shield"],"autoProfitMaxLevel":5,"optimizeGear":true,"autoDisposition":true,"autoSellMaxValue":100,"autoGearSellMaxValue":1000000,"farmConfidence":"p90","materialPreference":1.25,"materialXpPerGold":10,"skillSupplies":true,"skillSupplyCount":20,"tokenBuy":true,"tokenMaxPerPurchase":1,"dismantle":true,"autoHelpers":true,"purposeAllocation":true,"finiteHelpers":true},"world":{"bosses":true,"events":true,"quests":true,"anniversary":true,"allowedBosses":[],"allowedEvents":[],"excludedMaps":[],"risk":"assertive","serverHop":true,"allowedRealms":["EUI","EUII","EUIII","EUIV","EUV","EUVI","EUVII","EUVIII","EUIX","EUX","USI","USII","USIII","USIV","USV","USVI","USVII","USVIII","USIX","USX"],"hopCooldownMs":300000,"homeRealm":"EUII","homeRetryMs":600000,"homeCheckMs":90000,"homePressureThreshold":0.65,"magiport":true,"learning":true,"learningWeight":0.15,"cacheTtlMs":60000,"questTargets":true,"autoHop":true,"questPreference":1.1,"bossTactics":true,"bossMaxSeconds":300,"adaptiveLearning":true},"rules":[{"name":"Live C: gesund zu Bee wechseln","enabled":false,"priority":0,"role":"farmer","character":"","everyMs":2000,"cooldownMs":60000,"match":"all","conditions":[{"field":"hpRatio","operator":"gte","value":"0.95","item":""},{"field":"freeSlots","operator":"gte","value":"6","item":""}],"action":"farm","target":"bee","amount":1}]};
/* ALBot bootstrap v1 · SHA-256 pinned */
(function(root){"use strict";
 const url="https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js",expected="1fa7953fc23225d5394725e05e6791b5f2211679908f5ca2babe505b07743055";
 const report=(phase,reason)=>{root.ALBotBootstrapStatus={phase,reason:reason??null,url,expectedSha256:expected}};
 report("loading");
 const task=(async()=>{
  if(typeof root.fetch!=="function"||!root.crypto?.subtle||
     typeof root.TextDecoder!=="function"||typeof root.AbortController!=="function")
   throw Error("Browser lacks fetch, SHA-256 or AbortController");
  const ctrl=new root.AbortController();
  const timer=root.setTimeout?.(()=>ctrl.abort(),15000);
  try{
   const response=await root.fetch(url,{method:"GET",mode:"cors",
    credentials:"omit",cache:"no-store",signal:ctrl.signal});
   if(!response.ok)throw Error("Runtime HTTP "+response.status);
   const raw=await response.arrayBuffer();
   if(raw.byteLength===0||raw.byteLength>8388608)
    throw Error("Unexpected runtime byte length");
   const hash=Array.from(new Uint8Array(
    await root.crypto.subtle.digest("SHA-256",raw)),x=>
    x.toString(16).padStart(2,"0")).join("");
   if(hash!==expected)throw Error("Runtime SHA-256 mismatch; refusing execution");
   const source=new root.TextDecoder("utf-8",{fatal:true}).decode(raw);
   if(!source.startsWith("/* ALBot "))
    throw Error("Unexpected runtime header");
   // Global eval runs in the existing CODE runner, never in a new closure.
   (0,eval)(source);
   const state=root.ALBot?.status?.();
   if(!state)throw Error("ALBot runtime did not expose status");
   if(root.ALBotConfig?.general?.autostart===true&&state.running!==true)
    throw Error("ALBot autostart refused: "+(state.reason??"unknown reason"));
   report(state.running===true?"running":"loaded");
   try{root.game_log?.("ALBot Bootstrap: SHA-256 OK; Autostart "+
     (state.running===true?"AKTIV":"inaktiv"));}catch{}
   return true;
  }finally{if(timer!==undefined)root.clearTimeout?.(timer);}
 })();
 root.ALBotBootstrapReady=task;
 task.catch(e=>{
  report("blocked",String(e?.message??e));
  root.console?.error?.("[ALBot bootstrap]",e);
  try{root.game_log?.("ALBot Bootstrap blockiert: "+e.message);}catch{}
 });
})(globalThis);
