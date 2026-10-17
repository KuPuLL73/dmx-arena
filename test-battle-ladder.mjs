import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ladderStatus,ladderAward} from './battle-ladder.mjs';
import {QuestLaunch,validateLaunch,launchView} from './quest-launch.mjs';
import {GameService} from './game-service.mjs';
import {Missions} from './missions.mjs';
import {MATCH_FINISH_GRACE_MS} from './battle-timing.mjs';
const uuid='00000000-0000-4000-8000-000000000001',userId=123,now=Date.UTC(2026,9,15,12),policy=validateLaunch({mode:'open'});
function stats(score=3500,at=now,mapId='boxes_level',clanId=41,startsAt=now-60000){const endsAt=startsAt+120000;return {source:'pixel_world_api',playerId:uuid,name:'PLAYER',periods:{},clan:{source:'pixel_world_api',status:'found',playerId:uuid,id:clanId,name:'DMX',memberName:'PLAYER',memberScore:score,observedFrom:at-1000,updatedAt:at},clanWars:{source:'pixel_world_api',maps:[{map_id:mapId,segment_type:'battle',startsAt,endsAt}]},mapProgress:{source:'clan_score_schedule_observation',available:true,updatedAt:at,battles:[{mapId,clanId,startsAt,endsAt,observedSince:startsAt+1000,score,source:'clan_score_schedule_observation'}]}};}
const scope=(s,at=now)=>({now:at,mapId:s.clanWars.maps[0].map_id});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dmx-battle-ladder-'));
try{
 const launch=new QuestLaunch(dir);assert.equal(launch.read().mode,'preview');assert.equal(launchView(launch.read(),userId).claimsEnabled,false);
 assert.throws(()=>validateLaunch({mode:'pilot',pilotUserIds:[]}),/участников/);assert.throws(()=>validateLaunch({mode:'pilot',pilotUserIds:[1,1]}),/список/);
 const pilot=launch.save({mode:'pilot',pilotUserIds:[123]});assert.equal(launchView(pilot,123).claimsEnabled,true);assert.equal(launchView(pilot,456).claimsEnabled,false);launch.save(policy);assert.equal(launch.read().mode,'open');
 let awards={};const award=(questId,count=5,snapshot=stats(),at=now)=>{const row=ladderAward(userId,uuid,snapshot,awards,questId,count,policy,scope(snapshot,at));awards[row.key]=row.award;return row.award.amount;};
 assert.equal(award('clan_arms'),15);assert.equal(award('clan_contribution'),22);assert.equal(award('clan_power'),38);assert.equal(Object.values(awards).reduce((sum,a)=>sum+a.amount,0),75);
 assert.equal(ladderStatus(userId,uuid,stats(),awards,5,policy,scope(stats())).status,'collected');assert.throws(()=>award('clan_arms'),/уже начислена/);
 assert.equal(award('clan_power',5,stats(3500,now,'city_level')),75,'each map is independent');
 const next=now+180000;assert.equal(award('clan_power',5,stats(3500,next,'boxes_level',41,next-60000),next),75,'new battle on same map is payable on same day');
 assert.equal(Object.values(awards).reduce((sum,a)=>sum+a.amount,0),225);
 const afterMidnight=Date.UTC(2026,9,16,0,0,10);const across=stats(3500,afterMidnight,'temple_level',41,afterMidnight-120000);across.clanWars.maps[0].endsAt+=60000;across.mapProgress.battles[0].endsAt+=60000;assert.equal(award('clan_power',0,across,afterMidnight),50,'battle beginning yesterday is eligible, no daily reset');
 awards={};assert.equal(award('clan_power',0),50);assert.ok(ladderStatus(userId,uuid,stats(),awards,0,policy,scope(stats())).stages.every(s=>s.claimed));assert.throws(()=>award('clan_power',0,stats(3500,now,'boxes_level',99)),/уже начислена/,'clan switch cannot replay a paid stage');
 awards={};assert.equal(award('clan_arms',0),10);assert.equal(award('clan_contribution',5),27);assert.equal(award('clan_power',5),38);
 awards={};assert.throws(()=>award('clan_power',0,stats(2999)),/Порог/);assert.throws(()=>ladderAward(userId,uuid,stats(),{},'world',0,policy,scope(stats())),/готовится/);assert.throws(()=>ladderAward(456,uuid,stats(),{},'clan_arms',0,pilot,scope(stats())),/не открыто/);
 for(const change of [s=>{s.source='client';},s=>{s.playerId='foreign';},s=>{s.clan.stale=true;},s=>{s.clan.id=99;},s=>{s.mapProgress.source='client';},s=>{s.mapProgress.updatedAt=now-91000;},s=>{s.mapProgress.battles[0].observedSince=s.mapProgress.battles[0].startsAt-1;},s=>{s.clanWars.maps[0].startsAt++;},s=>{s.mapProgress.battles[0].score=-1;},s=>{s.mapProgress.battles[0].score=1.2;}]){const snapshot=stats();change(snapshot);assert.equal(ladderStatus(userId,uuid,snapshot,{},0,policy,scope(snapshot)).available,false);}
 const old=stats();old.mapProgress.updatedAt=now-31000;assert.throws(()=>ladderAward(userId,uuid,old,{},'clan_arms',0,policy,scope(old)),/Обнови/);
 const service=new GameService(dir,async()=>stats(),async()=>stats().clanWars);service.bind({id:userId},stats());
 const both=stats();const city=stats(2500,now,'city_level');both.clanWars.maps.push(city.clanWars.maps[0]);both.mapProgress.battles.push(city.mapProgress.battles[0]);
 const settled=service.settleLadders(userId,both,5,policy,{now});assert.equal(settled.amount,112);assert.equal(settled.awards.length,2);assert.equal(service.settleLadders(userId,both,5,policy,{now}).amount,0);
 assert.equal(service.rewards(userId).balance,112);const restored=new GameService(dir,async()=>stats(),async()=>stats().clanWars);assert.equal(restored.rewards(userId).balance,112);assert.equal(restored.settleLadders(userId,both,5,policy,{now}).amount,0);
 city.mapProgress.battles[0].score=3000;assert.equal(restored.settleLadders(userId,city,5,policy,{now}).amount,38);assert.equal(restored.rewards(userId).balance,150);
 assert.equal(restored.settleLadders(userId,stats(3500,next,'boxes_level',41,next-60000),0,policy,{now:next}).amount,50);assert.equal(restored.rewards(userId).balance,200);
 restored.write=()=>{throw Error('Disk unavailable');};const later=next+180000;assert.throws(()=>restored.settleLadders(userId,stats(3500,later,'boxes_level',41,later-60000),0,policy,{now:later}),/Disk/);assert.equal(restored.rewards(userId).balance,200);
 // Late old-map scores cannot issue either a new-map ladder or mission rewards.
 const flow=new GameService(path.join(dir,'late-flow'),async()=>{},async()=>{}),cut=now-60000;
 const flowMaps={source:'pixel_world_api',maps:[{map_id:'jungle_level',segment_type:'battle',startsAt:cut-3600000,endsAt:cut},{map_id:'not_factory_level',segment_type:'battle',startsAt:cut,endsAt:cut+3600000}]};
 flow.bind({id:userId},stats());flow.write('missions-launch.json',{enabled:true,startedAt:now-86400000});
 const sample=(offset,score)=>{const at=cut+offset,s=stats(score,at,'not_factory_level',41,cut);s.clanWars=flowMaps;s.mapProgress=flow.mapProgress.observe(uuid,s.clan,flowMaps);return s;};
 sample(-10000,0);sample(10000,0);let delayed=sample(40000,5000);
 assert.equal(delayed.mapProgress.battles.find(b=>b.mapId==='not_factory_level').score,0);
 assert.equal(flow.settleLadders(userId,delayed,0,policy,{now:cut+40000}).amount,0,'ambiguous 5000 must not unlock the ladder');
 const missions=new Missions(flow);missions.collect(now+600000);assert.equal(missions.rows(userId,policy,{now}).find(r=>r.id==='weekly_score').progress,0,'ambiguous points cannot unlock weekly or daily goals');
 sample(MATCH_FINISH_GRACE_MS+10000,5000);delayed=sample(MATCH_FINISH_GRACE_MS+40000,6500);
 assert.equal(flow.settleLadders(userId,delayed,0,policy,{now:cut+MATCH_FINISH_GRACE_MS+40000}).amount,10,'new-map points unlock only their own stage once old matches have finished');
 fs.writeFileSync(launch.file,'invalid');assert.throws(()=>launch.read(),/остановлены/);
 console.log('Passed: automatic settlement at goal, independent maps/battles, repeated battles same day, midnight without reset, rounding/changing bonus, atomic multi-map awards, replay/clan-switch/restart protection, stale/forged data rejected.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
