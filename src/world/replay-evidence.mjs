// Phase 8 deterministic offline comparison from actual test-report samples.
// This is a *shadow reviewer*, never a policy actuator. Reported changes in
// gold and potions are net inventory deltas, not proven rewards/consumption.
const replayInteger=x=>Number.isSafeInteger(x)&&x>=0&&x<=1e12;
const replayIdentifier=x=>typeof x==='string'&&x.length>0&&x.length<=200;
const replayInvalid=reason=>({valid:false,reason,authority:'none',
 mode:'shadow-only',episodes:[],discarded:0});
export function extractReplayEpisodes(report,{
 minDurationMs=60000,maxGapMs=15000
}={}){
 if(!report||report.format!=='albot-test-report'||report.formatVersion!==1||
    !replayIdentifier(report.character)||!replayIdentifier(report.realm)||
    !replayIdentifier(String(report.gameVersion??''))||
    !Array.isArray(report.events)||report.events.length>50000||
    !replayInteger(report.dropped??0)||report.dropped>0||
    !replayInteger(minDurationMs)||minDurationMs<30000||
    !replayInteger(maxGapMs)||maxGapMs<5000||maxGapMs>60000)
  return replayInvalid('unverified-report-or-log-gap');
 const relevant=report.events.filter(x=>x?.type==='sample');
 let prevTime=-1,discarded=0,segment=[],episodes=[];
 const eligible=e=>e&&e.running===true&&e.rip===false&&
  e.inventoryBlocked===false&&e.valueActionPending===false&&e.task==='farm'&&
  replayIdentifier(e.farmArea)&&replayIdentifier(e.farmContext)&&
  replayIdentifier(e.map)&&replayInteger(e.level)&&
  replayInteger(e.xp)&&replayInteger(e.gold)&&
  replayInteger(e.hpPotions)&&replayInteger(e.mpPotions);
 function finish(){
  if(segment.length<2){segment=[];return;}
  const first=segment[0],last=segment.at(-1),
   durationMs=Date.parse(last.time)-Date.parse(first.time);
  if(durationMs<minDurationMs){discarded++;segment=[];return;}
  const xpDelta=last.xp-first.xp;
  if(xpDelta<0){discarded++;segment=[];return;}
  const identity=JSON.stringify([report.gameVersion,report.realm,
   report.character,first.farmContext,first.farmArea,first.map,first.level]);
  episodes.push({identity,character:report.character,realm:report.realm,
   gameVersion:report.gameVersion,context:first.farmContext,area:first.farmArea,
   map:first.map,level:first.level,started:first.time,ended:last.time,
   durationMs,samples:segment.length,xpDelta,goldNetDelta:last.gold-first.gold,
   hpPotionsNetDelta:last.hpPotions-first.hpPotions,
   mpPotionsNetDelta:last.mpPotions-first.mpPotions,
   detectedDeaths:0,deathEvidence:'not-observable-between-samples',
   consumptionEvidence:'net-stock-only'});
  segment=[];
 }
 for(const e of relevant){
  const ms=Date.parse(e.time);
  if(!Number.isFinite(ms)||ms<=prevTime){
   return replayInvalid('unordered-or-invalid-observation-time');
  }
  prevTime=ms;
  if(!eligible(e)){finish();discarded++;continue;}
  const old=segment.at(-1);
  if(old){
   const gap=ms-Date.parse(old.time);
   if(gap>maxGapMs||e.farmArea!==old.farmArea||
      e.farmContext!==old.farmContext||e.map!==old.map||
      e.level!==old.level||e.xp<old.xp){
    finish();
   }
  }
  segment.push(e);
  if(episodes.length>128)return replayInvalid('episode-count-overflow');
 }
 finish();
 if(episodes.length>128)return replayInvalid('episode-count-overflow');
 return {valid:true,authority:'none',mode:'shadow-only',
  source:{character:report.character,realm:report.realm,
   gameVersion:report.gameVersion,environment:report.environment??null},
  episodes,discarded};
}
export function compareReplayReports(baseline,candidate,{
 minimumEpisodes=3,minExposureMs=300000
}={}){
 const fail=(reason,details=null)=>({valid:false,reason,details,
  mode:'shadow-only',authority:'none',executable:false});
 if(!Array.isArray(baseline)||!Array.isArray(candidate)||
    !baseline.length||!candidate.length||
    baseline.length>12||candidate.length>12||
    !Number.isSafeInteger(minimumEpisodes)||minimumEpisodes<1||
    minimumEpisodes>20||!Number.isSafeInteger(minExposureMs)||
    minExposureMs<30000||minExposureMs>86400000)
  return fail('invalid-comparison-context');
 const inputs=[baseline,candidate].map(group=>group.map(extractReplayEpisodes));
 if(inputs.some(group=>group.some(result=>!result.valid)))
  return fail('invalid-input-report');
 const arms=inputs.map(group=>group.flatMap(x=>x.episodes));
 if(arms.some(x=>!x.length))return fail('insufficient-valid-episodes');
 const identities=[...new Set(arms.flatMap(g=>g.map(e=>e.identity)))];
 if(identities.length!==1)return fail('incomparable-team-gear-realm-or-spawn');
 const summarize=g=>{
  const durationMs=g.reduce((n,e)=>n+e.durationMs,0),
   xp=g.reduce((n,e)=>n+e.xpDelta,0),
   goldNet=g.reduce((n,e)=>n+e.goldNetDelta,0),
   hpNet=g.reduce((n,e)=>n+e.hpPotionsNetDelta,0),
   mpNet=g.reduce((n,e)=>n+e.mpPotionsNetDelta,0);
  return {episodes:g.length,durationMs,xp,xpPerHour:durationMs?xp*3600000/durationMs:0,
   goldNet,hpPotionsNet:hpNet,mpPotionsNet:mpNet,
   deaths:'unverified-from-periodic-samples',rewards:'net-not-attributed'};
 };
 const a=summarize(arms[0]),b=summarize(arms[1]),
  sufficient=[a,b].every(x=>x.episodes>=minimumEpisodes&&
   x.durationMs>=minExposureMs);
 return {valid:true,mode:'shadow-only',authority:'none',
  executable:false,context:identities[0],quality:sufficient?
   'comparable-observation':'insufficient-exposure',
  baseline:a,candidate:b,delta:{xpPerHour:b.xpPerHour-a.xpPerHour,
   goldNet:b.goldNet-a.goldNet},
  confidence:'unverified-causality',
  decision:'no-automatic-policy-change',
  reason:'Observed snapshots cannot prove gold sources, potion consumption or deaths'};
}
