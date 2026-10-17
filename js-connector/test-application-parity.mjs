import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createApplication} from './generated/application.js';
import {withFiles} from './src/storage.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'dmx-migration-parity-'));
const actualNow=Date.now,now=actualNow();Date.now=()=>now;
const user={id:777,name:'Test',photoUrl:null},uuid='00000000-0000-4000-8000-000000000001',publicId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const item={id:'nft:1',name:'Test skin',collection:'Ak-69',slot:'Ak-69',image:'https://static.pw.game/test.png',source:'notgames',owned:true};
const clan={status:'found',id:41,name:'DMX',memberName:'DMX Tester',memberScore:1000,playerId:uuid,source:'pixel_world_api',observedFrom:now,updatedAt:now};
const snapshot={source:'pixel_world_api',playerId:uuid,status:'found',periods:{day:{playerId:uuid,name:'DMX Tester',rank:1,score:1000,updatedAt:now},week:null,month:null},clan,progress:{day:{status:'found'},week:{status:'not_listed'},month:{status:'not_listed'}},updatedAt:now};
const initial={
 'profiles.json':{777:{userId:777,name:'Test',publicId,sets:[],active:null},999:{userId:999,name:'Other',publicId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',sets:[],active:null}},
 'game-links.json':{},'game-awards.json':{},'quest-launch.json':{mode:'preview'},
 'missions-launch.json':{enabled:true,startedAt:now},'daily-map-launch.json':{startedAt:now}
};
const map=new Map(Object.entries(initial).map(([name,value])=>['/data/'+name,JSON.stringify(value)]));
const memory={get:name=>map.get(name),set:(name,value)=>map.set(name,value),rename:(from,to)=>{assert.ok(map.has(from));map.set(to,map.get(from));map.delete(from);}};
const connector=async input=>{
 if(input.kind==='inventory')return structuredClone([item]);
 if(input.kind==='lookupPlayer')return structuredClone(snapshot);
 if(input.kind==='clanPlayer')return structuredClone(clan);
 if(input.kind==='clanWars')return {maps:[],updatedAt:now,source:'pixel_world_api'};
 throw Error('Unknown fixture operation');
};
let server;
try{
 for(const [name,value] of Object.entries(initial))fs.writeFileSync(path.join(directory,name),JSON.stringify(value));
 let original=fs.readFileSync(path.join(root,'server.mjs'),'utf8');
 original=original.replace(/from '(\.\/.+\.mjs)'/g,(_,relative)=>"from '"+pathToFileURL(path.join(root,relative)).href+"'");
 const from=original.indexOf('let worker=null,next=0;'),to=original.indexOf('const inventory=');
 assert.ok(from>0&&to>from);
 original=original.slice(0,from)+'let worker=null;\nconst connector=globalThis.__DMX_PARITY_CONNECTOR__;\n'+original.slice(to);
 globalThis.__DMX_PARITY_CONNECTOR__=connector;
 const token='fixture-only-token';process.env.DMX_DATA_DIR=directory;process.env.DMX_BOT_TOKEN=token;
 const file=path.join(directory,'original-server.mjs');fs.writeFileSync(file,original);
 ({server}=await import(pathToFileURL(file)));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const auth=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:user.id,first_name:user.name})});
 const key=crypto.createHmac('sha256','WebAppData').update(token).digest();
 auth.set('hash',crypto.createHmac('sha256',key).update([...auth].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 const app=withFiles(memory,()=>createApplication({connector,telegramApi:async()=>{throw Error('Fixture does not call Telegram');}}));
 const publicReads=new Set(['getLeaderboard','getTournaments','getClanMaps','getPublicProfile','getClanMembers']);
 const actions=[
  ['getProfile',{}],['setQuestDismissed',{id:'nickname_dmx',dismissed:true,userId:999}],['getProfile',{}],['setQuestDismissed',{id:'nickname_dmx',dismissed:false}],['saveSettings',{language:'en',privateProfile:false,name:'FORGED',userId:999}],
  ['lookupPlayer',{playerId:uuid}],['linkPlayer',{playerId:uuid}],
  ['saveSet',{id:'set:1',name:'My set',slots:{primary:item.id}}],['equipSet',{id:'set:1'}],
  ['getProfile',{}],['getLeaderboard',{}],['getLeaderboard',{group:'clans'}],['getClanMembers',{id:41}],
  ['getPublicProfile',{id:publicId}],['getClanMaps',{}],['getTournaments',{}],
  ['saveSet',{id:'set:forged',name:'Fake',slots:{primary:'nft:foreign'}}],
  ['saveSettings',{privateProfile:true,language:'ru'}],['getPublicProfile',{id:publicId}],
  ['deleteSet',{id:'set:1'}],['unlinkGame',{}],['getProfile',{}]
 ];
 for(const [name,input] of actions){
  const isPublic=publicReads.has(name),query=isPublic?'?'+new URLSearchParams(input):'';
  const response=await fetch(origin+'/api/'+name+query,{method:isPublic?'GET':'POST',headers:{'Content-Type':'application/json','X-DMX-Request':'1',Authorization:'tma '+auth},...(!isPublic?{body:JSON.stringify(input)}:{})});
  const expected={status:response.status,data:await response.json()};
  const actual=await withFiles(memory,()=>app.handle(name,input,user));
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected,'API parity: '+name);
 }
 assert.deepEqual(JSON.parse(map.get('/data/game-awards.json')),JSON.parse(fs.readFileSync(path.join(directory,'game-awards.json'))));
 const profiles=JSON.parse(map.get('/data/profiles.json'));
 assert.equal(profiles[999].language,undefined,'a client-supplied userId cannot change another player');
 assert.equal(profiles[777].name,'Test','game nickname cannot be edited by the client');
 assert.equal(profiles[999].dismissedQuests,undefined,'quest preferences belong only to the verified user');
 console.log('Passed: 22 API operations match the original application exactly; foreign-item/user injection rejected; quest preferences, privacy, sets, UID reservations and awards preserved.');
}finally{
 Date.now=actualNow;delete globalThis.__DMX_PARITY_CONNECTOR__;
 if(server)await new Promise(resolve=>server.close(resolve));
 assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('dmx-migration-parity-'));
 fs.rmSync(directory,{recursive:true,force:true});
}
