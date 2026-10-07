import {identity,fingerprint,variantCount} from '../core/policy.mjs';
export function createBank(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const packs=()=>Object.entries(p.c.bank??{}).filter(([name,items])=>/^items\d+$/.test(name)&&Array.isArray(items));
 const definitions=()=>p.G.bank_packs??p.root?.bank_packs??p.parent?.bank_packs??{};
 const packMap=pack=>definitions()[pack]?.[0]??(/^items[0-7]$/.test(pack)?'bank':null);
 const location=map=>({map,in:map,x:0,y:-100,radius:80});
 function ready(pack='items0'){const map=packMap(pack);return !!map&&cfg.merchant.bank&&me.name===cfg.party.merchant&&e.travel(location(map),'Bank')&&!!p.c.bank;}
 function store(slot,r){
  const item=p.c.items[slot];if(!e.safe(item)||e.spare(slot,r)<1)return false;
  const allowed=e.spare(slot,r);if(allowed<(item.q??1)){
   if(bot.free()<=cfg.merchant.minFreeSlots)return false;const before=item.q,dest=p.c.items.findIndex(x=>!x);
   return e.perform('bank.split',{slots:[slot],rule:r,guard:()=>!p.c.items[dest]&&e.spare(slot,r)>=allowed,call:()=>p.call('split',slot,allowed),observe:()=>p.c.items[slot]?.q===before-allowed&&p.c.items.some((x,n)=>n!==slot&&identity(x)===identity(item)&&x.q===allowed),details:{item:item.name,quantity:allowed,before}});
  }
  if(!ready(r.pack||'items0'))return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const dest=items.findIndex(i=>!i);if(dest<0)continue;
   const before=e.count(item),bankBefore=variantCount(items,item),q=item.q??1;
   return e.perform('bank.store',{slots:[slot],rule:r,guard:()=>!!p.c.bank&&!p.c.bank[pack][dest]&&e.spare(slot,r)>=q,
    call:()=>p.call('bank_store',slot,pack,dest),observe:()=>e.count(item)===before-q&&variantCount(p.c.bank?.[pack]??[],item)===bankBefore+q,details:{item:item.name,quantity:q,pack,before}});
  }if(expand())return true;e.note('Bank voll: kein freier erlaubter Platz');return false;
 }
 function retrieve(item,r,wanted){
  if(!ready(r.pack||'items0')||bot.free()<=cfg.merchant.minFreeSlots)return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const slot=items.findIndex(i=>i&&identity(i)===identity(item)&&e.safe(i)&&(i.q??1)<=Math.min(wanted,r.batch,r.maxCount-e.count(item)));
   if(slot<0)continue;const actual=items[slot],q=actual.q??1,fp=fingerprint(actual),dest=p.c.items.findIndex(i=>!i),before=e.count(actual),bankBefore=variantCount(items,actual);
   return e.perform('bank.retrieve',{rule:r,guard:()=>fingerprint(p.c.bank?.[pack]?.[slot])===fp&&!p.c.items[dest],call:()=>p.call('bank_retrieve',pack,slot,dest),observe:()=>e.count(actual)===before+q&&variantCount(p.c.bank?.[pack]??[],actual)===bankBefore-q,details:{item:actual.name,quantity:q,pack,before}});
  }return false;
 }
 function consolidate(){
  if(!cfg.merchant.bank||!cfg.merchant.consolidate||!p.c.bank)return false;
  for(const [pack,items] of packs())for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
   const x=items[a],y=items[b];if(packMap(pack)!==p.c.map||!e.safe(x)||!e.safe(y)||!x.q||!y.q||identity(x)!==identity(y)||x.q+y.q>(p.G.items[x.name]?.s??0))continue;
   const fa=fingerprint(x),fb=fingerprint(y),total=x.q+y.q;
   return e.perform('bank.consolidate',{guard:()=>fingerprint(p.c.bank?.[pack]?.[a])===fa&&fingerprint(p.c.bank?.[pack]?.[b])===fb,call:()=>p.call('bank_swap',pack,a,b),observe:()=>{const row=p.c.bank?.[pack];return !!row&&((!row[a]&&row[b]?.q===total)||(!row[b]&&row[a]?.q===total));},details:{item:x.name,quantity:total,pack}});
  }return false;
 }
 function expand(){
  if(!cfg.merchant.bank||!cfg.merchant.expandBank||!p.c.bank)return false;
  for(const [pack,def] of Object.entries(definitions())){const cost=def[1];if(def[0]!==p.c.map||p.c.bank[pack]||!Number.isFinite(cost)||cost<=0||cost>cfg.merchant.bankBudget)continue;
   return e.perform('bank.expand',{cost,guard:()=>!!p.c.bank&&!p.c.bank[pack],call:()=>p.call('open_bank_pack',pack,'gold'),observe:()=>Array.isArray(p.c.bank?.[pack]),details:{pack}});
  }return false;
 }
 function gold(){
  if(!cfg.merchant.bank||!cfg.merchant.bankGold||!p.c.bank||me.name!==cfg.party.merchant)return false;
  const commitments=Object.entries(p.c.slots??{}).reduce((n,[k,i])=>n+(k.startsWith('trade')&&i?.b?Math.max(0,Number(i.price)||0)*Math.max(1,Number(i.q)||1):0),0);
  const target=Math.max(cfg.merchant.goldTarget,cfg.merchant.goldReserve,me.goldReserve??0)+commitments,before=p.c.gold,stored=p.c.bank.gold;
  if(!Number.isFinite(stored)||before===target)return false;
  const depositing=before>target,q=depositing?before-target:Math.min(target-before,stored);if(q<=0)return false;
  return e.perform('bank.gold',{guard:()=>p.c.gold===before&&p.c.bank?.gold===stored,call:()=>p.call(depositing?'bank_deposit':'bank_withdraw',q),observe:()=>p.c.gold===before+(depositing?-q:q)&&p.c.bank?.gold===stored+(depositing?q:-q),details:{quantity:q,before}});
 }
 return {store,retrieve,consolidate,gold,expand,packs,ready};
}
