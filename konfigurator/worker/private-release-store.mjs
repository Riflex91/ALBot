// Isolated private GitHub store. This is NOT a public profile distribution API.
const FILE=/^[a-zA-Z0-9._\/-]{1,180}$/;
const BRANCH=/^[a-zA-Z0-9._\/-]{1,120}$/;
const REPO=/^[\w.-]+\/[\w.-]+$/;
const SHA=/^[a-f0-9]{40}$/;
export class ReleaseStorageError extends Error{
 constructor(message,status=503){super(message);this.status=status;}
}
export function privateReleaseLocation(env){
 const repository=env?.CONFIG_REPO,branch=env?.CONFIG_BRANCH||'main';
 const path=env?.CONFIG_RELEASE_PATH||'albot/private-signed-release.json';
 const policyPath=env?.CONFIG_PATH||'albot/item-policies.json';
 const profilePath=env?.PROFILE_PATH||'albot/profile.json';
 if(typeof repository!=='string'||!REPO.test(repository)||
  typeof branch!=='string'||!BRANCH.test(branch)||branch.includes('..')||
  typeof path!=='string'||!FILE.test(path)||path.includes('..')||
  path.startsWith('/')||path.endsWith('/')||
  [policyPath,profilePath].includes(path))
  throw new ReleaseStorageError('Privater Release-Pfad ungültig');
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<10)
  throw new ReleaseStorageError('GitHub-Token nicht eingerichtet');
 return {repository,branch,path};
}
const headers=(env,hasBody=false)=>({
 authorization:'Bearer '+env.GITHUB_TOKEN,
 accept:'application/vnd.github+json',
 'x-github-api-version':'2022-11-28',
 'user-agent':'ALBot-Konfigurator-Worker',
 ...(hasBody?{'content-type':'application/json'}:{})
});
function base64(str){
 const utf8=new TextEncoder().encode(str);
 let raw='';for(const b of utf8)raw+=String.fromCharCode(b);
 return btoa(raw);
}
function decode(str){
 return new TextDecoder().decode(Uint8Array.from(
  atob(str.replace(/\s/g,'')),c=>c.charCodeAt(0)));
}
export async function assertPrivateRepository(env,fetcher=fetch){
 const {repository}=privateReleaseLocation(env);
 const response=await fetcher('https://api.github.com/repos/'+repository,{
  headers:headers(env)});
 if(!response.ok)throw new ReleaseStorageError('Private GitHub-Repositoryprüfung fehlgeschlagen');
 let info;try{info=await response.json();}catch{}
 if(info?.private!==true||info?.full_name!==repository)
  throw new ReleaseStorageError('Signierte Profile dürfen nur in ein bestätigtes privates GitHub-Repository geschrieben werden',403);
}
export async function githubReleaseFile(env,{method='GET',document=null,sha=null,
 fetcher=fetch}={}){
 const {repository,branch,path}=privateReleaseLocation(env);
 const url=new URL('https://api.github.com/repos/'+repository+'/contents/'+path);
 if(method==='GET')url.searchParams.set('ref',branch);
 else if(method!=='PUT')throw new ReleaseStorageError('Nicht unterstützter Releasezugriff',405);
 if(method==='PUT'&&sha!==null&&!SHA.test(sha))
  throw new ReleaseStorageError('Release-Revisionskennung ungültig',400);
 const body=method==='PUT'?{
  branch,message:'config: prepare private signed ALBot profile release',
  content:base64(JSON.stringify(document,null,2)+'\n'),
  ...(sha?{sha}:{})
 }:null;
 const response=await fetcher(url.href,{
  method,headers:headers(env,body!==null),
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(method==='GET'&&response.status===404)return {sha:null,document:null};
 if(response.status===409||response.status===422)
  throw new ReleaseStorageError('Signierte Revision wurde parallel geändert. Bitte neu laden.',409);
 if(!response.ok)throw new ReleaseStorageError('Privater GitHub-Releasezugriff fehlgeschlagen');
 let value;try{value=await response.json();}catch{
  throw new ReleaseStorageError('Ungültige GitHub-Releaseantwort');
 }
 if(method==='PUT'){
  if(!SHA.test(value?.content?.sha??''))
   throw new ReleaseStorageError('GitHub-Release nicht bestätigt');
  return {sha:value.content.sha,commit:value.commit?.sha??null};
 }
 if(value?.type!=='file'||!SHA.test(value?.sha??'')||
  typeof value.content!=='string'||value.content.length>1600000)
  throw new ReleaseStorageError('Ungültige private Release-Datei');
 let parsed;try{parsed=JSON.parse(decode(value.content));}
 catch{throw new ReleaseStorageError('Private Release-Datei kann nicht gelesen werden');}
 return {sha:value.sha,document:parsed};
}
);
const BRANCH=/^[a-zA-Z0-9._/-]{1,120}$/;
const REPO=/^[\w.-]+\/[\w.-]+$/;
const SHA=/^[a-f0-9]{40}$/;
export class ReleaseStorageError extends Error{
 constructor(message,status=503){super(message);this.status=status;}
}
export function privateReleaseLocation(env){
 const repository=env?.CONFIG_REPO,branch=env?.CONFIG_BRANCH||'main';
 const path=env?.CONFIG_RELEASE_PATH||'albot/private-signed-release.json';
 const policyPath=env?.CONFIG_PATH||'albot/item-policies.json';
 const profilePath=env?.PROFILE_PATH||'albot/profile.json';
 if(typeof repository!=='string'||!REPO.test(repository)||
  typeof branch!=='string'||!BRANCH.test(branch)||branch.includes('..')||
  typeof path!=='string'||!FILE.test(path)||path.includes('..')||
  path.startsWith('/')||path.endsWith('/')||
  [policyPath,profilePath].includes(path))
  throw new ReleaseStorageError('Privater Release-Pfad ungültig');
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<10)
  throw new ReleaseStorageError('GitHub-Token nicht eingerichtet');
 return {repository,branch,path};
}
const headers=(env,hasBody=false)=>({
 authorization:'Bearer '+env.GITHUB_TOKEN,
 accept:'application/vnd.github+json',
 'x-github-api-version':'2022-11-28',
 'user-agent':'ALBot-Konfigurator-Worker',
 ...(hasBody?{'content-type':'application/json'}:{})
});
function base64(str){
 const utf8=new TextEncoder().encode(str);
 let raw='';for(const b of utf8)raw+=String.fromCharCode(b);
 return btoa(raw);
}
function decode(str){
 return new TextDecoder().decode(Uint8Array.from(
  atob(str.replace(/\s/g,'')),c=>c.charCodeAt(0)));
}
export async function assertPrivateRepository(env,fetcher=fetch){
 const {repository}=privateReleaseLocation(env);
 const response=await fetcher('https://api.github.com/repos/'+repository,{
  headers:headers(env)});
 if(!response.ok)throw new ReleaseStorageError('Private GitHub-Repositoryprüfung fehlgeschlagen');
 let info;try{info=await response.json();}catch{}
 if(info?.private!==true||info?.full_name!==repository)
  throw new ReleaseStorageError('Signierte Profile dürfen nur in ein bestätigtes privates GitHub-Repository geschrieben werden',403);
}
export async function githubReleaseFile(env,{method='GET',document=null,sha=null,
 fetcher=fetch}={}){
 const {repository,branch,path}=privateReleaseLocation(env);
 const url=new URL('https://api.github.com/repos/'+repository+'/contents/'+path);
 if(method==='GET')url.searchParams.set('ref',branch);
 else if(method!=='PUT')throw new ReleaseStorageError('Nicht unterstützter Releasezugriff',405);
 if(method==='PUT'&&sha!==null&&!SHA.test(sha))
  throw new ReleaseStorageError('Release-Revisionskennung ungültig',400);
 const body=method==='PUT'?{
  branch,message:'config: prepare private signed ALBot profile release',
  content:base64(JSON.stringify(document,null,2)+'\n'),
  ...(sha?{sha}:{})
 }:null;
 const response=await fetcher(url.href,{
  method,headers:headers(env,body!==null),
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(method==='GET'&&response.status===404)return {sha:null,document:null};
 if(response.status===409||response.status===422)
  throw new ReleaseStorageError('Signierte Revision wurde parallel geändert. Bitte neu laden.',409);
 if(!response.ok)throw new ReleaseStorageError('Privater GitHub-Releasezugriff fehlgeschlagen');
 let value;try{value=await response.json();}catch{
  throw new ReleaseStorageError('Ungültige GitHub-Releaseantwort');
 }
 if(method==='PUT'){
  if(!SHA.test(value?.content?.sha??''))
   throw new ReleaseStorageError('GitHub-Release nicht bestätigt');
  return {sha:value.content.sha,commit:value.commit?.sha??null};
 }
 if(value?.type!=='file'||!SHA.test(value?.sha??'')||
  typeof value.content!=='string'||value.content.length>1600000)
  throw new ReleaseStorageError('Ungültige private Release-Datei');
 let parsed;try{parsed=JSON.parse(decode(value.content));}
 catch{throw new ReleaseStorageError('Private Release-Datei kann nicht gelesen werden');}
 return {sha:value.sha,document:parsed};
}
);
const REPO=/^[\w.-]+\/[\w.-]+$/;
const SHA=/^[a-f0-9]{40}$/;
export class ReleaseStorageError extends Error{
 constructor(message,status=503){super(message);this.status=status;}
}
export function privateReleaseLocation(env){
 const repository=env?.CONFIG_REPO,branch=env?.CONFIG_BRANCH||'main';
 const path=env?.CONFIG_RELEASE_PATH||'albot/private-signed-release.json';
 const policyPath=env?.CONFIG_PATH||'albot/item-policies.json';
 const profilePath=env?.PROFILE_PATH||'albot/profile.json';
 if(typeof repository!=='string'||!REPO.test(repository)||
  typeof branch!=='string'||!BRANCH.test(branch)||branch.includes('..')||
  typeof path!=='string'||!FILE.test(path)||path.includes('..')||
  path.startsWith('/')||path.endsWith('/')||
  [policyPath,profilePath].includes(path))
  throw new ReleaseStorageError('Privater Release-Pfad ungültig');
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<10)
  throw new ReleaseStorageError('GitHub-Token nicht eingerichtet');
 return {repository,branch,path};
}
const headers=(env,hasBody=false)=>({
 authorization:'Bearer '+env.GITHUB_TOKEN,
 accept:'application/vnd.github+json',
 'x-github-api-version':'2022-11-28',
 'user-agent':'ALBot-Konfigurator-Worker',
 ...(hasBody?{'content-type':'application/json'}:{})
});
function base64(str){
 const utf8=new TextEncoder().encode(str);
 let raw='';for(const b of utf8)raw+=String.fromCharCode(b);
 return btoa(raw);
}
function decode(str){
 return new TextDecoder().decode(Uint8Array.from(
  atob(str.replace(/\s/g,'')),c=>c.charCodeAt(0)));
}
export async function assertPrivateRepository(env,fetcher=fetch){
 const {repository}=privateReleaseLocation(env);
 const response=await fetcher('https://api.github.com/repos/'+repository,{
  headers:headers(env)});
 if(!response.ok)throw new ReleaseStorageError('Private GitHub-Repositoryprüfung fehlgeschlagen');
 let info;try{info=await response.json();}catch{}
 if(info?.private!==true||info?.full_name!==repository)
  throw new ReleaseStorageError('Signierte Profile dürfen nur in ein bestätigtes privates GitHub-Repository geschrieben werden',403);
}
export async function githubReleaseFile(env,{method='GET',document=null,sha=null,
 fetcher=fetch}={}){
 const {repository,branch,path}=privateReleaseLocation(env);
 const url=new URL('https://api.github.com/repos/'+repository+'/contents/'+path);
 if(method==='GET')url.searchParams.set('ref',branch);
 else if(method!=='PUT')throw new ReleaseStorageError('Nicht unterstützter Releasezugriff',405);
 if(method==='PUT'&&sha!==null&&!SHA.test(sha))
  throw new ReleaseStorageError('Release-Revisionskennung ungültig',400);
 const body=method==='PUT'?{
  branch,message:'config: prepare private signed ALBot profile release',
  content:base64(JSON.stringify(document,null,2)+'\n'),
  ...(sha?{sha}:{})
 }:null;
 const response=await fetcher(url.href,{
  method,headers:headers(env,body!==null),
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(method==='GET'&&response.status===404)return {sha:null,document:null};
 if(response.status===409||response.status===422)
  throw new ReleaseStorageError('Signierte Revision wurde parallel geändert. Bitte neu laden.',409);
 if(!response.ok)throw new ReleaseStorageError('Privater GitHub-Releasezugriff fehlgeschlagen');
 let value;try{value=await response.json();}catch{
  throw new ReleaseStorageError('Ungültige GitHub-Releaseantwort');
 }
 if(method==='PUT'){
  if(!SHA.test(value?.content?.sha??''))
   throw new ReleaseStorageError('GitHub-Release nicht bestätigt');
  return {sha:value.content.sha,commit:value.commit?.sha??null};
 }
 if(value?.type!=='file'||!SHA.test(value?.sha??'')||
  typeof value.content!=='string'||value.content.length>1600000)
  throw new ReleaseStorageError('Ungültige private Release-Datei');
 let parsed;try{parsed=JSON.parse(decode(value.content));}
 catch{throw new ReleaseStorageError('Private Release-Datei kann nicht gelesen werden');}
 return {sha:value.sha,document:parsed};
}
);
const BRANCH=/^[a-zA-Z0-9._/-]{1,120}$/;
const REPO=/^[\w.-]+\/[\w.-]+$/;
const SHA=/^[a-f0-9]{40}$/;
export class ReleaseStorageError extends Error{
 constructor(message,status=503){super(message);this.status=status;}
}
export function privateReleaseLocation(env){
 const repository=env?.CONFIG_REPO,branch=env?.CONFIG_BRANCH||'main';
 const path=env?.CONFIG_RELEASE_PATH||'albot/private-signed-release.json';
 const policyPath=env?.CONFIG_PATH||'albot/item-policies.json';
 const profilePath=env?.PROFILE_PATH||'albot/profile.json';
 if(typeof repository!=='string'||!REPO.test(repository)||
  typeof branch!=='string'||!BRANCH.test(branch)||branch.includes('..')||
  typeof path!=='string'||!FILE.test(path)||path.includes('..')||
  path.startsWith('/')||path.endsWith('/')||
  [policyPath,profilePath].includes(path))
  throw new ReleaseStorageError('Privater Release-Pfad ungültig');
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<10)
  throw new ReleaseStorageError('GitHub-Token nicht eingerichtet');
 return {repository,branch,path};
}
const headers=(env,hasBody=false)=>({
 authorization:'Bearer '+env.GITHUB_TOKEN,
 accept:'application/vnd.github+json',
 'x-github-api-version':'2022-11-28',
 'user-agent':'ALBot-Konfigurator-Worker',
 ...(hasBody?{'content-type':'application/json'}:{})
});
function base64(str){
 const utf8=new TextEncoder().encode(str);
 let raw='';for(const b of utf8)raw+=String.fromCharCode(b);
 return btoa(raw);
}
function decode(str){
 return new TextDecoder().decode(Uint8Array.from(
  atob(str.replace(/\s/g,'')),c=>c.charCodeAt(0)));
}
export async function assertPrivateRepository(env,fetcher=fetch){
 const {repository}=privateReleaseLocation(env);
 const response=await fetcher('https://api.github.com/repos/'+repository,{
  headers:headers(env)});
 if(!response.ok)throw new ReleaseStorageError('Private GitHub-Repositoryprüfung fehlgeschlagen');
 let info;try{info=await response.json();}catch{}
 if(info?.private!==true||info?.full_name!==repository)
  throw new ReleaseStorageError('Signierte Profile dürfen nur in ein bestätigtes privates GitHub-Repository geschrieben werden',403);
}
export async function githubReleaseFile(env,{method='GET',document=null,sha=null,
 fetcher=fetch}={}){
 const {repository,branch,path}=privateReleaseLocation(env);
 const url=new URL('https://api.github.com/repos/'+repository+'/contents/'+path);
 if(method==='GET')url.searchParams.set('ref',branch);
 else if(method!=='PUT')throw new ReleaseStorageError('Nicht unterstützter Releasezugriff',405);
 if(method==='PUT'&&sha!==null&&!SHA.test(sha))
  throw new ReleaseStorageError('Release-Revisionskennung ungültig',400);
 const body=method==='PUT'?{
  branch,message:'config: prepare private signed ALBot profile release',
  content:base64(JSON.stringify(document,null,2)+'\n'),
  ...(sha?{sha}:{})
 }:null;
 const response=await fetcher(url.href,{
  method,headers:headers(env,body!==null),
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(method==='GET'&&response.status===404)return {sha:null,document:null};
 if(response.status===409||response.status===422)
  throw new ReleaseStorageError('Signierte Revision wurde parallel geändert. Bitte neu laden.',409);
 if(!response.ok)throw new ReleaseStorageError('Privater GitHub-Releasezugriff fehlgeschlagen');
 let value;try{value=await response.json();}catch{
  throw new ReleaseStorageError('Ungültige GitHub-Releaseantwort');
 }
 if(method==='PUT'){
  if(!SHA.test(value?.content?.sha??''))
   throw new ReleaseStorageError('GitHub-Release nicht bestätigt');
  return {sha:value.content.sha,commit:value.commit?.sha??null};
 }
 if(value?.type!=='file'||!SHA.test(value?.sha??'')||
  typeof value.content!=='string'||value.content.length>1600000)
  throw new ReleaseStorageError('Ungültige private Release-Datei');
 let parsed;try{parsed=JSON.parse(decode(value.content));}
 catch{throw new ReleaseStorageError('Private Release-Datei kann nicht gelesen werden');}
 return {sha:value.sha,document:parsed};
}
