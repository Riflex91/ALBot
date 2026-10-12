import {knowledgeFingerprint} from './knowledge.mjs';
// Measured, context-bound adjustments only. Never changes action permissions.
export function createAdaptive(bot){
 const {p}=bot,key='albot:adaptive:v1:'+bot.me.name;let rows=[],faults=[],proposals=[],lastSave=0,dirty=false,cachedEpoch=-1,cachedContext='',lastAdvice='';
 const context=()=>{if(bot.running&&Number.isInteger(bot.decisionEpoch)&&cachedEpoch===bot.decisionEpoch)return cachedContext;
  cachedEpoch=bot.decisionEpoch;return cachedContext=knowledgeFingerprint([p.G.version,p.G.monsters,p.realm(),bot.cfg.farming?.mode,bot.farmers?.map(n=>[n,n===bot.me.name?bot.gear?.snapshot():bot.transport.fresh(n)?.gear])]);};
 const valid=r=>r&&typeof r.target==='string'&&typeof r.context==='string'&&
  ['samples','failures','seconds','reward','at'].every(k=>Number.isFinite(r[k])&&r[k]>=0)&&r.samples<=10000&&r.failures<=r.samples&&r.at<=Date.now();
 const saved=p.read(key);if(saved?.version===1&&Array.isArray(saved.rows))rows=saved.rows.filter(valid).slice(-32);
 function episode({target,seconds,reward=0,failed=false,contextKey=null}){
  if(!p.G.monsters?.[target]||!Number.isFinite(seconds)||seconds<1||seconds>3600||!Number.isFinite(reward)||reward<0||!failed&&!reward)return false;
  const ctx=context();if(contextKey&&contextKey!==ctx)return false;let row=rows.find(r=>r.target===target&&r.context===ctx);
  if(!row){row={target,context:ctx,samples:0,failures:0,seconds:0,reward:0,at:0};rows.push(row);rows=rows.slice(-32);}
  row.samples=Math.min(10000,row.samples+1);row.failures=Math.min(row.samples,row.failures+(failed?1:0));row.seconds+=seconds;row.reward+=reward;row.at=Date.now();
  // A bad subsequent episode rolls a speculative positive recommendation back.
  if(failed)proposals=proposals.filter(x=>x.target!==target);dirty=true;return true;
 }
 function factor(target){
  if(bot.cfg.world?.adaptiveLearning!==true)return 1;
  const ctx=context(),r=rows.find(x=>x.target===target&&x.context===ctx&&Date.now()-x.at<86400000);
  const learned=!r||r.samples<3?1:Math.max(.5,1-r.failures/r.samples);
  const proposal=proposals.find(x=>x.target===target&&x.context===ctx&&x.expires>Date.now());
  const pathFailures=faults.filter(f=>f.context===ctx&&f.target===target&&f.type==='movement.failed'&&Date.now()-f.at<600000).length;
  return learned*(proposal?.factor??1)*(pathFailures>=2?.75:1);
 }
 function accept(value){
  if(bot.cfg.world?.adaptiveLearning!==true||!Array.isArray(value)||value.length>5)return false;
  const ctx=context(),now=Date.now(),next=[];
  for(const x of value){
   if(!x||Object.keys(x).some(k=>!['target','factor','context','expires'].includes(k))||x.context!==ctx||
    !Number.isFinite(x.factor)||x.factor<.5||x.factor>1.1||!Number.isFinite(x.expires)||x.expires<=now||x.expires>now+3600000||
    !bot.teamPlan?.candidates().includes(x.target)||bot.strategy?.safeTarget(x.target,undefined,true,true)!==true)return false;
   const r=rows.find(r=>r.target===x.target&&r.context===ctx);
   if(!r||r.samples<5||x.factor>1&&(r.failures>0||r.reward<=0))return false;
   next.push({...x});
  }
  proposals=next;return true;
 }
 function fault(type,data){if(!['movement.failed','strategy.failedTarget','production.wait'].includes(type))return;
  faults.push({type,target:String(data?.target??bot.target?.mtype??bot.teamPlan?.target?.()??'').slice(0,64),context:context(),at:Date.now()});faults=faults.slice(-24);
 }
 function tick(){
  const merchant=bot.cfg.party?.merchant;if(!merchant||bot.cfg.world?.adaptiveLearning!==true)return;
  const peer=merchant===bot.me.name?null:bot.transport.fresh(merchant);
  const advice=merchant===bot.me.name?bot.cloud?.advice():peer?.running&&peer.realm===p.realm()?peer.advice:null;
  if(!Array.isArray(advice)||advice.length>4)return;
  const own=advice.find(x=>x?.character===bot.me.name);if(!own||!Array.isArray(own.proposals)||own.proposals.length>5)return;
  const stamp=JSON.stringify(own);if(stamp===lastAdvice)return;
  if(accept(own.proposals))lastAdvice=stamp;
 }
 function flush(force=false){if(!dirty||!force&&Date.now()-lastSave<30000)return;lastSave=Date.now();if(p.write(key,{version:1,rows}))dirty=false;}
 function restore(value){if(!value||value.version!==1||!Array.isArray(value.rows)||value.rows.length>32||!value.rows.every(valid))return false;
  const next=value.rows.filter(r=>r.context===context()&&Date.now()-r.at<86400000);
  // Existing local evidence wins. Cloud never restores journals or proposals.
  const merged=[...rows,...next.filter(r=>!rows.some(l=>l.context===r.context&&l.target===r.target))].slice(-32);
  if(!p.write(key,{version:1,rows:merged}))return false;rows=merged;return true;
 }
 return {episode,factor,accept,fault,tick,flush,restore,context,
  snapshot:()=>({version:1,rows:rows.filter(r=>r.context===context()).slice(-4)}),
  status:()=>({context:context(),rows:rows.map(r=>({...r})),faults:[...faults],proposals:proposals.filter(r=>r.expires>Date.now())})};
}
