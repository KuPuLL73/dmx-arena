import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {GameService,publicSnapshot,questStatus} from './game-service.mjs';
import {splitClanFund} from './economy.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dmx-game-test-'));
const uuid='00000000-0000-4000-8000-000000000001',other='019c29a8-cd44-75b9-a8ae-604ad1b6c150';
const realNow=Date.now;let clock=realNow();Date.now=()=>clock;const warStart=clock-10000;
let clanScore=0,clanStale=false;
let name='DIAVOLO',day=1200,week=10000,stale=false,missingWeek=false,calls=0,wrongId=false;
const result=()=>({playerId:uuid,source:'pixel_world_api',status:'found',clan:{status:'found',source:'pixel_world_api',playerId:uuid,id:41,name:'DMX',memberName:name,memberScore:clanScore,observedFrom:Date.now()-50,updatedAt:Date.now(),stale:clanStale},updatedAt:Date.now(),progress:{day:{status:'found'},week:{status:missingWeek?'not_listed':'found'},month:{status:'found'}},periods:{
 day:{playerId:wrongId?other:uuid,name,score:day,rank:17,updatedAt:Date.now(),stale},
 week:missingWeek?null:{playerId:uuid,name,score:week,rank:9,updatedAt:Date.now(),stale},
 month:{playerId:uuid,name,score:22000,rank:10,updatedAt:Date.now(),stale}
}});
const lookup=async id=>{calls++;assert.equal(id,uuid);return result();};
const maps=async()=>({source:'pixel_world_api',maps:[{map_id:'temple_level',segment_type:'battle',startsAt:warStart,endsAt:warStart+3600000}],updatedAt:Date.now()});
const economy={claimsEnabled:true,rewards:{clan_arms:10,clan_contribution:15,clan_power:25}};
try{
 assert.deepEqual(splitClanFund(1000,[1,2]).map(row=>row.amount),[500,500]);assert.deepEqual(splitClanFund(1000,[1,2,3]).map(row=>row.amount),[334,333,333]);assert.deepEqual(splitClanFund(1000,[]),[]);
 const eleven=Array.from({length:11},(_,i)=>i+1),shares=splitClanFund(1000,eleven);assert.equal(shares.length,10);assert.equal(shares.reduce((sum,row)=>sum+row.amount,0),1000);assert.ok(shares.every(row=>row.amount===100));assert.throws(()=>splitClanFund(1000,[1,1]),/Invalid/);assert.throws(()=>splitClanFund(-1,[1]),/Invalid/);
 const draft=new GameService(dir,lookup,maps);
 const snapshot=await draft.find(uuid,{waitMs:0});assert.equal(snapshot.name,'DIAVOLO');assert.equal(snapshot.dayPoints,1200);
 assert.throws(()=>draft.bind({id:123},{...snapshot,name:null}),/Дождись/);
 draft.bind({id:123},snapshot);assert.equal(draft.links[123].telegramId,123);assert.equal(draft.links[123].dataVerified,true);assert.equal(draft.links[123].ownershipVerified,false);assert.equal(draft.link(123).active,true);
 assert.throws(()=>draft.bind({id:456},snapshot),/другим Telegram/);
 assert.throws(()=>draft.bind({id:123},{...snapshot,playerId:other}),/строку/);
 assert.throws(()=>publicSnapshot({...result(),playerId:other},uuid),/другого/);
 wrongId=true;await assert.rejects(()=>draft.find(uuid,{waitMs:0}),/строку/);wrongId=false;
 assert.equal(questStatus(snapshot)[0].reward,null);assert.equal(questStatus(snapshot)[0].claimEnabled,false);
 const ownership=questStatus(snapshot).find(q=>q.id==='clan_ownership_ladder');assert.equal(ownership.progress,null);assert.equal(ownership.claimEnabled,false);assert.deepEqual(ownership.stages,[3,4,5,6]);
 assert.throws(()=>draft.claim(123,snapshot,'warmup'),/ещё не запущен/);assert.equal(draft.rewards(123).balance,0);
 name='UPDATED';let synced=await draft.sync(123);assert.equal(synced.name,'UPDATED');assert.equal(draft.links[123].name,'UPDATED');
 missingWeek=true;synced=await draft.sync(123);assert.equal(synced.weekPoints,null);assert.equal(questStatus(synced,[],economy)[0].progress,0,'ordinary weekly points never fill a clan quest');missingWeek=false;
 const active=new GameService(dir,lookup,maps,economy);assert.equal(active.links[123].telegramId,123);
 clock+=1000;clanScore=999;synced=await active.sync(123);assert.throws(()=>active.claim(123,synced,'clan_arms'),/не выполнено/);
 clock+=1000;clanStale=true;clanScore=3500;synced=await active.sync(123);assert.throws(()=>active.claim(123,synced,'clan_arms'),/подтверждения/);clanStale=false;
 clock+=1000;synced=await active.sync(123);
 const ordinaryOnly={...synced,mapProgress:undefined};assert.ok(questStatus(ordinaryOnly,[],economy).filter(q=>q.kind==='clan_war').every(q=>!q.available&&q.progress===null),'large normal game totals never substitute for clan observations');
 assert.ok(questStatus(synced).every(q=>!['warmup','tempo'].includes(q.id)));assert.equal(questStatus(synced)[0].progress,3500);
 const otherClan={...synced,clan:{...synced.clan,id:5}};assert.equal(questStatus(otherClan)[0].progress,null,'another clan cannot use these battle points');
 const old={...synced,mapProgress:{...synced.mapProgress,updatedAt:Date.now()-31000}};assert.throws(()=>active.claim(123,old,'clan_arms'),/Обнови/);
 assert.throws(()=>active.claim(123,{...synced,playerId:other},'clan_arms'),/своего/);
 assert.equal(active.claim(123,synced,'clan_arms'),10);assert.equal(active.claim(123,synced,'clan_contribution'),15);assert.equal(active.claim(123,synced,'clan_power'),25);
 assert.equal(active.rewards(123).score,50);assert.throws(()=>active.claim(123,synced,'clan_arms'),/уже получена/);
 active.unlink(123);assert.equal(active.link(123),null);assert.equal(active.links[123].active,false);assert.equal(active.rewards(123).balance,50);
 assert.throws(()=>active.bind({id:456},synced),/другим Telegram/);
 const disconnected=new GameService(dir,lookup,maps,economy);assert.throws(()=>disconnected.bind({id:456},synced),/другим Telegram/);
 assert.throws(()=>disconnected.bind({id:123},publicSnapshot({...result(),playerId:other,clan:{...result().clan,playerId:other},periods:Object.fromEntries(Object.entries(result().periods).map(([p,r])=>[p,r?{...r,playerId:other}:null]))},other)),/другой игровой ID/);
 active.bind({id:123},synced);assert.throws(()=>active.claim(123,synced,'clan_arms'),/уже получена/);
 const restored=new GameService(dir,lookup,maps,economy);assert.equal(restored.rewards(123).balance,50);assert.equal(restored.links[123].name,'UPDATED');
 const next=new GameService(dir,lookup,maps,{...economy,rewards:{clan_arms:20,clan_contribution:15,clan_power:25}});assert.equal(next.rewards(123).score,50);assert.throws(()=>next.claim(123,synced,'clan_arms'),/уже получена/);
 const legacy={[uuid+':season1:warmup']:{userId:123,playerId:uuid,seasonId:'season1',questId:'warmup',amount:100},[uuid+':season2:tempo']:{userId:123,playerId:uuid,seasonId:'season2',questId:'tempo',amount:300},invalid:{userId:123,amount:-5},other:{userId:456,amount:999}};
 fs.writeFileSync(path.join(dir,'game-awards.json'),JSON.stringify(legacy));const migrated=new GameService(dir,lookup,maps,economy);assert.equal(migrated.rewards(123).balance,400);assert.deepEqual(migrated.rewards(123).claimed,['warmup','tempo']);assert.throws(()=>migrated.claim(123,synced,'warmup'),/клановых войнах/);
 assert.ok(calls>0);
 console.log('Passed: exact UUID/public row validation, Telegram association uniqueness, draft issuance blocked, live nickname updates, absent/stale scores, thresholds, reward replay across unlink/rebind, lifetime totals and legacy-award persistence.');
}finally{Date.now=realNow;fs.rmSync(dir,{recursive:true,force:true});}
