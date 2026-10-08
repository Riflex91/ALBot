import {VERSION} from '../version.mjs';
export function createPanel(bot,api){
  if(bot.p.headless||!bot.cfg.general.ui)return {render(){},remove(){}};
  const doc=bot.p.parent.document;if(!doc?.body)return {render(){},remove(){}};
  const node=doc.createElement('section');node.id='albot-panel-'+bot.me.name;
  node.style.cssText='position:fixed;right:8px;top:45px;z-index:9999;background:#10211e;color:#eef8f4;border:1px solid #69ae90;padding:10px;font:13px sans-serif;max-width:300px';
  const title=doc.createElement('strong');title.textContent='ALBot '+VERSION+' · '+bot.me.name;const status=doc.createElement('p');node.append(title,status);
  for(const [label,action] of [['Start',()=>api.start()],['Pause',()=>api.pause()],['STOP',()=>api.stop()],...(bot.cfg.general.testLogging?[['Testordner wählen',()=>api.chooseLogDirectory()]]:[]),['Testlog speichern',()=>api.exportTestReport()]]){const b=doc.createElement('button');b.textContent=label;if(label==='Testordner wählen'&&!api.logCapabilities().directory){b.textContent='Ordnerauswahl nicht verfügbar';b.disabled=true;b.title='Testlog speichern verwenden. Den Desktop als Downloadziel im Browser einstellen.';}else b.onclick=action;node.append(b);}
  if(bot.cfg.general.testLogging&&!api.logCapabilities().directory){const hint=doc.createElement('p');hint.textContent='Logs per „Testlog speichern“ herunterladen. Speicherort in den Browser-Downloads wählen.';node.append(hint);}
  doc.body.append(node);return {render(){status.textContent=bot.me.role+' · '+(bot.running?'Aktiv':'Angehalten')+' · '+bot.reason;},remove(){node.remove();}};
}
