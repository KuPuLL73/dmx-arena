import fs from 'node:fs';
import assert from 'node:assert/strict';
import {INSTANCES,resetCurrentBot} from '../tgcloud/lib/instances.js';
const LIVE=INSTANCES.production.workerOrigin,TEST=INSTANCES.test.workerOrigin;
let config={origin:LIVE,key:'private-test-key'.padEnd(48,'x')},received,calls=0,offline=false,url=null;
let me={id:8760866719,username:'DMXARENABOT'};
class EndpointError extends Error{}
globalThis.__DMX_SDK_FIXTURE__={EndpointError,db:{get:async()=>({value:JSON.stringify(config)})},
 api:{getMe:async()=>me,getChatMember:async input=>({status:'administrator',user:{id:input.user_id}})},
 fetch:async(target,options)=>{calls++;url=target;received=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer '+config.key);if(offline)throw Error(config.key);return {status:200,json:async()=>({ok:true})};}
};
try{
 // The bridge shares the same instance module (and getMe cache) as this test.
 const source=fs.readFileSync(new URL('../tgcloud/lib/bridge.js',import.meta.url),'utf8')
  .replace("import {api,db,fetch,EndpointError} from 'sdk';",'const {api,db,fetch,EndpointError}=globalThis.__DMX_SDK_FIXTURE__;')
  .replace("from './instances.js'","from '"+new URL('../tgcloud/lib/instances.js',import.meta.url).href+"'");
 const {callApplication}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const ctx={initData:{user:{id:777,first_name:'Tester',language_code:'ru'}}};
 await assert.rejects(callApplication('getProfile',{},{}),/Telegram/);assert.equal(calls,0);
 await assert.rejects(callApplication('getProfile',[],ctx),/запрос/);
 await callApplication('getProfile',{user:{id:999},userId:999,languageCode:'en',receipt:{userId:999}},ctx);
 assert.equal(url,LIVE+'/bridge','the live bot reaches only the live Worker');
 assert.equal(received.user.languageCode,'ru','automatic language comes from Telegram identity');
 assert.equal(received.user.id,777);assert.equal(received.receipt,undefined,'input cannot inject a subscription receipt');
 await callApplication('checkSubscription',{receipt:{userId:999}},ctx);
 assert.equal(received.receipt.userId,777);assert.equal(received.receipt.member.user.id,777);
 config.origin='https://evil.invalid';await assert.rejects(callApplication('getProfile',{},ctx),/проверки/);assert.equal(calls,2);
 config.origin=LIVE;offline=true;
 await assert.rejects(callApplication('getProfile',{},ctx),error=>!error.message.includes(config.key)&&error.message.includes('ареной'));
 offline=false;

 // Test bot: reaches only the test Worker and refuses the live Worker's settings.
 resetCurrentBot();me={id:555000111,username:'pwtrade_bot'};calls=0;
 await assert.rejects(callApplication('getProfile',{},ctx),/проверки/,'a test bot holding live settings stops');assert.equal(calls,0);
 config.origin=TEST;
 await callApplication('getProfile',{},ctx);assert.equal(url,TEST+'/bridge');assert.equal(calls,1);
 await assert.rejects(callApplication('checkSubscription',{},ctx),/подписку/,'subscription waits for a confirmed test bot id');assert.equal(calls,1);

 // An unknown bot, or one impersonating the live username with another id, reaches nothing.
 for(const bot of [{id:42,username:'someone_else_bot'},{id:42,username:'DMXARENABOT'}]){
  resetCurrentBot();me=bot;config.origin=LIVE;
  await assert.rejects(callApplication('getProfile',{},ctx),/не настроен/);
 }
 assert.equal(calls,1);
 // A failed getMe is not cached.
 resetCurrentBot();me=null;let failing=true;
 globalThis.__DMX_SDK_FIXTURE__.api.getMe=async()=>{if(failing)throw Error('offline');return {id:8760866719,username:'DMXARENABOT'};};
 await assert.rejects(callApplication('getProfile',{},ctx),/недоступна/);failing=false;
 await callApplication('getProfile',{},ctx);assert.equal(url,LIVE+'/bridge');
 console.log('Telegram bridge: verified user, private credential, per-bot destination, unknown-bot rejection, forged receipt rejection and safe errors PASS.');
}finally{resetCurrentBot();delete globalThis.__DMX_SDK_FIXTURE__;}
