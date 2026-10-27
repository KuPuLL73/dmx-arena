// Local operator tool. Credentials stay in the ignored file and HTTP headers.
import fs from 'node:fs';
import {cleanLaunchState,prepareLaunch} from '../prepare-launch.mjs';
import {instanceByName} from '../tgcloud/lib/instances.js';
// --instance=test (or DMX_INSTANCE=test) targets the test Worker and its own ignored .dev.vars.test file.
const flag=process.argv.find(arg=>arg.startsWith('--instance='));
export const instance=instanceByName(flag?flag.slice('--instance='.length):process.env.DMX_INSTANCE);
const origin=instance.workerOrigin,suffix=instance.name==='production'?'':'-'+instance.name;
export function bindings(){return Object.fromEntries(fs.readFileSync(new URL(instance.name==='production'?'.dev.vars':'.dev.vars.'+instance.name,import.meta.url),'utf8').split(/\r?\n/).filter(row=>row.includes('=')).map(row=>{const i=row.indexOf('=');return [row.slice(0,i),JSON.parse(row.slice(i+1))];}));}
export async function admin(action,input={}){
 const response=await fetch(origin+'/admin/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bindings().DEPLOY_KEY},body:JSON.stringify(input),signal:AbortSignal.timeout(90000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Cloud administration failed');return result;
}
export function sourceFiles(){
 // Live player records never seed the test copy: it starts empty.
 if(instance.name!=='production')return {};
 const result={};for(const name of ['profiles.json','game-links.json','game-awards.json','tournament-settings.json']){
  const file=new URL('../.data/'+name,import.meta.url);result[name]=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{};
 }return result;
}
async function main(){
 const action=process.argv[2]||'status';let result;
 if(action==='preview')result=await admin('init',{files:cleanLaunchState(sourceFiles())});
 else if(action==='status'||action==='activate')result=await admin(action);
 else if(action==='export'){
  const data=await admin('export'),directory=new URL('../.data/cloud-backups'+suffix+'/',import.meta.url);fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const name=new Date().toISOString().replace(/[:.]/g,'-')+'.json';fs.writeFileSync(new URL(name,directory),JSON.stringify(data),{flag:'wx',mode:0o600});
  result={savedPrivately:true,files:Object.keys(data.files).length};
 }else if(action==='import-candidate'){
  const directory=process.argv[3];if(!directory)throw Error('Launch candidate path required');
  const files={};for(const name of Object.keys(cleanLaunchState({})))files[name]=JSON.parse(fs.readFileSync(directory+'/'+name,'utf8'));
  result=await admin('init',{files});
 }else throw Error('Unsupported local administration action');
 fs.writeFileSync(new URL('../artifacts/cloud-application-status'+suffix+'.json',import.meta.url),JSON.stringify({action,...result,checkedAt:Date.now()}),{mode:0o600});console.log(JSON.stringify(result));
}
if(process.argv[1]&&new URL('file:///'+process.argv[1].replaceAll('\\','/')).pathname===new URL(import.meta.url).pathname)main().catch(error=>{console.error('Cloud administration: '+error.message);process.exitCode=1;});
