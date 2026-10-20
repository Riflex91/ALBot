// W12/N12: source-backed READ-ONLY Cave dialogue vote preflight.
// The public cave_reply(choice,option) requires a separate durable
// one-shot vote journal before any automatic or explicit dispatch.
const caveVoteSafeTime=n=>Number.isSafeInteger(n)&&n>0;
const caveVoteLabel=s=>typeof s==='string'&&s.length>0&&s.length<=100;
const caveVoteDeny=(reason,details={})=>({
 version:1,mode:'read-only-cave-vote',executable:false,
 canVote:false,serverVerified:false,requiresJournal:true,
 localConditionsMet:false,reason,...details
});
export function caveVotePreflight({
 cave,lifecycle,name,optionId=null,now=Date.now()
}={}){
 if(!caveVoteSafeTime(now)||!caveVoteLabel(name))
  return caveVoteDeny('invalid-identity-or-clock');
 const live=cave?.live,j=lifecycle?.journal;
 // Current server map and a separately durable observed-run record
 // must name the SAME run, character and realm. A dispatched or
 // ambiguous Cave exit is never vote-eligible.
 if(!live||!j||lifecycle.state!=='live-observed'||
    j.phase!=='observed-run'||j.name!==name||
    j.realm!==cave?.realm||j.observed?.run!==live.run)
  return caveVoteDeny('current-journaled-run-required');
 if(!caveVoteSafeTime(live.serverTime)||
    now<live.serverTime||now-live.serverTime>3000)
  return caveVoteDeny('fresh-server-choice-required',{run:live.run});
 const self=live.roster?.find(m=>m.name===name);
 if(!self||self.left||self.disconnected)
  return caveVoteDeny('active-party-member-required',{run:live.run});
 if(live.paused!==true)
  return caveVoteDeny('run-not-paused-for-vote',{run:live.run});
 const choice=live.choice;
 if(!choice)
  return caveVoteDeny('no-current-choice',{run:live.run});
 if(choice.resolved===true)
  return caveVoteDeny('vote-already-resolved',{run:live.run,choiceId:choice.id});
 if(!caveVoteSafeTime(choice.deadline)||!choice.votes||
    typeof choice.votes!=='object'||Array.isArray(choice.votes))
  return caveVoteDeny('choice-proof-incomplete',{run:live.run,choiceId:choice.id});
 // The server's deadline is an absolute timestamp, including while
 // paused. Neither the paused remaining_ms nor a UI countdown is proof.
 if(choice.deadline<=now+2000)
  return caveVoteDeny('vote-deadline-too-close',{run:live.run,choiceId:choice.id});
 if(Object.hasOwn(choice.votes,name))
  return caveVoteDeny('already-voted',{run:live.run,choiceId:choice.id,
   existingOption:choice.votes[name]});
 const options=(choice.options??[]).map(o=>({
  optionId:o.id,available:o.available,
  goldCost:o.goldCost,amberCost:o.amberCost,
  affordable: Number.isSafeInteger(live.gold)&&Number.isSafeInteger(live.amber)&&
   o.goldCost<=live.gold&&o.amberCost<=live.amber
 }));
 const common={run:live.run,choiceId:choice.id,deadline:choice.deadline,
  observedAt:live.observedAt??null,options};
 if(!caveVoteLabel(optionId))
  return caveVoteDeny('explicit-option-required',common);
 const selected=options.find(o=>o.optionId===optionId);
 if(!selected)return caveVoteDeny('unknown-option',common);
 if(!selected.available)return caveVoteDeny('option-unavailable',common);
 if(!selected.affordable)return caveVoteDeny('insufficient-cave-purse',common);
 // cave_snapshot does NOT expose vote.voters (server-side real_id list).
 // This is a local preflight, not an authorized or dispatched vote.
 return {...caveVoteDeny('local-vote-preflight-only',common),
  optionId,localConditionsMet:true};
}
export function createCaveVoteEvidence(bot,{now=()=>Date.now()}={}){
 function check(optionId=null){
  const cave=bot.cave?.status?.()??null;
  const lifecycle=bot.caveLifecycle?.status?.()??null;
  return caveVotePreflight({cave,lifecycle,name:bot.me?.name,
   optionId,now:now()});
 }
 return {status:()=>check(null),preflight:optionId=>check(optionId)};
}
