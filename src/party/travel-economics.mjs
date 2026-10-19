export function hopPenaltyDecision({character,from,to,home,automatic=false,
 pressureEscape=false}={}){
 if(!automatic||pressureEscape||character?.ctype==='merchant'||(character?.level??0)<60||
    !home||to===home||to===from)return {allowed:true,reason:'existing-hop-policy'};
 // Optional population scouting has no measured gain that justifies losing
 // 80% output for twelve ONLINE minutes or restarting the fatigue period.
 if(from===home||character?.s?.hopsickness||character?.s?.realmfatigue)
  return {allowed:false,reason:'unpriced-online-hop-penalty'};
 return {allowed:false,reason:'unpriced-optional-realm-change'};
}

// G04: compare the whole admitted roster before an OPTIONAL automatic hop.
// Missing or malformed peer evidence is not equivalent to a level-0 peer.
// This is a veto only; existing destination, safety and history gates remain.
export function accountHopPenaltyDecision({members=[],from,to,home,
 automatic=false,pressureEscape=false}={}){
 if(!automatic||pressureEscape)
  return {allowed:true,reason:'existing-hop-policy'};
 if(!Array.isArray(members)||members.length===0||members.length>8)
  return {allowed:false,reason:'account-hop-roster-unverified'};
 const seen=new Set();
 for(const row of members){
  const name=row?.name,character=row?.character;
  if(typeof name!=='string'||!name||seen.has(name)||
     typeof character!=='object'||!character||
     !Number.isSafeInteger(character.level)||character.level<1||
     typeof (character.ctype??character.class)!=='string'||
     !(character.ctype??character.class))
   return {allowed:false,reason:'member-hop-cost-unverified',member:name??null};
  seen.add(name);
  const decision=hopPenaltyDecision({character:{
    ...character,ctype:character.ctype??character.class
   },from,to,home,automatic,pressureEscape});
  if(!decision.allowed)return {allowed:false,
   reason:'member-'+decision.reason,member:name};
 }
 return {allowed:true,reason:'account-hop-cost-cleared'};
}
