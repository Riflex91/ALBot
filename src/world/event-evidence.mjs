// Missing observations are uncertainty, explicit ended state is final.
// Keeping an activity during grace never grants permission for a new pull.
export function observeActivity(activity,live,visible,now,graceMs=2500){
 if(!activity)return {state:'absent'};
 if(activity.expires<=now||live&&(live.live===false||live.active===false||live.hp===0))
  return {state:'ended'};
 if(live||visible)return {state:'present'};
 const since=Number.isFinite(activity.missingSince)?activity.missingSince:now;
 return {state:now-since<graceMs?'unknown':'ended',missingSince:since};
}
