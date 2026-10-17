// Account-wide farm decisions must not rely on claimed but unavailable
// skills or arbitrarily free travel. These pure helpers preserve existing
// target/permitted-map safety gates; they cannot approve a new monster.
const spawnRoleSkills={
 heal:[['priest','heal']],
 aggro:[['warrior','taunt'],['warrior','agitate'],['paladin','taunt']],
 protect:[['mage','reflection'],['paladin','guardians_oath']],
 energize:[['mage','energize']],
 speed:[['rogue','rspeed']],
 mark:[['ranger','huntersmark']]
};
export function verifiedTeamRoleOwner(members,role,{now=Date.now(),ttlMs=10000,realm=null}={}){
 if(!Array.isArray(members)||members.length>8||
  !Array.isArray(spawnRoleSkills[role])||
  !Number.isFinite(now)||!Number.isFinite(ttlMs)||ttlMs<=0||ttlMs>120000)
  return null;
 const options=spawnRoleSkills[role],candidates=[];
 for(const c of members){
  const skills=c?.capabilities;
  if(realm!==null&&c?.realm!==realm)continue;
  if(!c?.running||c.rip||typeof c.name!=='string'||!c.name||
    !Number.isFinite(c.hp)||c.hp<=0||
    !Number.isFinite(c.max_hp)||c.max_hp<=0||
    !Number.isFinite(c.mp)||c.mp<0||
    !Number.isFinite(c.max_mp)||c.max_mp<=0||
    c.s?.stunned||c.s?.silenced||
    !Number.isFinite(skills?.at)||skills.at>now||
    now-skills.at>ttlMs||!Array.isArray(skills.ready))continue;
  const kind=c.ctype??c.class;
  const matched=options.find(([klass,id])=>klass===kind&&
   skills.ready.includes(id));
  if(!matched)continue;
  // A healer with insufficient MP for even a single cast cannot be a
  // designated farm healer. The local capability cache already verifies
  // skill cooldown and mana reservation for ready[].
  if(role==='heal'&&c.mp<=c.max_mp*.2)continue;
  candidates.push({name:c.name,skill:matched[1],
   mpRatio:c.mp/c.max_mp,hpRatio:c.hp/c.max_hp});
 }
 candidates.sort((a,b)=>b.hpRatio-a.hpRatio||
  b.mpRatio-a.mpRatio||a.name.localeCompare(b.name));
 return candidates[0]??null;
}
export function chooseFarmAreaSwitch({
 current,candidate,currentRank,now=Date.now(),holdMs=60000,
 improvement=.2,hasPriorityOrder=false
}={}){
 const result=(choice,reason,threshold=null)=>({choice,reason,threshold});
 if(!candidate)return result(currentRank??null,'no-approved-candidate');
 if(hasPriorityOrder||!current||!currentRank||
   currentRank.key!==current.key||candidate.key===current.key)
  return result(candidate,'no-ordinary-switch-needed');
 if(!Number.isFinite(now)||!Number.isFinite(current.started)||
  !Number.isFinite(holdMs)||holdMs<0||holdMs>3600000||
  !Number.isFinite(improvement)||improvement<0||improvement>2||
  !Number.isFinite(candidate.score)||candidate.score<0||
  !Number.isFinite(currentRank.score)||currentRank.score<0||
  !Number.isFinite(candidate.travelSeconds)||candidate.travelSeconds<0||
  !Number.isFinite(currentRank.travelSeconds)||currentRank.travelSeconds<0)
  return result(currentRank,'unverified-switch-evidence');
 if(now-current.started<holdMs)
  return result(currentRank,'hold-active');
 // Score already includes base trip friction. A new move additionally
 // consumes travel that the already occupied, validated spawn avoids.
 // Require a bounded improvement over the existing hysteresis threshold.
 const extraTravel=Math.max(0,candidate.travelSeconds-currentRank.travelSeconds);
 const extraImprovement=Math.min(.35,extraTravel/600);
 const threshold=1+improvement+extraImprovement;
 return candidate.score>currentRank.score*threshold?
  result(candidate,'evidence-supported-switch',threshold):
  result(currentRank,'switch-benefit-unproven',threshold);
}

// Unlike ordinary farming, priority monsterhunts previously bypassed ALL
// spawn hysteresis. They could ping-pong between two locations for the SAME
// monster every ten seconds as the travel score changed with position. Hold
// the verified quest location unless there is independent, sufficiently
// sampled evidence that another known spawn has lower pressure. Stable
// observation also enables the separate, guarded server-hop policy.
export function chooseHuntSpawn({
 current,currentRank,candidate,now=Date.now(),holdMs=180000
}={}){
 const keep=reason=>({choice:currentRank??null,reason,authority:'hunt-location-only'});
 if(!currentRank||!current||current.kind!=='hunt'||!candidate||
    currentRank.key!==current.key||candidate.target!==current.target)
  return {choice:candidate??null,reason:'new-or-invalid-hunt',authority:'hunt-location-only'};
 if(candidate.key===current.key)return keep('same-hunt-spawn');
 if(!Number.isFinite(now)||!Number.isFinite(current.started)||
    current.started>now||!Number.isFinite(holdMs)||
    holdMs<60000||holdMs>3600000)return keep('unverified-hunt-switch-context');
 if(now-current.started<holdMs)return keep('hunt-spawn-observation-hold');
 // Pressure is not proof merely because a server is busy, or because the
 // party has just arrived. Demand >=90s of observations on BOTH sites.
 const sufficient=row=>Number.isFinite(row?.evidenceSeconds)&&
  row.evidenceSeconds>=90&&Number.isFinite(row?.pressureRatio)&&
  row.pressureRatio>=0&&row.pressureRatio<=1;
 if(!sufficient(currentRank)||!sufficient(candidate))
  return keep('no-comparable-crowd-evidence');
 if(currentRank.pressureRatio<.65||candidate.pressureRatio>.3)
  return keep('stay-for-hunt-or-server-hop');
 if(!Number.isFinite(currentRank.score)||!Number.isFinite(candidate.score)||
    candidate.score<=currentRank.score*1.5)
  return keep('no-verified-spawn-advantage');
 return {choice:candidate,reason:'verified-less-crowded-hunt-spawn',
  authority:'hunt-location-only'};
}
