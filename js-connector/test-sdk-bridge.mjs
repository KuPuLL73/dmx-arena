import fs from 'node:fs';
import assert from 'node:assert/strict';
let config={origin:'https://dmx-arena-connector.dmx-arena-js-connector.workers.dev',key:'private-test-key'.padEnd(48,'x')},received,calls=0,offline=false;
class EndpointError extends Error{}
globalThis.__DMX_SDK_FIXTURE__={EndpointError,db:{get:async()=>({value:JSON.stringify(config)})},
 api:{getMe:async()=>({id:8760866719}),getChatMember:async input=>({status:'administrator',user:{id:input.user_id}})},
 fetch:async(url,options)=>{calls++;received=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer '+config.key);if(offline)throw Error(config.key);return {status:200,json:async()=>({ok:true})};}
};
try{
 const source=fs.readFileSync(new URL('../tgcloud/lib/bridge.js',import.meta.url),'utf8').replace("import {api,db,fetch,EndpointError} from 'sdk';",'const {api,db,fetch,EndpointError}=globalThis.__DMX_SDK_FIXTURE__;');
 const {callApplication}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const ctx={initData:{user:{id:777,first_name:'Tester',language_code:'ru'}}};
 await assert.rejects(callApplication('getProfile',{},{}),/Telegram/);assert.equal(calls,0);
 await assert.rejects(callApplication('getProfile',[],ctx),/запрос/);
 await callApplication('getProfile',{user:{id:999},userId:999,languageCode:'en',receipt:{userId:999}},ctx);
 assert.equal(received.user.languageCode,'ru','automatic language comes from Telegram identity');
 assert.equal(received.user.id,777);assert.equal(received.receipt,undefined,'input cannot inject a subscription receipt');
 await callApplication('checkSubscription',{receipt:{userId:999}},ctx);
 assert.equal(received.receipt.userId,777);assert.equal(received.receipt.member.user.id,777);
 config.origin='https://evil.invalid';await assert.rejects(callApplication('getProfile',{},ctx),/проверки/);assert.equal(calls,2);
 config.origin='https://dmx-arena-connector.dmx-arena-js-connector.workers.dev';offline=true;
 await assert.rejects(callApplication('getProfile',{},ctx),error=>!error.message.includes(config.key)&&error.message.includes('ареной'));
 console.log('Telegram bridge: verified user, private credential, fixed destination, forged receipt rejection and safe errors PASS.');
}finally{delete globalThis.__DMX_SDK_FIXTURE__;}
