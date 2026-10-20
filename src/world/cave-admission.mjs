// N12/W12: conservative local preflight based on OFFICIAL generated_admission.
// This is not the server-side protocol check and deliberately performs no
// cave_enter(), cave_reply(), teleport, vote, or daily-attempt mutation.
const caveAdmissionBoundedName=n=>typeof n==='string'&&n.length>0&&n.length<=100;
const caveAdmissionSafeClock=n=>Number.isSafeInteger(n)&&n>0;
const caveAdmissionHexRun=n=>typeof n==='string'&&/^[a-f0-9]{24}$/.test(n);
const CAVE_ADMISSION_BASE={executable:false,serverVerified:false,requiresJournal:true};
const denyCaveAdmission=(reason,mode='none',extra={})=>({...CAVE_ADMISSION_BASE,mode,localConditionsMet:false,reason,...extra});

export function caveEntryPreflight({visit,realm,name,actor,partyNames,
 members,allowedNames,priorRun,now=Date.now()}={}){
 if(!caveAdmissionBoundedName(name)||!caveAdmissionBoundedName(realm)||!caveAdmissionSafeClock(now))
  return denyCaveAdmission('invalid-identity-or-clock');
 if(!visit||!caveAdmissionSafeClock(visit.observedAt)||
    !caveAdmissionSafeClock(visit.serverTime)||typeof visit.available!=='boolean'||
    now<visit.observedAt||now-visit.observedAt>30000||
    Math.abs(now-visit.serverTime)>300000)
  return denyCaveAdmission('fresh-cave-info-required');
 // Existing run always takes precedence over even an available daily visit.
 // A foreign server cannot be resumed via a local cave_enter() call.
 let mode='new',run=null;
 if(visit.resume){
  if(!caveAdmissionHexRun(visit.resume.run)||!caveAdmissionBoundedName(visit.resume.server))
   return denyCaveAdmission('invalid-resume-evidence');
  mode=visit.resume.server.replace(/\s+/g,'').toUpperCase()===
   realm.replace(/\s+/g,'').toUpperCase()?'resume':'remote-resume';
  run=visit.resume.run;
  if(mode==='remote-resume')
   return denyCaveAdmission('resume-on-another-server',mode,{run,server:visit.resume.server});
 }else if(visit.available!==true)
  return denyCaveAdmission('daily-visit-not-available');
 else if(priorRun)
  return denyCaveAdmission('prior-run-exit-unconfirmed','new',{
   previousRun:priorRun.run??null});
 // The official admission always applies to the *current* actor, including
 // resume. A visit alone cannot bypass alive, main-map and keeper checks.
 if(!actor||actor.name!==name||actor.map!=='main'||
    actor.in!==undefined&&actor.in!=='main'||actor.cave)
  return denyCaveAdmission('not-at-main-map',mode,{run});
 if(actor.rip===true||!Number.isFinite(actor.hp)||actor.hp<=0||
    actor.dc===true||actor.moving===true||actor.targets!==0)
  return denyCaveAdmission('actor-not-idle-and-alive',mode,{run});
 if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y)||
    Math.hypot(actor.x-816,actor.y-1200)>160)
  return denyCaveAdmission('not-at-cave-keeper',mode,{run});
 // The server's generated_return() checks generated_admission(player,[player]),
 // even when that player is still in a party. Only a NEW run recruits the
 // complete currently online party. Preserve that critical distinction.
 const rosterNames=mode==='resume'?[name]:partyNames;
 if(!Array.isArray(rosterNames)||rosterNames.length<1||
    rosterNames.length>3||new Set(rosterNames).size!==rosterNames.length||
    !rosterNames.includes(name)||rosterNames.some(n=>!caveAdmissionBoundedName(n)))
  return denyCaveAdmission('party-roster-not-proven',mode,{run});
 if(!Array.isArray(members)||new Set(members.map(m=>m?.name)).size!==members.length||
    (mode==='new'&&members.length!==rosterNames.length))
  return denyCaveAdmission('party-members-not-observed',mode,{run});
 const selected=new Set(Array.isArray(allowedNames)?allowedNames:[]);
 for(const memberName of rosterNames){
  if(!selected.has(memberName))return denyCaveAdmission('unselected-party-member',mode,{run,member:memberName});
  const m=members.find(p=>p?.name===memberName);
  if(!m||m.rip===true||!Number.isFinite(m.hp)||m.hp<=0||m.dc===true||
     m.moving===true||m.targets!==0||m.map!=='main'||
     m.in!==undefined&&m.in!=='main'||
     !Number.isFinite(m.x)||!Number.isFinite(m.y)||
     Math.hypot(m.x-816,m.y-1200)>160)
    return denyCaveAdmission('party-member-not-admissible',mode,{run,member:memberName});
 }
 return {...CAVE_ADMISSION_BASE,mode,run,party:[...rosterNames],
  localConditionsMet:true,reason:'local-preflight-only'};
}

// A party map from the current server is required to enumerate all members.
// Bot config alone cannot exclude a fourth unselected character from the
// server-generated party, so never infer the complete roster from it.
export function cavePartyObservation({name,party,partyMap}={}){
 if(!caveAdmissionBoundedName(name))return {verified:false,reason:'invalid-identity'};
 if(!party){
  if(partyMap&&typeof partyMap==='object'&&
     Object.keys(partyMap).some(n=>n!==name))
   return {verified:false,reason:'contradictory-party-observation'};
  return {verified:true,names:[name]};
 }
 if(!partyMap||typeof partyMap!=='object'||
    Array.isArray(partyMap))return {verified:false,reason:'party-roster-missing'};
 const names=Object.keys(partyMap);
 if(!names.includes(name)||names.length<1||names.length>3||
    names.some(n=>!caveAdmissionBoundedName(n)))
  return {verified:false,reason:'party-roster-not-proven'};
 return {verified:true,names};
}
