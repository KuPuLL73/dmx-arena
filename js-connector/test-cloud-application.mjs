import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{GameConnector} from './src/worker.js';
import {cleanLaunchState} from '../prepare-launch.mjs';
import {receiptApi,bridgeRequest} from './src/protocol.js';
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id=777;
const realNow=Date.now,realFetch=globalThis.fetch;let now=realNow(),points=1000;
Date.now=()=>now;
const database=new DatabaseSync(':memory:'),kv=new Map(),background=[];
kv.set('game-auth',{notgames:{accessToken:'test-only',refreshedAt:now},pixelworld:{accessToken:'test-only',refreshedAt:now}});
const priorSearch={players:{'day:test':{status:'not_listed',updatedAt:now}},clans:{},playerJobs:{},clanJobs:{}};kv.set('public-searches',structuredClone(priorSearch));
const storage={sql:{exec(query,...args){const statement=database.prepare(query);const rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}},
 transactionSync(callback){database.exec('BEGIN');try{const value=callback();database.exec('COMMIT');return value;}catch(error){database.exec('ROLLBACK');throw error;}},
 async get(key){return structuredClone(kv.get(key));},async put(key,value){kv.set(key,structuredClone(value));},async delete(key){kv.delete(key);},async setAlarm(time){kv.set('alarm',time);}};
