import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MapProgress} from './map-progress.mjs';
import {rankClans} from './domain.mjs';
import {MATCH_FINISH_GRACE_MS,BATTLE_FINALIZATION_DELAY_MS} from './battle-timing.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dmx-map-test-')),uuid='00000000-0000-4000-8000-000000000001';
const start=Date.parse('2026-10-12T19:00:00Z'),maps={maps:[{map_id:'victory_street_level',segment_type:'battle',startsAt:start,endsAt:start+3600000},{map_id:'lost_city_level',segment_type:'ownership',startsAt:start-82800000,endsAt:start+3600000,lastBattle:{mapId:'lost_city_level',startsAt:start-86400000,endsAt:start-82800000,source:'pixel_world_api'}}]};
const clan=(time,score,id=41)=>({status:'found',source:'pixel_world_api',playerId:uuid,id,name:'DMX & VOLOLO',memberScore:score,observedFrom:time-100,updatedAt:time,stale:false});
try{
 const tracker=new MapProgress(dir);let state=tracker.observe(uuid,clan(start+1000,5000),maps);
 assert.equal(state.maps[0].score,0,'old cumulative points are not backfilled');
 state=tracker.observe(uuid,clan(start+31000,6000),maps);assert.equal(state.maps[0].score,1000);assert.equal(state.completed,1);
 assert.equal(state.battles[0].score,1000,'battle score is a new delta, not the cumulative member counter');
 assert.equal(state.battles[0].clanId,41);assert.equal(state.battles[0].isLowerBound,true);
 state=tracker.observe(uuid,clan(start+31000,6000),maps);assert.equal(state.maps[0].score,1000,'same API sample cannot count twice');
 state=tracker.observe(uuid,{...clan(start+61000,8000),stale:true},maps);assert.equal(state.maps[0].score,1000,'stale cached score ignored');
 state=tracker.observe(uuid,clan(start+131000,6500),maps);assert.equal(state.maps[0].score,1000);assert.equal(state.unassigned,500,'gap is unassigned');
 state=tracker.observe(uuid,clan(start+161000,0),maps);assert.equal(state.maps[0].score,1000,'counter reset never grants points');
 state=tracker.observe(uuid,clan(start+191000,50,5),maps);assert.equal(state.maps[0].score,1000,'clan change resets baseline');
 const restore=new MapProgress(dir);assert.equal(restore.view(uuid,maps).maps[0].score,1000);
 assert.equal(restore.view(uuid,maps).battles[0].score,0,'another clan has its own battle contribution');
 const tomorrow={maps:[{...maps.maps[0],startsAt:start+86400000,endsAt:start+90000000}]};
 state=tracker.observe(uuid,clan(start+86401000,50,5),tomorrow);
 assert.equal(state.battles.find(b=>b.startsAt===tomorrow.maps[0].startsAt).score,0,'a new battle never inherits a prior battle total');
 const edge='019c29a8-cd44-75b9-a8ae-604ad1b6c150',edgeClan=(t,n)=>({...clan(t,n),playerId:edge});
 tracker.observe(edge,edgeClan(start+3590000,10),maps);state=tracker.observe(edge,edgeClan(start+3610000,100),maps);assert.equal(state.completed,0);assert.equal(state.battles[0].score,90,'late finish belongs to the only eligible previous battle');assert.equal(state.unassigned,0);
 // A match entered on map A may finish four minutes into map B. Neither a
 // baseline inside B nor a restart makes that ambiguous increase B's points.
 const delayed='019c29a8-cd44-75b9-a8ae-604ad1b6c160',finish=start+3600000;
 const adjacent={maps:[maps.maps[0],{map_id:'not_factory_level',segment_type:'battle',startsAt:finish,endsAt:finish+3600000}]};
 const sample=(offset,score)=>tracker.observe(delayed,{...clan(finish+offset,score),playerId:delayed},adjacent);
 sample(-31000,5000);sample(-1000,5200);sample(20000,5200);
 state=sample(50000,5305);
 assert.equal(state.battles.find(b=>b.mapId==='not_factory_level').score,0,'reported 105 late points never fill the next map');
 assert.equal(state.battles.find(b=>b.mapId==='victory_street_level').score,200);
 assert.equal(state.pending[0].score,105);assert.equal(state.pending[0].candidates.length,2);assert.equal(state.lastReason,'map_overlap');
 sample(120000,5305);sample(180000,5405);sample(MATCH_FINISH_GRACE_MS+1000,5505);
 state=sample(MATCH_FINISH_GRACE_MS+31000,5705);
 assert.equal(state.battles.find(b=>b.mapId==='not_factory_level').score,200,'normal new-map gains resume after the last old match can finish');
 assert.equal(state.unassigned,305);assert.equal(state.pending.reduce((n,p)=>n+p.score,0),305);
 const resumed=new MapProgress(dir);assert.equal(resumed.view(delayed,adjacent).pending.reduce((n,p)=>n+p.score,0),305);
 state=resumed.observe(delayed,{...clan(finish+MATCH_FINISH_GRACE_MS+31000,5705),playerId:delayed},adjacent);
 assert.equal(state.unassigned,305,'same observation cannot repeat the ambiguous credit');
 const overlap={maps:[...maps.maps,{map_id:'other',segment_type:'battle',startsAt:start,endsAt:start+3600000}]};
 const another='019c29a8-cd44-75b9-a8ae-604ad1b6c151';tracker.observe(another,{...clan(start+1000,0),playerId:another},overlap);state=tracker.observe(another,{...clan(start+31000,500),playerId:another},overlap);assert.equal(state.completed,0);assert.equal(state.unassigned,500,'overlapping battles are ambiguous');
 // Capture/defense counters use finalized results, prior owner and personal 1000+ contribution.
 for(const [suffix,owner,type,score] of [['152',55,'captured',1000],['153',41,'defended',1000],['154',undefined,'unclassified',1000],['155',55,null,999]]){
  const id='019c29a8-cd44-75b9-a8ae-604ad1b6c'+suffix,finish=start+60000;
  const official={source:'pixel_world_api',updatedAt:start+1000,maps:[{map_id:'boxes_level',segment_type:'battle',startsAt:start,endsAt:finish,...(owner===undefined?{}:{owner:{id:owner}})}]};
  tracker.observe(id,{...clan(start+1000,0),playerId:id},official);
  tracker.observe(id,{...clan(start+31000,score),playerId:id},official);
  const result={mapId:'boxes_level',startsAt:start,endsAt:finish,source:'pixel_world_api',updatedAt:finish+2000,teams:[{id:41,rank:1,score:10000}]};
  const completed={source:'pixel_world_api',updatedAt:finish+2000,maps:[{map_id:'boxes_level',segment_type:'ownership',startsAt:finish,endsAt:finish+3600000,owner:{id:41},lastBattle:result}]};
  let view=tracker.observe(id,{...clan(finish+2000,score),playerId:id},completed);assert.equal(view.territoryStats.total,0,'results wait until old matches finish');
  completed.updatedAt=finish+BATTLE_FINALIZATION_DELAY_MS+2000;
  view=tracker.observe(id,{...clan(completed.updatedAt,score),playerId:id},completed);assert.equal(view.territoryStats.total,0,'cached pre-finalization result is not final winner proof');
  result.updatedAt=completed.updatedAt;
  view=tracker.observe(id,{...clan(completed.updatedAt+1,score),playerId:id},completed);assert.equal(view.territoryStats.total,type?1:0);if(type)assert.equal(view.territoryStats[type],1);
  view=tracker.observe(id,{...clan(completed.updatedAt+30000,score),playerId:id},completed);assert.equal(view.territoryStats.total,type?1:0,'one battle cannot increase counters twice');
  const again=new MapProgress(dir);assert.equal(again.view(id,completed).territoryStats.total,type?1:0,'counters survive restart');
 }
 const roster=(userId,id,name)=>({userId,link:{playerId:uuid},gameStats:{clan:{status:'found',source:'pixel_world_api',playerId:uuid,id,name}}});
 const rows=[roster(1,41,'DMX'),roster(2,41,'DMX'),roster(3,5,'HEGEMONY')];
 const awards={a:{},[uuid+':season1:warmup']:{userId:1,amount:100,clan:{id:41,name:'DMX'}},[uuid+':season2:tempo']:{userId:1,amount:9999,clan:{id:41,name:'DMX'}},[uuid+':season1:tempo']:{userId:99,amount:9999,clan:{id:5,name:'HEGEMONY'}}};
 for(const row of rows){row.score=Object.values(awards).filter(a=>a.userId===row.userId).reduce((sum,a)=>sum+a.amount,0);row.scoreVerified=true;}
 assert.deepEqual(rankClans(rows,awards).map(c=>[c.clanId,c.score,c.members]),[[41,10099,2],[5,0,1]],'all legacy periods contribute to lifetime DMX');
 rows[0].gameStats.clan={...rows[0].gameStats.clan,id:5,name:'HEGEMONY'};assert.equal(rankClans(rows,awards)[0].clanId,5,'clan totals follow current member balances');
 assert.equal(awards[uuid+':season1:warmup'].clan.id,41,'original award attribution remains unchanged in history');
 console.log('Passed: schedule-based deltas, no old-score backfill, stale/gap/reset/overlap/boundary handling, finalized capture/defense counters with owner history and replay protection, persistence, clan ranking and stable award attribution.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
