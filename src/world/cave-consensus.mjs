// W12/N12: read-only peer consensus for a three-member Cave run.
// Never calls prepareCaveVote, cave_reply, navigation, combat or spending.
const caveConsensusPositive=n=>Number.isSafeInteger(n)&&n>0;
const caveConsensusNonnegative=n=>Number.isSafeInteger(n)&&n>=0;
const caveConsensusLabel=s=>typeof s==='string'&&s.length>0&&s.length<=100;
const caveConsensusBase={version:1,mode:'read-only-team-consensus',
 executable:false,canVote:false,autoVote:false,
 candidateForReview:false,serverVerified:false,requiresJournal:true};
const caveConsensusDeny=(reason,extra={})=>({...caveConsensusBase,reason,...extra});

export function planCaveGroupVote({
 cave,lifecycle,voteJournal,name,now=Date.now(),checkOption,
 policy={}
}={}){
 if(!caveConsensusLabel(name)||!caveConsensusPositive(now))
  return caveConsensusDeny('invalid-identity-or-clock');
 if(!policy||typeof policy!=='object'||Array.isArray(policy))
  return caveConsensusDeny('invalid-budget-policy');
 const maxGoldCost=policy.maxGoldCost??0,
  maxAmberCost=policy.maxAmberCost??0,
  minGoldReserve=policy.minGoldReserve??0,
  minAmberReserve=policy.minAmberReserve??0;
 if(![maxGoldCost,maxAmberCost,minGoldReserve,minAmberReserve]
   .every(caveConsensusNonnegative))
  return caveConsensusDeny('invalid-budget-policy');
 const live=cave?.live,entry=lifecycle?.journal;
 if(!live||lifecycle?.state!=='live-observed'||
    entry?.phase!=='observed-run'||entry?.name!==name||
    entry?.realm!==cave.realm||entry?.observed?.run!==live.run)
  return caveConsensusDeny('current-durable-run-required');
 if(!caveConsensusPositive(live.serverTime)||now<live.serverTime||
    now-live.serverTime>3000)
  return caveConsensusDeny('fresh-server-observation-required',{run:live.run});
 if(voteJournal?.state==='vote-observed'){
  const prior=voteJournal.journal;
  if(prior?.run!==live.run||prior?.realm!==cave.realm||
     prior?.name!==name)
   return caveConsensusDeny('vote-history-scope-mismatch',{run:live.run});
 }else if(voteJournal?.state!=='empty')
  return caveConsensusDeny('vote-journal-blocked',{run:live.run,
   journalState:voteJournal?.state??'missing'});
 const choice=live.choice;
 if(live.paused!==true||!choice||choice.resolved!==false||
    !caveConsensusPositive(choice.deadline)||
    choice.deadline<=now+5000||!caveConsensusLabel(choice.id)||
    !Array.isArray(choice.options)||!choice.votes||
    typeof choice.votes!=='object'||Array.isArray(choice.votes))
  return caveConsensusDeny('current-open-choice-required',{run:live.run});
 if(voteJournal?.state==='vote-observed'&&
    voteJournal.journal?.choiceId===choice.id)
  return caveConsensusDeny('own-choice-already-recorded',{run:live.run,
   choiceId:choice.id});
 if(choice.danger!==false)
  return caveConsensusDeny(choice.danger===true?
   'server-danger-flagged':'unknown-encounter-risk',
   {run:live.run,choiceId:choice.id,danger:choice.danger??null});
 const roster=live.roster;
 // Only a complete original three-person group counts as consensus.
 if(!Array.isArray(roster)||roster.length!==3||
    new Set(roster.map(m=>m?.name)).size!==3||
    !roster.some(m=>m?.name===name)||
    roster.some(m=>!caveConsensusLabel(m?.name)||
     m?.left!==false||m?.disconnected!==false))
  return caveConsensusDeny('complete-active-three-person-team-required',
   {run:live.run,choiceId:choice.id});
 if(Object.hasOwn(choice.votes,name))
  return caveConsensusDeny('own-vote-already-present',{run:live.run,
   choiceId:choice.id});
 const peers=roster.filter(m=>m.name!==name).map(m=>m.name);
 if(peers.some(n=>!Object.hasOwn(choice.votes,n)||
    !caveConsensusLabel(choice.votes[n])))
  return caveConsensusDeny('waiting-for-two-peer-votes',{run:live.run,
   choiceId:choice.id});
 const selectedId=choice.votes[peers[0]];
 if(selectedId!==choice.votes[peers[1]])
  return caveConsensusDeny('peer-votes-disagree',{run:live.run,
   choiceId:choice.id,peers});
 const option=choice.options.find(o=>o?.id===selectedId);
 if(!option||option.available!==true||
    !caveConsensusNonnegative(option.goldCost)||
    !caveConsensusNonnegative(option.amberCost)||
    !caveConsensusNonnegative(live.gold)||
    !caveConsensusNonnegative(live.amber))
  return caveConsensusDeny('consensus-option-unavailable',{run:live.run,
   choiceId:choice.id,peers});
 const common={run:live.run,choiceId:choice.id,optionId:selectedId,
  danger:false,peers,
  goldCost:option.goldCost,amberCost:option.amberCost,
  goldBalance:live.gold,amberBalance:live.amber,
  deadline:choice.deadline,
  policy:{maxGoldCost,maxAmberCost,minGoldReserve,minAmberReserve}};
 if(option.goldCost>maxGoldCost||option.amberCost>maxAmberCost||
    option.goldCost>live.gold||option.amberCost>live.amber||
    live.gold-option.goldCost<minGoldReserve||
    live.amber-option.amberCost<minAmberReserve)
  return caveConsensusDeny('team-choice-exceeds-budget',common);
 if(typeof checkOption!=='function')
  return caveConsensusDeny('local-vote-preflight-unavailable',common);
 let result;
 try{result=checkOption(selectedId);}catch{
  return caveConsensusDeny('local-vote-preflight-failed',common);
 }
 if(!result||result.localConditionsMet!==true||
    result.executable!==false||result.canVote!==false||
    result.requiresJournal!==true||result.serverVerified!==false||
    result.run!==live.run||result.choiceId!==choice.id||
    result.optionId!==selectedId||result.deadline!==choice.deadline)
  return caveConsensusDeny('local-vote-preflight-rejected',common);
 return {...caveConsensusDeny('unanimous-peer-option-for-manual-review',common),
  candidateForReview:true};
}

export function createCaveConsensus(bot,{now=()=>Date.now()}={}){
 function preview(policy={}){
  return planCaveGroupVote({
   cave:bot.cave?.status?.()??null,
   lifecycle:bot.caveLifecycle?.status?.()??null,
   voteJournal:bot.caveVoteJournal?.status?.()??null,
   checkOption:id=>bot.caveVote?.preflight?.(id),
   name:bot.me?.name,now:now(),policy
  });
 }
 return {status:()=>preview(),preview};
}