const context={storage,blockConcurrencyWhile:callback=>callback(),waitUntil:job=>background.push(job)};
let game;
const env={PROBE_KEY:'test-probe-'.padEnd(48,'x'),DEPLOY_KEY:'test-deploy-'.padEnd(48,'y'),TELEGRAM_API_ID:'1',TELEGRAM_API_HASH:'fake',OPERATOR_SESSION:'fake',CONNECTOR:{idFromName:()=>0,get:()=>game}};
globalThis.fetch=async value=>{
 const url=new URL(value);let data;
 if(url.hostname==='bff.notcoin.tg'){
  if(url.pathname.includes('/profiles/'))data={profile:{id:String(id)}};
  else if(url.searchParams.get('display_type')==='Weapon')data={items:[{account_id:String(id),app_id:16,item_id:'1',display_type:'Weapon',collection:'Ak-69',tags:{model:{v:'Test'}},icon_url:'https://static.pw.game/test.png'}],pagination:{total:1}};
  else data={pagination:{}};
  return Response.json({data});
 }
 if(url.pathname.endsWith('/team/41'))data={team:{id:41,name:'DMX',members:[{id:uuid,username:'DMX Tester',score:points}]}};
 else if(url.pathname.endsWith('/stat/clan-wars/maps'))data={maps:[{map_id:'city_level',owner:{id:41},segment_type:'battle',segment_started_at:new Date(now-60000).toISOString(),segment_ends_at:new Date(now+3600000).toISOString()}]};
 else if(url.pathname.includes('/maps/'))data={leaderboard:{map_id:'city_level',segment_started_at:new Date(now-60000).toISOString(),segment_ends_at:new Date(now+3600000).toISOString(),teams:[{team_id:41,name:'DMX',points:1000,place:1}]}};
 else throw Error('Unexpected external request');
 return Response.json({ok:true,data});
};
async function request(path,input={},key=env.PROBE_KEY){
 const response=await worker.fetch(new Request('https://test.invalid'+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(input)}),env);
 return {status:response.status,data:await response.json()};
}
const action=(name,input={},extra={})=>request('/bridge',{action:name,input,user:{id,name:'Tester'},...extra});
try{
 game=new GameConnector(context,env);await game.ready;
 assert.equal(kv.has('public-searches'),false);assert.deepEqual(game.files.export()['connector-public-cache.json'],priorSearch,'legacy connector cache moves to segmented SQL storage');
 assert.equal((await request('/admin/status',{},env.PROBE_KEY)).status,403,'user bridge credentials cannot reset or export data');
 assert.equal((await request('/bridge',{},'forged')).status,403);
 const source={'profiles.json':{[id]:{userId:id,name:'Tester',publicId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',sets:[],active:null}},'game-links.json':{[id]:{playerId:uuid,telegramId:id,name:'DMX Tester',active:true}},'game-awards.json':{old:{amount:999}}};
 const files=cleanLaunchState(source,now);
 let status=await request('/admin/init',{files},env.DEPLOY_KEY);assert.equal(status.status,200);assert.equal(status.data.pendingBaselines,0);assert.equal(status.data.balance,0);
 assert.ok(kv.get('alarm')>now,'background observation scheduled');
 let profile=(await action('getProfile')).data;assert.equal(profile.inventory.length,1);assert.equal(profile.dmx.balance,0);assert.equal(profile.economy.claimsEnabled,false);assert.equal(profile.settings.language,'en');
 const russian=await action('getProfile',{}, {user:{id,name:'Tester',languageCode:'ru'}});assert.equal(russian.data.settings.language,'ru');
 assert.equal((await action('saveSettings',{userId:999,language:'en',privateProfile:false,name:'FORGED'})).status,200);
 assert.equal((await action('getProfile',{}, {user:{id,name:'Tester',languageCode:'ru'}})).data.settings.language,'en','manual choice overrides Telegram language');
 assert.equal((await action('saveSet',{id:'set:1',name:'Test',slots:{primary:'nft:1'}})).status,200);
 assert.equal((await action('equipSet',{id:'set:1'})).status,200);
 assert.deepEqual((await action('setQuestDismissed',{id:'nickname_dmx',dismissed:true,userId:999})).data.dismissedQuests,['nickname_dmx']);
 assert.equal((await action('setQuestDismissed',{id:'subscription',dismissed:true})).status,400);
 status=await request('/admin/activate',{},env.DEPLOY_KEY);assert.equal(status.status,200);assert.equal(status.data.mode,'open');assert.equal(status.data.balance,0);
 profile=(await action('getProfile')).data;assert.equal(profile.equipmentBonus.percent,10);assert.equal(profile.dmx.balance,50,'one-time nickname reward excludes skin bonus');
 const receipt={userId:id,bot:{id:8760866719},botMember:{status:'administrator'},member:{user:{id},status:'member'},checkedAt:now};
 let result=await action('checkSubscription',{}, {receipt});assert.equal(result.status,200);assert.equal(result.data.dmx.balance,150,'subscription excludes skin bonus');
 result=await action('checkSubscription',{}, {receipt});assert.equal(result.data.dmx.balance,150,'repeated subscription does not pay twice');
 // Reconstruct the Durable Object from the same database, like a real eviction.
 game=new GameConnector(context,env);await game.ready;
 profile=(await action('getProfile')).data;assert.equal(profile.dmx.balance,150);assert.equal(profile.active,'set:1');assert.deepEqual(profile.dismissedQuests,['nickname_dmx']);
 assert.deepEqual((await action('setQuestDismissed',{id:'nickname_dmx',dismissed:false})).data.dismissedQuests,[]);
 result=await action('checkSubscription',{}, {receipt});assert.equal(result.data.dmx.balance,150,'restart cannot repay a one-time quest');
 assert.equal((await request('/admin/init',{files},env.DEPLOY_KEY)).status,503,'live reset disabled after activation');
 assert.equal((await request('/admin/activate',{},env.DEPLOY_KEY)).data.balance,150,'activation is idempotent');
 now+=21000;points+=1000;await game.alarm();assert.ok(kv.get('alarm')>now);
 const exported=await request('/admin/export',{},env.DEPLOY_KEY);assert.equal(exported.status,200);assert.equal(exported.data.files['game-links.json'][id].playerId,uuid);
 assert.equal(exported.data.files['profiles.json'][999],undefined,'client userId cannot create or edit another player');
 assert.equal(exported.data.files['profiles.json'][id].name,'Tester');
 await assert.rejects(receiptApi({...receipt,userId:999},id)('getMe'),/Telegram/);
 await assert.rejects(receiptApi({...receipt,checkedAt:now-31000},id)('getMe'),/Telegram/);
 assert.throws(()=>bridgeRequest({action:'reset',input:{},user:{id,name:'x'}}),/Invalid action/);
 assert.throws(()=>bridgeRequest({action:'getProfile',input:{},user:{id:'777',name:'x'}}),/identity/);
 console.log('Cloud application: real SQLite persistence/restart, launch reset/baseline, separate admin key, verified identity, loadouts, fixed one-time rewards, duplicate claims and scheduled observation PASS.');
}finally{await Promise.allSettled(background);Date.now=realNow;globalThis.fetch=realFetch;database.close();}
