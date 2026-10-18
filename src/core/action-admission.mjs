// Admission happens before Executor creates an owner or an economy journal.
// The server has a weighted four-second window (node/server.js CC/limits).
export function runtimeConditionGate(character,G,key,resources=[]){
 const active=Object.entries(character?.s??{}).filter(([,v])=>v&&
  !(Number.isFinite(v.ms)&&v.ms<=0)).map(([name])=>name);
 const blocked=active.find(name=>name==='stoned'||G?.conditions?.[name]?.blocked===true);
 const movement=resources.includes('movement'),attack=resources.includes('attack'),
  skill=resources.includes('mana')||resources.includes('skill')||/^(skill:|regen)/.test(key);
 if(blocked&&(movement||attack||skill))return {allowed:false,reason:'condition:'+blocked};
 if(active.includes('stunned')&&(movement||attack||skill))return {allowed:false,reason:'condition:stunned'};
 if(active.includes('silenced')&&skill)return {allowed:false,reason:'condition:silenced'};
 return {allowed:true,reason:'ready'};
}
export function publicCallCost(name,args=[]){
 const ordinary={move:2.5,smart_move:8,attack:1,heal:1,use_skill:1,
  equip:4,unequip:7,swap:1,imove:1,loot:4,open_chest:1.1,
  get_secondhands:17,get_players:13,get_tracker:51,
  buy:1,buy_with_gold:1,sell:1,upgrade:1,compound:1,craft:1,
  exchange:1,exchange_buy:1,bank_store:1,bank_retrieve:1,bank_swap:1,
  bank_deposit:1,bank_withdraw:1,send_item:1,send_gold:1,
  respawn:1,stop:1,town:1,change_target:.5,interact:1,
  activate:1,shift:1,cave_enter:1,cave_info:1,cave_reply:1,cave_exit:1,
  take_mail_item:1,trade_buy:1,trade_sell:1,trade:1,trade_offer:1,trade_swap:1,
  send_party_invite:1,send_party_request:1,accept_party_invite:1,accept_party_request:1,
  open_stand:1,close_stand:1,start_character:1,stop_character:1};
 if(name==='send_cm'){
  let length=0;try{length=JSON.stringify(args[1]).length;}catch{return 21;}
  const targets=Array.isArray(args[0])?args[0].length:1;
  // Conservative ordering: account for large messages even on servers which
  // retain the historical >100-before->1000 branch in the cost calculation.
  return 1+(length>50000?20:length>10000?10:length>1000?3:length>100?2:1)*
   targets*(targets>1?.8:1);
 }
 return ordinary[name]??0; // Pure CODE helpers never spend socket call budget.
}
export function createActionAdmission(bot,{now=()=>Date.now()}={}){
 const samples=[];let observed=0,observedAt=-Infinity,lastCC=null,sequence=0,observedSequence=0,denied=0,lastEvent=0;
 const ceiling=()=>bot.cfg.general.callCostCeiling??160;
 function sample(){
  const at=now(),cc=bot.p.c?.cc;
  while(samples.length&&at-samples[0].at>=4000)samples.shift();
  if(Number.isFinite(cc)&&cc>=0&&cc!==lastCC){observed=cc;observedAt=at;lastCC=cc;observedSequence=sequence;}
  // A stale snapshot cannot hold the bot forever after its calls age out.
  return Math.max(at-observedAt<4000?observed+samples.filter(row=>row.sequence>observedSequence).reduce((n,row)=>n+row.cost,0):0,
   samples.reduce((n,row)=>n+row.cost,0));
 }
 function defer(reason,key){
  denied++;if(now()-lastEvent>=5000){lastEvent=now();
   bot.event?.('action.deferred',{key,reason,cost:sample()});}
  return false;
 }
 function budget(key,cost=1){
  const critical=/^(potion|regen|respawn|heal|skill:(heal|partyheal|revive|scare))([.:_-]|$)/.test(key);
  return sample()+cost<=Math.min(190,ceiling()+(critical?24:0))||
   defer('call-cost-reserve',key);
 }
 return {
  allow(key,resources=[]){
   const gate=runtimeConditionGate(bot.p.c,bot.p.G,key,resources);
   const cost=/tracker/.test(key)?51:/ponty|secondhand/.test(key)?17:
    /unequip/.test(key)?7:/potion/.test(key)?8:/equip/.test(key)?4:
    key==='move'?8:/loot/.test(key)?4:1;
   return gate.allowed?budget(key,cost):defer(gate.reason,key);
  },
  allowCM(to,message){return budget('transport',publicCallCost('send_cm',[to,message]));},
  record(name,args){const cost=publicCallCost(name,args);
   if(cost>0){sample();samples.push({at:now(),cost,sequence:++sequence});if(samples.length>512)samples.shift();}},
  status:()=>({windowMs:4000,cost:sample(),ceiling:ceiling(),denied})
 };
}
