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
