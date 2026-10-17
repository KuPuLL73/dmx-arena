import assert from 'node:assert/strict';
import {PublicGameData} from './src/public-game.js';
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let now=100000,foundId=70,fail=false,requested=[];
const player={playerId:uuid,name:'Correct player',score:123,rank:60,avatar:''};
const client={rosters:new Map(),
 async maps(){return {maps:[{owner:{id:42}}]};},
 async roster(id){if(fail)throw Error('offline');return {id,name:'Clan '+id,avatar:'',members:id===foundId?[{playerId:uuid,name:'Correct member',score:987}]:[{playerId:foreign,name:'Other',score:555}],observedFrom:now,updatedAt:now};},
 async playerPage(period,page){if(fail)throw Error('offline');return {total:period==='day'?100:0,players:period==='day'&&page===2?[player]:[{...player,playerId:foreign,name:'Operator'}]};},
 async clanPage(page){requested.push(page);assert.equal(page,1,'remaining clan rosters must finish before fetching the next page');return {total:35,teams:Array.from({length:35},(_,i)=>i+50)};}
};
let persistence=0;const background=[];
const state={},service=new PublicGameData(client,{state,clock:()=>now,changed:()=>persistence++,background:job=>background.push(job)});
async function lookup(){const value=await service.lookup(uuid);await Promise.all(background.splice(0));return value;}
for(let i=0;i<10&&state.clanJobs[uuid]?.status!=='found';i++)await lookup();
let result=await lookup();
assert.equal(result.status,'found');assert.equal(result.name,'Correct player');assert.equal(result.clan.id,70);
assert.equal(result.clan.memberScore,987);assert.equal(result.periods.day.score,123);assert.equal(result.periods.week,null);assert.equal(result.periods.month,null);
assert.deepEqual(requested,[1]);assert.ok(persistence>0);
// Error leaves the last confirmed values marked stale, never replaces with the operator.
now+=50000;fail=true;await lookup();result=await lookup();assert.equal(result.name,'Correct player');assert.equal(result.periods.day.stale,true);assert.equal(result.clan.stale,true);
await assert.rejects(service.lookup('not-a-uuid'),/Invalid game UUID/);
// Resume unfinished clan searches after a fresh instance (Durable Object eviction).
fail=false;foundId=999;now+=50000;
const missingState={},missing=new PublicGameData(client,{state:missingState,clock:()=>now});
await missing.clan(uuid);
const resumed=new PublicGameData(client,{state:JSON.parse(JSON.stringify(missingState)),clock:()=>now});
for(let i=0;i<15&&resumed.state.clanJobs[uuid].status==='searching';i++)await resumed.clan(uuid);
assert.equal(resumed.state.clanJobs[uuid].status,'not_found');
assert.equal((await resumed.clan(uuid)).status,'not_found');
assert.equal(resumed.state.clans[uuid].memberScore,undefined);
console.log('Public game search: exact UID, pagination, clan continuation, persisted resume, missing periods and stale/error protection PASS.');
