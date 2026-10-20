// Runs after the original validated standalone editor script. It never evals
// profile contents or grants runtime/Adventure Land permissions.
(()=>{
 'use strict';
 const toolbar=document.querySelector('header .toolbar');
 if(!toolbar)return;
 const save=document.createElement('button'),load=document.createElement('button'),
  back=document.createElement('a'),message=document.createElement('span');
 let cloudSha=null,available=false;
 save.textContent='☁ Profil auf GitHub speichern';save.className='primary';
 load.textContent='☁ GitHub-Profil laden';
 back.href='./index.html';back.textContent='← Dashboard';back.style.color='var(--green)';
 message.style.cssText='display:block;min-width:150px;font-size:12px;color:var(--muted)';
 const note=text=>{message.textContent=text;feedback(text);};
 const request=async(path,init={})=>{
  const res=await fetch(path,{cache:'no-store',credentials:'same-origin',...init});
  const body=await res.json();
  if(!res.ok)throw Error(body.error||('HTTP '+res.status));
  return body;
 };
 async function loadProfile({manual=false}={}){
  load.disabled=true;
  try{
   const saved=await request('/api/profile');
   cloudSha=saved.sha??null;available=true;
   if(!saved.document){
    note('Privates GitHub-Profil ist noch leer. Lokales Profil prüfen und dann auf GitHub speichern.');
    return;
   }
   // Never discard a local draft or edits silently.
   const draft=!!localStorage.getItem(STORAGE);
   if((manual||draft||dirty)&&!window.confirm('GitHub-Profil laden? Der aktuelle lokale Entwurf wird dadurch ersetzt. Du kannst ihn vorher als JSON exportieren.')){
    note('Lokaler Entwurf bleibt geöffnet; GitHub-Version steht für spätere Übernahme bereit.');
    return;
   }
   const next=importProfile(descriptor,saved.document);
   change(()=>{config=next;},true);
   dirty=false;
   note('Profil von GitHub übernommen. Ein Speichern ändert noch keine laufenden Spielcharaktere.');
  }catch(e){note('Cloud-Profil nicht geladen: '+e.message);}
  finally{load.disabled=false;}
 }
 async function saveProfile(){
  const errors=validateProfile(descriptor,config);
  if(errors.length){note('Speichern blockiert: '+errors.slice(0,4).join('; '));return;}
  if(!available){note('Zuerst GitHub-Profilstatus laden.');return;}
  save.disabled=true;
  try{
   const r=await request('/api/profile',{method:'PUT',headers:{'content-type':'application/json'},
    body:JSON.stringify({sha:cloudSha,document:envelope(descriptor,config)})});
   cloudSha=r.sha;dirty=false;
   note('GitHub-Profil gespeichert (Commit '+String(r.commit??'').slice(0,8)+'). Noch nicht im Spiel übernommen.');
  }catch(e){
   note('GitHub-Speicherung nicht möglich: '+e.message+
    '. Bei Versionskonflikten erst den aktuellen Stand laden.');
  }finally{save.disabled=false;}
 }
 load.onclick=()=>loadProfile({manual:true});
 save.onclick=saveProfile;
 toolbar.append(load,save,back,message);
 // Cloud lookup does not overwrite any existing local draft without confirmation.
 loadProfile();
})();
