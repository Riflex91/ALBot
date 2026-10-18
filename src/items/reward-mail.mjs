import {identity,fingerprint,variantCount} from '../core/policy.mjs';
import {capacityAfterConsumption} from './physical-capacity.mjs';
const SYSTEM_REWARD_PHRASES=['server.cave.mail_subject','server.tracktrix.mail_subject'];
export function rewardMailAttachment(row,name,G){
 if(!row||typeof row.id!=='string'||!/^ML_[A-Za-z0-9_:.-]{1,240}$/.test(row.id)||
    row.to!==name||row.can_take!==true||
    !SYSTEM_REWARD_PHRASES.includes(row.subject_message?.phrase))return null;
 let item=row.item;
 if(typeof item==='string'){
  if(item.length>8192)return null;
  try{item=JSON.parse(item);}catch{return null;}
 }
 if(!item||typeof item!=='object'||Array.isArray(item))return null;
 if(Number.isSafeInteger(item.gold)&&item.gold>0&&
    row.subject_message.phrase==='server.cave.mail_subject'&&
    item.gold<=(G.events?.dreams?.gold_limit??0))return {gold:item.gold};
 if(typeof item.name!=='string'||!G.items?.[item.name])return null;
 const result={name:item.name};
 for(const key of ['level','q']){
  const value=item[key]??(key==='level'?0:1);
  if(!Number.isSafeInteger(value)||value<(key==='level'?0:1)||value>1000000)return null;
  result[key]=value;
 }
 if(result.level>99)return null;
 for(const key of ['p','stat_type','title','acc','rid','data','l','b'])
  if(item[key]!==undefined){
   if(!['string','number','boolean'].includes(typeof item[key])||
      typeof item[key]==='string'&&item[key].length>256||
      typeof item[key]==='number'&&!Number.isFinite(item[key]))return null;
   result[key]=item[key];
  }
 return result;
}
export function rewardClaimFits(character,item,G){
 if(item?.gold)return Number.isSafeInteger(character.gold)&&
  Number.isSafeInteger(character.gold+item.gold);
 const fit=capacityAfterConsumption(character.items,[],item,G.items?.[item?.name],
  {inventorySize:character.isize});
 return !!fit&&fit.units>=(item?.q??1);
}
export function rewardClaimDelta(journal,character){
 if(journal?.kind!=='mail.claim'||!Array.isArray(journal.beforeInventory)||
    journal.beforeInventory.length>256||!Number.isSafeInteger(journal.beforeGold))return false;
 const before=journal.beforeInventory,current=character.items??[];
 if(journal.attachment?.gold)return character.gold===journal.beforeGold+journal.attachment.gold&&
  JSON.stringify(current.map(fingerprint))===JSON.stringify(before);
 // All unrelated variants must remain byte-identical as a multiset. A
 // Potion or transfer changing another item makes lost-reply recovery wait.
 const expected=identity(journal.attachment);
 const split=rows=>{
  const other=[];let quantity=0;
  for(const row of rows){if(typeof row!=='string')return null;
   const cut=row.lastIndexOf(':'),variant=row.slice(0,cut),q=Number(row.slice(cut+1));
   if(variant===expected){if(!Number.isSafeInteger(q)||q<1)return null;quantity+=q;}
   if(variant!==expected&&row!==':1')other.push(row);
  }
  return {quantity,other:other.sort()};
 };
 const a=split(before),b=split(current.map(fingerprint));
 return !!a&&!!b&&Number.isSafeInteger(journal.attachment?.q)&&
  b.quantity-a.quantity===journal.attachment.q&&
  character.gold===journal.beforeGold&&JSON.stringify(a.other)===JSON.stringify(b.other);
}
export function createRewardMail(bot,{now=()=>Date.now()}={}){
 const {p,cfg}=bot,key='albot:reward-mail-cursor:'+bot.me.name;
 let cursor=p.read?.(key)?.cursor??null,nextRead=0,reading=false,generation=0,
  queue=[],observed=[],reason='not-scanned';
 if(bot.journal?.kind==='mail.claim')cursor=null;
 const remember=(id,state)=>{observed.push({id,state,at:now()});observed=observed.slice(-16);};
 const enabled=()=>cfg.world?.rewardMail===true;
 const available=()=>p.rewardMailCapability?.()??{supported:false,reason:'authenticated-mail-reader-unavailable'};
 const safe=()=>bot.running&&!p.c.rip&&!bot.journal&&!bot.inventoryBlocked&&
  !bot.bank?.pending&&!bot.logistics?.reserved&&!bot.recovering&&
  !Object.keys(p.c.c??{}).length&&!bot.monsters().some(m=>m.target===p.c.name&&m.hp>0&&!m.dead);
 function reconcile(rows){
  const j=bot.journal;if(bot.exec.pending?.has('mail.claim')||j?.kind!=='mail.claim'||j.owner!==bot.me.name||j.realm!==p.realm())return;
  const row=rows.find(r=>r.id===j.mailId),item=rewardMailAttachment(row,bot.me.name,p.G);
  if(row?.taken!==true||!item||JSON.stringify(item)!==JSON.stringify(j.attachment)||
     !rewardClaimDelta(j,p.c))return;
  bot.endValue('confirmed');
  if(!bot.journal){bot.inventoryBlocked=false;remember(j.mailId,'confirmed-after-reload');}
 }
 function read(){
  if(reading||now()<nextRead||!available().supported)return;
  if(queue.length&&!bot.journal)return;
  const gen=generation;reading=true;nextRead=now()+60000;
  const requested=cursor;
  bot.exec.run('reward.mail.read',['reward-reader'],()=>bot.running,()=>
   Promise.resolve(p.readRewardMailPage(requested)).then(page=>{
    if(gen!==generation||!bot.running)return;
    if(!Array.isArray(page?.mail)||page.mail.length>40)throw Error('Invalid reward mail page');
    reconcile(page.mail);
    const rows=page.mail.filter(row=>row.taken===false&&rewardMailAttachment(row,bot.me.name,p.G));
    queue=rows.slice(0,40);for(const row of queue)remember(row.id,'observed');
    const next=page.more===true&&typeof page.cursor==='string'&&/^\d{1,8}$/.test(page.cursor)?page.cursor:null;
    if(page.more===true&&(!next||Number(next)<=Number(requested??0)))throw Error('Invalid reward mail cursor');
    if(p.write(key,{cursor:next})!==true){reason='mail-cursor-storage-unavailable';return;}
    cursor=next;nextRead=now()+(next?5000:300000);
    reason=queue.length?'own-system-rewards-observed':'no-own-system-reward-on-page';
   }).finally(()=>{if(gen===generation)reading=false;}),
   {timeout:20000,delay:5000,onSettle:state=>{reading=false;
    if(['timeout','rejected','superseded'].includes(state))reason='mail-page-'+state;}});
  if(!bot.exec.pending?.has('reward.mail.read')&&!bot.exec.frame?.some(j=>j.key==='reward.mail.read'))reading=false;
 }
 function claim(){
  if(!safe()||!queue.length||!Number.isSafeInteger(p.c.gold))return false;
  const row=queue[0],item=rewardMailAttachment(row,bot.me.name,p.G);
  if(!item){queue.shift();return false;}
  if(!rewardClaimFits(p.c,item,p.G)){reason='reward-inventory-capacity';return false;}
  const beforeInventory=p.c.items.map(fingerprint),beforeGold=p.c.gold;
  let receipt=null;const details={mailId:row.id,owner:bot.me.name,realm:p.realm(),
   attachment:item,beforeInventory,beforeGold};
  return bot.economy.perform('mail.claim',{
   guard:()=>enabled()&&safe()&&queue[0]===row&&row.taken===false&&
    rewardClaimFits(p.c,item,p.G)&&p.c.gold===beforeGold&&
    JSON.stringify(p.c.items.map(fingerprint))===JSON.stringify(beforeInventory),
   call:()=>{remember(row.id,'claiming');return Promise.resolve(p.call('take_mail_item',row.id))
    .then(result=>{receipt=result;return result;});},
   observe:()=>receipt?.success===true&&receipt.id===row.id&&
    (item.gold?receipt.gold===item.gold:identity(receipt.item)===identity(item)&&
     (receipt.item?.q??1)===(item.q??1))&&
    rewardClaimDelta({kind:'mail.claim',...details},p.c),
   onConfirmed:()=>{queue=queue.filter(r=>r.id!==row.id);remember(row.id,'confirmed');return true;},
   details,timeout:20000});
 }
 return {tick(){
  if(!enabled())return false;
  if(!available().supported){reason=available().reason;return false;}
  if(!p.has('take_mail_item')||!bot.economy){reason='public-mail-claim-unavailable';return false;}
  read();return claim();
 },status:()=>({enabled:enabled(),reader:available(),reason,queued:queue.length,
   cursor,reading,entries:observed.map(r=>({...r}))}),
  close(){generation++;reading=false;queue=[];nextRead=0;}
 };
}
