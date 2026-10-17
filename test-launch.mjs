import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {cleanLaunchState,prepareLaunch} from './prepare-launch.mjs';
import {GameService} from './game-service.mjs';
import {Missions} from './missions.mjs';
import {subscriptionBoard} from './telegram-quest.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dmx-clean-launch-')),now=Date.now(),uuid='11111111-1111-4111-8111-111111111111';
try{
 const source={
  'profiles.json':{22:{userId:22,publicId:'public-player',sets:[{id:'set',slots:{head:'nft:1'}}],active:'set',language:'en',privateProfile:true,link:{playerId:uuid},gameStats:{mapProgress:{battles:[{score:3000}]}},dmx:{balance:999},score:999,claimed:['nickname_dmx']}},
  'game-links.json':{22:{playerId:uuid,name:'DMX_PLAYER',telegramId:22,linkedAt:now-86400000}},
  'game-awards.json':{test:{userId:22,amount:999,questId:'nickname_dmx'}},'game-map-progress.json':{[uuid]:{points:{temple_level:3000}}},
  'missions-state.json':{events:{battle:{score:3000}},rankings:{battle:[uuid]}},'tournament-settings.json':{organizerIds:[22]}
 };
 const original=JSON.stringify(source),clean=cleanLaunchState(source,now);
 assert.equal(JSON.stringify(source),original);
 assert.deepEqual(clean['game-awards.json'],{});assert.deepEqual(clean['game-map-progress.json'],{});assert.deepEqual(clean['missions-state.json'],{events:{},rankings:{}});
 for(const key of ['gameStats','dmx','score','claimed'])assert.equal(clean['profiles.json'][22][key],undefined);
 for(const key of ['publicId','sets','active','language','privateProfile'])assert.deepEqual(clean['profiles.json'][22][key],source['profiles.json'][22][key]);
 assert.deepEqual(clean['game-links.json'],source['game-links.json']);assert.equal(clean['quest-launch.json'].mode,'preview');
 for(const [name,value] of Object.entries(source))fs.writeFileSync(path.join(directory,name),JSON.stringify(value));
 const result=prepareLaunch(directory,{now}),game=new GameService(result.directory,async()=>{},async()=>{}),missions=new Missions(game);
 assert.equal(game.rewards(22).balance,0);assert.equal(subscriptionBoard(game,22).claimed,false);
 assert.ok(missions.rows(22,clean['quest-launch.json'],{now}).every(row=>!row.claimed&&!row.ready&&row.progress===0));
 assert.equal(game.mapProgress.view(uuid,{maps:[]}).territoryStats.total,0);
 assert.equal(fs.readFileSync(path.join(directory,'game-awards.json'),'utf8'),JSON.stringify(source['game-awards.json']));
 assert.equal(fs.readFileSync(path.join(result.directory,'source-backup','game-awards.json'),'utf8'),JSON.stringify(source['game-awards.json']));
 assert.throws(()=>prepareLaunch(directory,{now,target:result.directory}),/EEXIST/);
 assert.throws(()=>prepareLaunch(directory,{now,target:directory}),/EEXIST/);
 console.log('Passed: clean launch clears every reward/progress/cache, preserves UID/skins/sets/settings, disables payouts, backs up source and cannot overwrite existing data.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
