// Retain the reviewed business logic. Only filesystem and HTTP hosting adapt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'js-connector/generated');fs.mkdirSync(path.join(output,'core'),{recursive:true});
const source=fs.readFileSync(path.join(root,'server.mjs'),'utf8');
const imports=source.split('\n').filter(line=>/^import .* from '\.\/.+\.mjs';$/.test(line.trim())).join('\n');
const names=new Set([...imports.matchAll(/from '\.\/(.+)\.mjs'/g)].map(row=>row[1]));
const manifest=[];
for(const name of names){
 let code=fs.readFileSync(path.join(root,name+'.mjs'),'utf8');
 manifest.push({path:name+'.mjs',sha256:crypto.createHash('sha256').update(code).digest('hex')});
 for(const match of code.matchAll(/from '\.\/(.+)\.mjs'/g))names.add(match[1]);
 if(name==='loadout'){
  code=code.replace("import fs from 'node:fs';",'');
  const expected="const rules=JSON.parse(fs.readFileSync(new URL('./dist/slot-rules.json',import.meta.url),'utf8'));";
  if(!code.includes(expected))throw Error('Review changed loadout initialization before migration');
  code=code.replace(expected,'const rules='+fs.readFileSync(path.join(root,'dist/slot-rules.json'),'utf8').trim()+';');
 }
 code=code.replaceAll("from 'node:fs'","from '../../src/storage.js'").replace(/from '(\.\/.+)\.mjs'/g,"from '$1.js'");
 fs.writeFileSync(path.join(output,'core',name+'.js'),'// Generated from the preserved Node/Python application.\n'+code);
}
let bootstrap=source.slice(source.indexOf('const game=new GameService'),source.indexOf('const types='));
const authStart=bootstrap.indexOf('export function verifyInit'),authEnd=bootstrap.indexOf('const inventory=');
if(authStart<0||authEnd<authStart)throw Error('Review changed application bootstrap before migration');
bootstrap=bootstrap.slice(0,authStart)+bootstrap.slice(authEnd);
bootstrap=bootstrap.replace('new TelegramQuest(game,token)',"new TelegramQuest(game,'',{api:dependencies.telegramApi})")
 .replace('process.env.DMX_ORGANIZER_IDS??tournamentSettings.organizerIds.join(\',\')',"tournamentSettings.organizerIds.join(',')");
let api=source.slice(source.indexOf(" if(url.pathname.startsWith('/api/')){"),source.indexOf(" if(url.pathname==='/connect.html'"));
const authApiStart=api.indexOf("   if(req.method!=='POST')"),authApiEnd=api.indexOf("   if(url.pathname==='/api/getTournament')");
if(authApiStart<0||authApiEnd<authApiStart)throw Error('Review changed API authentication before migration');
api=api.slice(0,authApiStart)+`   const input=providedInput,user=providedUser;let saved=savedProfile(user);\n`+api.slice(authApiEnd);
const monitorStart=source.indexOf('async function monitor()'),monitorEnd=source.indexOf('function stop()',monitorStart);
if(monitorStart<0||monitorEnd<monitorStart)throw Error('Review changed observation loop before migration');
const monitor=source.slice(monitorStart,monitorEnd).replace('export ','');
const mappedImports=imports.replace(/from '\.\/(.+)\.mjs'/g,"from './core/$1.js'");
const code=`// Generated from server.mjs. Transport and storage only; no economy rewrite.\nimport fs from '../src/storage.js';\nimport path from 'node:path';\nimport crypto from 'node:crypto';\n${mappedImports}\nexport function createApplication(dependencies){\nconst DATA='/data',connector=dependencies.connector;\n${bootstrap}\nasync function handle(name,providedInput,providedUser){\n const url=new URL('https://dmx.invalid/api/'+encodeURIComponent(name));\n const publicReads=['getLeaderboard','getTournaments','getClanMaps','getPublicProfile','getClanMembers'];\n const req={method:publicReads.includes(name)?'GET':'POST'};\n if(req.method==='GET')url.search=new URLSearchParams(providedInput).toString();\n const respond=(status,data)=>({status,data});\n${api}\nreturn respond(404,{error:'API endpoint not found'});\n}\nlet monitoring=false;\n${monitor}\nreturn {handle,monitor};\n}\n`;
if(/node:child_process|verifyInit|spawn\(|process\.env|let worker=/.test(code))throw Error('Unsupported host dependency remains');
fs.writeFileSync(path.join(output,'application.js'),code);
manifest.push({path:'server.mjs',sha256:crypto.createHash('sha256').update(source).digest('hex')});
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({generatedAt:Date.now(),files:manifest},null,2));
console.log('Generated application adapter from '+manifest.length+' existing modules; original files unchanged.');
