import {VERSION} from '../version.mjs';
export function createPanel(bot,api){
  if(bot.p.headless||!bot.cfg.general.ui)return {render(){},remove(){}};
  const doc=bot.p.parent.document;if(!doc?.body)return {render(){},remove(){}};
  const node=doc.createElement('section');node.id='albot-panel-'+bot.me.name;
  node.style.cssText='position:fixed;right:8px;top:45px;z-index:9999;background:#10211e;color:#eef8f4;border:1px solid #69ae90;padding:10px;font:13px sans-serif;max-width:300px';
  const title=doc.createElement('strong');title.textContent='ALBot '+VERSION+' · '+bot.me.name;const status=doc.createElement('p');node.append(title,status);
  for(const [label,action] of [['Start',()=>api.start()],['Pause',()=>api.pause()],['STOP',()=>api.stop()]]){const b=doc.createElement('button');b.textContent=label;b.onclick=action;node.append(b);}
  doc.body.append(node);return {render(){status.textContent=bot.me.role+' · '+(bot.running?'Aktiv':'Angehalten')+' · '+bot.reason;},remove(){node.remove();}};
}
