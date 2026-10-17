import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateLaunch} from './quest-launch.mjs';

const PROFILE_FIELDS=['userId','publicId','name','photoUrl','sets','active','bookmarks','language','privateProfile','viewInventory','inventoryVerifiedAt'];
export function cleanLaunchState(source,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<=0)throw Error('Invalid launch timestamp.');
 const links=structuredClone(source['game-links.json']||{}),profiles={};
 for(const [id,saved] of Object.entries(source['profiles.json']||{})){
  profiles[id]=Object.fromEntries(PROFILE_FIELDS.filter(key=>Object.hasOwn(saved,key)).map(key=>[key,structuredClone(saved[key])]));
  if(links[id]&&links[id].active!==false)profiles[id].link=structuredClone(links[id]);
 }
 return {
  'profiles.json':profiles,'game-links.json':links,'game-awards.json':{},
  'game-map-progress.json':{},'missions-state.json':{events:{},rankings:{}},
  'public-player-cache.json':{},'public-clan-cache.json':{},
  'quest-launch.json':validateLaunch({mode:'preview'}),
  'missions-launch.json':{enabled:true,startedAt:now},'daily-map-launch.json':{startedAt:now},
  'tournament-settings.json':structuredClone(source['tournament-settings.json']||{organizerIds:[]}),
  'launch-manifest.json':{name:'DMX Arena',preparedAt:now,status:'prepared',claimsEnabled:false,requiresFreshGameBaseline:true}
 };
}
export function prepareLaunch(directory,{now=Date.now(),target}={}){
 const sourceDirectory=fs.realpathSync(directory),source={};
 for(const name of ['profiles.json','game-links.json','game-awards.json','tournament-settings.json']){
  const file=path.join(sourceDirectory,name);source[name]=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{};
 }
 const files=cleanLaunchState(source,now),output=path.resolve(target||path.join(sourceDirectory,'launch-candidates',new Date(now).toISOString().replace(/[:.]/g,'-')));
 // Exclusive directory creation prevents overwriting either live data or another candidate.
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.mkdirSync(output,{mode:0o700});
 try{
  for(const [name,value] of Object.entries(files))fs.writeFileSync(path.join(output,name),JSON.stringify(value),{flag:'wx',mode:0o600});
  const backup=path.join(output,'source-backup');fs.mkdirSync(backup,{mode:0o700});
  for(const item of fs.readdirSync(sourceDirectory,{withFileTypes:true}))if(item.isFile()&&item.name.endsWith('.json'))fs.copyFileSync(path.join(sourceDirectory,item.name),path.join(backup,item.name),fs.constants.COPYFILE_EXCL);
  return {directory:output,profiles:Object.keys(files['profiles.json']).length,reservedGameIds:Object.keys(files['game-links.json']).length,balance:0,awards:0,missions:0,claimsEnabled:false};
 }catch(error){throw Error('Launch candidate is incomplete; do not activate '+output+'. '+error.message);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.dirname(fileURLToPath(import.meta.url));
 try{console.log(JSON.stringify(prepareLaunch(process.env.DMX_DATA_DIR||path.join(root,'.data'))));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
