import assert from 'node:assert/strict';
import {INSTANCES,instanceByName,instanceForBot,appUrlFor} from './tgcloud/lib/instances.js';
import {receiptApi} from './js-connector/src/protocol.js';

// The live bot keeps exactly the values it had before the split.
const live=INSTANCES.production;
assert.equal(live.botUsername,'DMXARENABOT');assert.equal(live.botId,8760866719);
assert.equal(live.appUrl,'https://app8760866719.tgcloud.ai/');
assert.equal(live.workerOrigin,'https://dmx-arena-connector.dmx-arena-js-connector.workers.dev');
assert.equal(live.channelId,-1003360145165);
const test=INSTANCES.test;
assert.notEqual(test.workerOrigin,live.workerOrigin,'the test copy never shares the live Worker');
assert.notEqual(test.botUsername.toLowerCase(),live.botUsername.toLowerCase());

// Worker side: an unset variable means production, anything unknown stops.
assert.equal(instanceByName(undefined),live);assert.equal(instanceByName(''),live);
assert.equal(instanceByName('test'),test);
for(const name of ['prod','TEST','toString','__proto__'])assert.throws(()=>instanceByName(name),/Unknown DMX instance/);

// Telegram side: chosen by the bot that runs the code.
assert.equal(instanceForBot({id:8760866719,username:'DMXARENABOT'}),live);
assert.equal(instanceForBot({id:8760866719,username:'dmxarenabot'}),live);
assert.equal(instanceForBot({id:123,username:'DMXARENABOT'}),null,'a username alone cannot claim the live bot');
assert.equal(instanceForBot({id:555000111,username:'pwtrade_bot'}),test);
for(const bot of [null,{},{id:1},{username:'pwtrade_bot'},{id:-1,username:'pwtrade_bot'},{id:1,username:'other_bot'}])assert.equal(instanceForBot(bot),null);

assert.equal(appUrlFor(live,8760866719),live.appUrl);
assert.equal(appUrlFor(test,555000111),'https://app555000111.tgcloud.ai/');
assert.equal(appUrlFor(test,undefined),null);

// Subscription receipts follow the Worker's instance.
const receipt={userId:7,bot:{id:8760866719},botMember:{status:'administrator'},member:{status:'member',user:{id:7}},checkedAt:1000};
const clock=()=>1000;
assert.deepEqual(await receiptApi(receipt,7,{clock})('getMe'),{id:8760866719},'default stays the live bot');
assert.equal((await receiptApi(receipt,7,{clock,instance:live})('getChatMember',{chat_id:live.channelId,user_id:7})).status,'member');
await assert.rejects(receiptApi(receipt,7,{clock,instance:test})('getMe'),/подписку/,'the test Worker rejects live receipts');
await assert.rejects(receiptApi({...receipt,bot:{id:555000111}},7,{clock,instance:test})('getMe'),/подписку/,'no subscription checks until the test bot id is confirmed');
console.log('Instances: live values unchanged, test copy isolated, unknown bots and names rejected, receipts bound to their instance.');
