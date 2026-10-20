// N12/W12: conservative local preflight based on OFFICIAL generated_admission.
// This is not the server-side protocol check and deliberately performs no
// cave_enter(), cave_reply(), teleport, vote, or daily-attempt mutation.
const boundedName=n=>typeof n==='string'&&n.length>0&&n.length<=100;
const safeClock=n=>Number.isSafeInteger(n)&&n>0;
const hexRun=n=>typeof n==='string'&&/^[a-f0-9]{24}$/.test(n);
const BASE={executable:false,serverVerified:false,requiresJournal:true};
const deny=(reason,mode='none',extra={})=>({...BASE,mode,localConditionsMet:false,reason,...extra});

export function caveEntryPreflight({visit,realm,name,actor,partyNames,
 members,allowedNames,priorRun,now=Date.now()}={}){
 if(!boundedName(name)||!boundedName(realm)||!safeClock(now))
  return deny('invalid-identity-or-clock');
 if(!visit||!safeClock(visit.observedAt)||
    !safeClock(visit.serverTime)||typeof visit.available!=='boolean'||
    now<visit.observedAt||now-visit.observedAt>30000||
    Math.abs(now-visit.serverTime)>300000)
  return deny('fresh-cave-info-required');
 // Existing run always takes precedence over even an available daily visit.
 // A foreign server cannot be resumed via a local cave_enter() call.
 let mode='new',run=null;
 if(visit.resume){
  if(!hexRun(visit.resume.run)||!boundedName(visit.resume.server))
   return deny('invalid-resume-evidence');
  mode=visit.resume.server.replace(/\s+/g,'').toUpperCase()===
   realm.replace(/\s+/g,'').toUpperCase()?'resume':'remote-resume';
  run=visit.resume.run;
  if(mode==='remote-resume')
   return deny('resume-on-another-server',mode,{run,server:visit.resume.server});
 }else if(visit.available!==true)
  return deny('daily-visit-not-available');
 else if(priorRun)
  return deny('prior-run-exit-unconfirmed','new',{
   previousRun:priorRun.run??null});
 // The official admission always applies to the *current* actor, including
 // resume. A visit alone cannot bypass alive, main-map and keeper checks.
 if(!actor||actor.name!==name||actor.map!=='main'||
    actor.in!==undefined&&actor.in!=='main'||actor.cave)
  return deny('not-at-main-map',mode,{run});
 if(actor.rip===true||actor.hp<=0||actor.dc===true||
    actor.moving===true||actor.targets!==0)
  return deny('actor-not-idle-and-alive',mode,{run});
 if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y)||
    Math.hypot(actor.x-816,actor.y-1200)>160)
  return deny('not-at-cave-keeper',mode,{run});
 if(!Array.isArray(partyNames)||partyNames.length<1||
    partyNames.length>3||new Set(partyNames).size!==partyNames.length||
    !partyNames.includes(name)||partyNames.some(n=>!boundedName(n)))
  return deny('party-roster-not-proven',mode,{run});
 if(mode==='resume'&&partyNames.length!==1)
  return deny('resume-requires-solo-admission',mode,{run});
 if(!Array.isArray(members)||members.length!==partyNames.length||
    new Set(members.map(m=>m?.name)).size!==members.length)
  return deny('party-members-not-observed',mode,{run});
 const selected=new Set(Array.isArray(allowedNames)?allowedNames:[]);
 for(const memberName of partyNames){
  if(!selected.has(memberName))return deny('unselected-party-member',mode,{run,member:memberName});
  const m=members.find(p=>p?.name===memberName);
  if(!m||m.rip===true||m.hp<=0||m.dc===true||
     m.moving===true||m.targets!==0||m.map!=='main'||
     m.in!==undefined&&m.in!=='main'||
     !Number.isFinite(m.x)||!Number.isFinite(m.y)||
     Math.hypot(m.x-816,m.y-1200)>160)
    return deny('party-member-not-admissible',mode,{run,member:memberName});
 }
 return {...BASE,mode,run,party:[...partyNames],
  localConditionsMet:true,reason:'local-preflight-only'};
}

// A party map from the current server is required to enumerate all members.
// Bot config alone cannot exclude a fourth unselected character from the
// server-generated party, so never infer the complete roster from it.
export function cavePartyObservation({name,party,partyMap}={}){
 if(!boundedName(name))return {verified:false,reason:'invalid-identity'};
 if(!party){
  if(partyMap&&typeof partyMap==='object'&&Object.keys(partyMap).length>1)
   return {verified:false,reason:'contradictory-party-observation'};
  return {verified:true,names:[name]};
 }
 if(!partyMap||typeof partyMap!=='object'||
    Array.isArray(partyMap))return {verified:false,reason:'party-roster-missing'};
 const names=Object.keys(partyMap);
 if(!names.includes(name)||names.length<1||names.length>3||
    names.some(n=>!boundedName(n)))
  return {verified:false,reason:'party-roster-not-proven'};
 return {verified:true,names};
}
