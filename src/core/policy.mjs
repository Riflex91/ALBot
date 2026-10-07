import {ruleRank} from '../../editor/lib/contract.mjs';
export const xy=e=>({x:e?.real_x??e?.x,y:e?.real_y??e?.y});
export const distance=(a,b)=>Math.hypot(xy(a).x-xy(b).x,xy(a).y-xy(b).y);
export const samePlace=(a,b)=>!!a&&!!b&&a.map===b.map&&String(a.in??a.map)===String(b.in??b.map);
export const protectedItem=i=>!i||!!(i.l||i.b||i.bound||i.locked||i.equipped||i.reserved||i.giveaway);
export const identity=i=>i?JSON.stringify([i.name,i.level??0,i.stat_type??'',i.p??'',i.title??'',i.acc??'',i.rid??'',i.l??'',i.b??'',...(i.data===undefined?[]:[i.data])]):'';
export const fingerprint=i=>identity(i)+':'+(i?.q??1);
export function chooseRule(rules,item,context){
  return rules.filter(r=>r.enabled&&r.item===item.name&&(item.level??0)>=r.minLevel&&(item.level??0)<=r.maxLevel&&(r.role==='all'||r.role===context.role)&&['character','map','server','task'].every(k=>!r[k]||r[k]===context[k])&&(!r.statType||r.statType===(item.stat_type??''))&&(!r.property||r.property===(item.p??''))&&(!r.title||r.title===(item.title??''))).sort((a,b)=>ruleRank(b)-ruleRank(a)||b.priority-a.priority)[0]??null;
}
export function variantCount(items,item){return items.reduce((n,i)=>n+(i&&identity(i)===identity(item)?(i.q??1):0),0);}
export function transferable(items,slot,rule){const i=items[slot];if(protectedItem(i)||!rule||rule.action!=='send')return 0;return Math.max(0,Math.min(i.q??1,rule.batch,variantCount(items,i)-rule.keep-rule.teamReserve));}
export function arrived(c,d){return samePlace(c,d)&&distance(c,d)<=d.radius&&!c.moving;}
export function matches(conditions,s){return conditions.every(c=>{const actual=c.field==='itemCount'?s.count(c.item):s[c.field];if(actual===undefined||actual===null||(typeof actual==='number'&&!Number.isFinite(actual)))return false;const wanted=typeof actual==='boolean'?c.value==='true':typeof actual==='number'?Number(c.value):c.value;return {lt:()=>actual<wanted,lte:()=>actual<=wanted,eq:()=>actual===wanted,neq:()=>actual!==wanted,gte:()=>actual>=wanted,gt:()=>actual>wanted}[c.operator]?.()===true;});}
export function validMessage(m,from,self,roster,now){
  return !!m&&m.protocol==='albot/1'&&m.from===from&&roster.includes(from)&&m.to===self&&typeof m.session==='string'&&m.session.length<100&&Number.isSafeInteger(m.seq)&&m.seq>0&&Number.isFinite(m.time)&&Number.isFinite(m.ttl)&&m.ttl>0&&m.ttl<=120000&&m.time<=now+2000&&now-m.time<m.ttl&&['status','offer','accept','sent','receipt','done','hopPlan','hopAck','hopCommit','hopCancel','portRequest','portAck'].includes(m.type)&&typeof m.id==='string'&&m.id.length<150&&JSON.stringify(m).length<5000;
}
