// Merchant depot stages often need only a confirmed journal settlement and
// the next scheduler frame. Do not impose the separate 2-second economy
// planning cadence on each already-admitted, local depot stage. This changes
// ONLY when the merchant planner is polled, not cooldowns, rate limits,
// journals, confirmation timeouts, retry logic, or action authorization.
export function merchantActionDue({
 now,last,normalDue,depotActive,merchant,hasPending,
 blocked,moving,fastIntervalMs=750
}={}){
 if(normalDue===true)return true;
 if(merchant!==true||depotActive!==true||hasPending!==false||
    blocked!==false||moving!==false||
    !Number.isFinite(now)||!Number.isFinite(last)||last>now||
    !Number.isSafeInteger(fastIntervalMs)||fastIntervalMs<500||
    fastIntervalMs>2000)return false;
 return now-last>=fastIntervalMs;
}
