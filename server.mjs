import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {validateSet,validatePreview,rankPlayers,rankClans,clanMembers} from './domain.mjs';
import {GameService,publicSnapshot} from './game-service.mjs';
import {ECONOMY} from './economy.mjs';
import {QuestLaunch,launchView} from './quest-launch.mjs';
import {Tournaments,organizerIds} from './tournaments.mjs';
import {assetSlot,savedLoadout,assertItemsAvailable} from './loadout.mjs';
import {equipmentBonus,equipSlot} from './equipment.mjs';
import {skinReward} from './economy.mjs';
import {telegramPhoto,viewInventory,publicProfile} from './profile-view.mjs';
import {profileSettings,updateProfileSettings} from './profile-settings.mjs';
import {Missions} from './missions.mjs';
import {TelegramQuest,subscriptionBoard} from './telegram-quest.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),DIST=path.join(ROOT,'dist'),DATA=path.resolve(process.env.DMX_DATA_DIR||path.join(ROOT,'.data'));
function envFile(file){if(!fs.existsSync(file))return {};return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const p=l.indexOf('=');return [l.slice(0,p).trim(),l.slice(p+1).trim().replace(/^['"]|['"]$/g,'')];}));}
const token=process.env.DMX_BOT_TOKEN||envFile(path.join(ROOT,'.env')).TELEGRAM_BOT_TOKEN||'';
const game=new GameService(DATA,(playerId,force)=>connector({kind:'lookupPlayer',playerId,force}),()=>connector({kind:'clanWars'}),ECONOMY,(playerId,force)=>connector({kind:'clanPlayer',playerId,force}));
const questLaunch=new QuestLaunch(DATA);
const missions=new Missions(game),telegramQuest=new TelegramQuest(game,token);
const questRewardErrors=new Map();
function questBoard(userId,stats,bonus){
 const policy=questLaunch.read(),base=game.ladder(userId,stats,bonus.count,policy);
 const maps=(stats?.clanWars?.maps||[]).map(map=>game.ladder(userId,stats,bonus.count,policy,{mapId:map.map_id}));
 const history=Object.values(game.awards).filter(a=>a.userId===userId&&a.version===base.version).sort((a,b)=>b.issuedAt-a.issuedAt);
 return {...base,maps,subscription:subscriptionBoard(game,userId),missions:missions.board(userId,policy,{skinCount:bonus.count,stats}),automatic:true,error:questRewardErrors.get(userId)||null,totalEarned:history.reduce((sum,row)=>sum+row.amount,0),history:history.slice(0,12).map(a=>({mapId:a.battle.mapId,startsAt:a.battle.startsAt,endsAt:a.battle.endsAt,target:a.target,amount:a.amount,skinBonusPercent:a.skinBonus.percent,issuedAt:a.issuedAt}))};
}
const tournamentSettings=game.read('tournament-settings.json',{organizerIds:[]});
const tournaments=new Tournaments(DATA,{organizers:organizerIds(process.env.DMX_ORGANIZER_IDS??tournamentSettings.organizerIds.join(','))});
let profiles={};try{profiles=JSON.parse(fs.readFileSync(path.join(DATA,'profiles.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('DMX profile storage needs recovery; refusing to overwrite it.');}
function persist(){fs.mkdirSync(DATA,{recursive:true});const tmp=path.join(DATA,'profiles.tmp');fs.writeFileSync(tmp,JSON.stringify(profiles),{mode:0o600});fs.renameSync(tmp,path.join(DATA,'profiles.json'));}
function savedProfile(user){return profiles[user.id]||{userId:user.id,name:user.name,sets:[],active:null};}
let publicIdsAdded=false;for(const saved of Object.values(profiles))if(!saved.publicId){saved.publicId=crypto.randomUUID();publicIdsAdded=true;}
if(publicIdsAdded)persist();
export function verifyInit(raw,botToken,now=Math.floor(Date.now()/1000)){
 if(!botToken||typeof raw!=='string'||raw.length>8192)throw Error('Откройте DMX в Telegram-боте.');
 const query=new URLSearchParams(raw),fields=[...query.entries()];if(new Set(fields.map(x=>x[0])).size!==fields.length)throw Error('Неверная Telegram-сессия.');
 const supplied=query.get('hash');if(!/^[0-9a-f]{64}$/i.test(supplied||''))throw Error('Неверная Telegram-сессия.');query.delete('hash');
 const secret=crypto.createHmac('sha256','WebAppData').update(botToken).digest();
 const expected=crypto.createHmac('sha256',secret).update([...query].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest();
 if(!crypto.timingSafeEqual(expected,Buffer.from(supplied,'hex')))throw Error('Неверная Telegram-сессия.');
 const age=now-Number(query.get('auth_date'));if(!Number.isFinite(age)||age< -30||age>3600)throw Error('Telegram-сессия истекла. Перезапустите миниапп.');
 const user=JSON.parse(query.get('user')||'null');if(!user||!Number.isSafeInteger(user.id)||user.id<=0||user.id>=2**52||user.is_bot)throw Error('Неверный пользователь Telegram.');
 return {id:user.id,name:String(user.first_name||'Игрок').slice(0,64),photoUrl:telegramPhoto(user.photo_url),languageCode:typeof user.language_code==='string'?user.language_code.slice(0,32):''};
}
let worker=null,next=0;const pending=new Map();
function connector(input){
 if(!worker){const python=process.env.DMX_PYTHON||(process.platform==='win32'?'python':'python3');const current=spawn(python,[path.join(ROOT,'inventory_worker.py')],{stdio:['pipe','pipe','ignore'],windowsHide:true});worker=current;
  readline.createInterface({input:current.stdout}).on('line',line=>{try{const result=JSON.parse(line),entry=pending.get(result.id);if(!entry)return;pending.delete(result.id);clearTimeout(entry.timer);result.error?entry.reject(Error(result.error)):entry.resolve(result.items);}catch{}});
  const fail=()=>{if(worker!==current)return;worker=null;for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(Error('Источник данных недоступен. Повторите обновление.'));}pending.clear();};
  current.stdin.on('error',fail);current.on('error',fail);current.on('exit',fail);
 }
 if(pending.size>=10)return Promise.reject(Error('Источник занят. Повторите через несколько секунд.'));
 return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Источник не ответил вовремя. Повторите обновление.'));},55000);pending.set(id,{resolve,reject,timer});worker.stdin.write(JSON.stringify({id,...input})+'\n');});
}
const inventory=(userId,force=false)=>connector({kind:'inventory',userId,force});
async function settleQuests(userId,stats){
 const policy=questLaunch.read();if(!launchView(policy,userId).claimsEnabled||!game.link(userId))return;
 missions.settle(userId,policy,{stats,groups:['once']});
 missions.collect();
 const pending=missions.rows(userId,policy,{allPeriods:true,stats}).some(row=>row.ready)||(stats?.mapProgress?.battles||[]).some(row=>game.ladder(userId,stats,0,policy,{mapId:row.mapId,battleStartsAt:row.startsAt}).canClaim);
 if(!pending){questRewardErrors.delete(userId);return;}
 try{
  const items=await inventory(userId,true);
  if(!game.link(userId))return;
  if(stats?.mapProgress&&Date.now()-stats.mapProgress.updatedAt>25000){const update=await game.syncClan(userId);stats={...stats,...update};}
  const latest=profiles[userId];if(!latest)return;
  if(game.link(userId)?.playerId!==stats.playerId)return;
  if(latest.gameStats?.playerId===stats.playerId&&latest.gameStats?.mapProgress?.updatedAt>stats.mapProgress.updatedAt)stats=latest.gameStats;
  latest.gameStats=stats;
  latest.viewInventory=viewInventory(items.map(row=>({...row,slot:assetSlot(row)})));latest.inventoryVerifiedAt=Date.now();
  const set=(latest.sets||[]).map(savedLoadout).find(s=>s.id===latest.active),bonus=equipmentBonus(set,items);
  const currentPolicy=questLaunch.read();missions.settle(userId,currentPolicy,{skinCount:bonus.count,stats});
  game.settleLadders(userId,stats,bonus.count,currentPolicy);questRewardErrors.delete(userId);
 }catch{questRewardErrors.set(userId,'Начисление ждёт проверки игровых данных и своего инвентаря. Повторим автоматически; повторной выплаты не будет.');}
}
function bonusQuests(userId,quests,bonus){return quests.map(q=>{const issued=q.claimed?Object.values(game.awards).find(a=>a.userId===userId&&a.questId===q.id):null;return {...q,baseReward:q.reward,reward:issued?.amount??(q.reward===null?null:skinReward(q.reward,bonus.count)),skinBonusPercent:bonus.percent};});}
async function syncGame(user,options={}){
 const update=await game.syncClan(user.id),link=game.link(user.id);
 if(!link)throw Error('Сначала привяжи игровой ID.');
 const snapshot=publicSnapshot({source:'pixel_world_api',playerId:link.playerId,periods:{},clan:update.clan,updatedAt:Date.now()},link.playerId);
 const stats={...snapshot,...update},saved=savedProfile(user);saved.gameStats=stats;saved.link=link;profiles[user.id]=saved;persist();return stats;
}
async function profile(user,force=false,refreshGame=false){
 if(!profiles[user.id]){profiles[user.id]={...savedProfile(user),publicId:crypto.randomUUID()};persist();}
 if(!profiles[user.id].publicId)profiles[user.id].publicId=crypto.randomUUID();
 const saved=savedProfile(user);let items=[],status='connected',error=null,gameError=null;
 await Promise.all([
  inventory(user.id,force).then(rows=>{items=rows;}).catch(()=>{status='error';error='Не удалось обновить NotGames. Попробуйте ещё раз.';}),
  (game.link(user.id)&&(refreshGame||!saved.gameStats||saved.gameStats.pending||Date.now()-saved.gameStats.updatedAt>45000)?syncGame(user).catch(e=>{gameError=e.message;}):Promise.resolve())
 ]);
 const latest=savedProfile(user),sets=(latest.sets||[]).map(savedLoadout);const active=sets.find(row=>row.id===latest.active);let activeId=latest.active||null;
 if(status==='connected')try{if(active?.needsReview)throw Error('Обнови старый сет.');if(active)validateSet(active,items);}catch{activeId=null;}
 latest.photoUrl=user.photoUrl||null;
 if(status==='connected'){latest.viewInventory=viewInventory(items.map(row=>({...row,slot:assetSlot(row)})));latest.inventoryVerifiedAt=Date.now();}
 await settleQuests(user.id,latest.gameStats);persist();
 const bonus=equipmentBonus(sets.find(s=>s.id===activeId),items);
 const link=game.link(user.id),stats=link?latest.gameStats||null:null,rewards=game.rewards(user.id);
 return {user:{id:user.id,name:link?.name||'Игрок',photoUrl:latest.photoUrl,profileId:latest.publicId},settings:profileSettings(latest,user),dismissedQuests:latest.dismissedQuests||[],link,reservedPlayerId:game.links[user.id]?.playerId||null,permissions:{canCreateTournament:tournaments.canCreate(user)},equipmentBonus:bonus,
  inventory:items.map(row=>({...row,slot:assetSlot(row)})),inventoryStatus:status,inventoryError:error,sets,active:activeId,bookmarks:(latest.bookmarks||[]).map(savedLoadout),
  gameStats:stats?{...stats,...(gameError?{status:'stale',error:gameError}:{})}:{status:link?'searching':'id_required',error:gameError,periods:{}},
  dmx:rewards,economy:launchView(questLaunch.read(),user.id),questBoard:questBoard(user.id,stats,bonus),quests:bonusQuests(user.id,game.quests(stats,rewards.claimed),bonus)};
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.zip':'application/zip'};
export const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const respond=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data));};
 if(url.pathname.startsWith('/api/')){
  try{
   if(url.pathname==='/api/getLeaderboard'&&req.method==='GET'){
    const rows=Object.values(profiles).map(row=>({...row,link:game.link(row.userId),...game.rewards(row.userId)})),clans=url.searchParams.get('group')==='clans';
    return respond(200,{players:clans?rankClans(rows,game.awards):rankPlayers(rows),source:clans?'dmx_clan_rewards':'dmx_rewards',group:clans?'clans':'players',period:'alltime',phase:questLaunch.read().mode==='open'?'first_release':'preview',updatedAt:Date.now()});
   }
   if(url.pathname==='/api/getTournaments'&&req.method==='GET')return respond(200,{tournaments:tournaments.list(),updatedAt:Date.now()});
   if(url.pathname==='/api/getClanMembers'&&req.method==='GET'){
    const rows=Object.values(profiles).map(row=>({...row,link:game.link(row.userId),...game.rewards(row.userId)}));
    return respond(200,{...clanMembers(rows,game.awards,Number(url.searchParams.get('id'))),updatedAt:Date.now()});
   }
   if(url.pathname==='/api/getPublicProfile'&&req.method==='GET'){
    const id=url.searchParams.get('id'),row=Object.values(profiles).find(p=>p.publicId===id);
    if(!row)return respond(404,{error:'Профиль не найден.'});const ranks=rankPlayers(Object.values(profiles).map(p=>({...p,link:game.link(p.userId),...game.rewards(p.userId)})));
    return respond(200,{...publicProfile({...row,link:game.link(row.userId)},game.rewards(row.userId)),rank:ranks.find(p=>p.profileId===id)?.rank||null});
   }
   if(url.pathname==='/api/getClanMaps'&&req.method==='GET')return respond(200,await game.clanMaps());
   if(req.method!=='POST')return respond(405,{error:'Method not allowed'});
   if(req.headers['x-dmx-request']!=='1')return respond(403,{error:'Forbidden'});
   const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>32768)return respond(413,{error:'Запрос слишком большой'});chunks.push(chunk);}const raw=Buffer.concat(chunks).toString('utf8');
   let input;try{input=JSON.parse(raw||'{}');}catch{throw Error('Неверный запрос.');}if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Неверный запрос.');
   let user;try{user=verifyInit(req.headers.authorization?.replace(/^tma /,''),token);}catch(error){return respond(401,{error:error.message});}let saved=savedProfile(user);
   if(url.pathname==='/api/getTournament')return respond(200,tournaments.view(tournaments.get(input.id),user));
   const tournamentActions={createTournament:()=>tournaments.create(user,game.link(user.id),input),joinTournament:()=>tournaments.join(input.id,user,game.link(user.id)),leaveTournament:()=>tournaments.leave(input.id,user),startTournament:()=>tournaments.start(input.id,user),setTournamentRoom:()=>tournaments.room(input.id,user,input.matchId,input.roomCode),readyTournamentMatch:()=>tournaments.ready(input.id,user,game.link(user.id),input.matchId),confirmTournamentResult:()=>tournaments.result(input.id,user,input.matchId,input),cancelTournament:()=>tournaments.cancel(input.id,user)};
   const tournamentKey=url.pathname.slice(5);if(Object.hasOwn(tournamentActions,tournamentKey))return respond(200,tournaments.view(tournamentActions[tournamentKey](),user));
   if(url.pathname==='/api/getProfile')return respond(200,await profile(user,!!input.refresh,!!input.refreshGame));
   if(url.pathname==='/api/setQuestDismissed'){
    if(input.id!=='nickname_dmx'||typeof input.dismissed!=='boolean')throw Error('Неверные настройки задания.');
    const dismissed=new Set(saved.dismissedQuests||[]);if(input.dismissed)dismissed.add(input.id);else dismissed.delete(input.id);
    saved.dismissedQuests=[...dismissed];profiles[user.id]=saved;persist();return respond(200,{dismissedQuests:saved.dismissedQuests});
   }
   if(url.pathname==='/api/saveSettings'){
    profiles[user.id]=updateProfileSettings(saved,input);persist();
    return respond(200,{settings:profileSettings(profiles[user.id],user),user:{name:game.link(user.id)?.name||'Игрок'}});
   }
   if(url.pathname==='/api/checkSubscription'){
    await telegramQuest.check(user.id,()=>questLaunch.read());
    const bonus=equipmentBonus((profiles[user.id]?.sets||[]).map(savedLoadout).find(s=>s.id===profiles[user.id]?.active),profiles[user.id]?.viewInventory||[]);
    return respond(200,{dmx:game.rewards(user.id),questBoard:questBoard(user.id,profiles[user.id]?.gameStats,bonus)});
   }
   if(url.pathname==='/api/syncClanBattles'){
    const link=game.link(user.id);if(!link)throw Error('Сначала привяжи игровой ID.');
    const update=await game.syncClan(user.id);
    if(game.link(user.id)!==link)throw Error('Привязка изменилась.');
    const latest=savedProfile(user);latest.gameStats={...latest.gameStats,...update};profiles[user.id]=latest;persist();
    await settleQuests(user.id,latest.gameStats);persist();
    const set=(latest.sets||[]).map(savedLoadout).find(s=>s.id===latest.active),bonus=equipmentBonus(set,latest.viewInventory||[]);
    return respond(200,{...latest.gameStats,dmx:game.rewards(user.id),questBoard:questBoard(user.id,latest.gameStats,bonus),quests:bonusQuests(user.id,game.quests(latest.gameStats,game.rewards(user.id).claimed),bonus)});
   }
   if(url.pathname==='/api/lookupPlayer')return respond(200,await game.find(input.playerId,{waitMs:input.poll?0:6000}));
   if(url.pathname==='/api/linkPlayer'){
    const snapshot=await game.find(input.playerId,{waitMs:8000});saved.link=game.bind(user,snapshot);saved.gameStats=snapshot;profiles[user.id]=saved;persist();return respond(200,await profile(user,false,true));
   }
   if(url.pathname==='/api/syncGame'){await syncGame(user,{force:!!input.refresh});return respond(200,await profile(user));}
   if(url.pathname==='/api/claimQuest'){
    if(!launchView(questLaunch.read(),user.id).claimsEnabled)throw Error('Начисления ещё не запущены для этого аккаунта.');
    throw Error('Награды лестницы начисляются автоматически. Обнови вклад в разделе заданий.');
   }
   if(url.pathname==='/api/equipSlot'){
    const items=await inventory(user.id,true);profiles[user.id]=equipSlot(savedProfile(user),input,items);persist();return respond(200,await profile(user));
   }
   if(url.pathname==='/api/unlinkGame'){game.unlink(user.id);delete saved.link;delete saved.gameStats;
   }else if(url.pathname==='/api/saveProfile'){
    throw Error('Ник обновляется только из Pixel World.');
   }else if(url.pathname==='/api/saveBookmark'){
    const preview=validatePreview(input);saved.bookmarks=saved.bookmarks||[];if(saved.bookmarks.some(row=>row.id===preview.id))throw Error('Образец уже сохранён.');if(saved.bookmarks.length>=30)throw Error('Можно сохранить до 30 образцов.');saved.bookmarks.push(preview);
   }else if(url.pathname==='/api/removeBookmark'){
    saved.bookmarks=(saved.bookmarks||[]).filter(row=>row.id!==input.id);
   }else if(url.pathname==='/api/saveSet'){
    const checked=validateSet(input,await inventory(user.id,true));if(typeof input.id!=='string'||! /^[a-z0-9:-]{1,100}$/i.test(input.id))throw Error('Неверный ID сета.');
    saved=savedProfile(user);assertItemsAvailable({id:input.id,...checked},saved.sets);
    const existing=saved.sets.findIndex(s=>s.id===input.id);if(existing<0&&saved.sets.length>=20)throw Error('Можно сохранить до 20 сетов.');
    const set={id:input.id,...checked,published:false};if(existing>=0)saved.sets[existing]=set;else saved.sets.push(set);
   }else if(url.pathname==='/api/equipSet'){
    const set=saved.sets.find(s=>s.id===input.id);if(!set)throw Error('Сет не найден.');validateSet(set,await inventory(user.id,true));saved.active=set.id;
   }else if(url.pathname==='/api/deleteSet'){
    if(!saved.sets.some(s=>s.id===input.id))throw Error('Сет не найден.');saved.sets=saved.sets.filter(s=>s.id!==input.id);if(saved.active===input.id)saved.active=null;
   }else return respond(404,{error:'API endpoint not found'});
   profiles[user.id]=saved;persist();return respond(200,await profile(user));
  }catch(error){return respond(error.status||400,{error:error.message||'Не удалось выполнить действие.'});}
 }
 if(url.pathname==='/connect.html'||url.pathname==='/downloads/dmx-game-link.zip'){res.writeHead(410,{'Content-Type':'text/html; charset=utf-8'});return res.end('<!doctype html><html lang="ru"><meta charset="utf-8"><p>Привязка теперь выполняется по игровому ID в профиле DMX.</p><a href="/">Открыть DMX</a></html>');}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
 let file;try{file=path.resolve(DIST,'.'+decodeURIComponent(url.pathname));if(url.pathname==='/')file=path.join(DIST,'index.html');}catch{res.writeHead(400);return res.end();}
 if(!file.startsWith(DIST+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 const zipped=/\bgzip\b/.test(req.headers['accept-encoding']||'')&&fs.existsSync(file+'.gz');
 const immutable=/^\/art\/dmx-(hq|graffiti)-v\d+\.(png|webp)$/.test(url.pathname)||/^\/character\/[a-z0-9-]+-v\d+\.(png|json)$/.test(url.pathname)||/^\/vendor\/three-[0-9.]+\.module\.min\.js$/.test(url.pathname);
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache',...(zipped?{'Content-Encoding':'gzip'}:{}),'Vary':'Accept-Encoding','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:fs.readFileSync(zipped?file+'.gz':file));
});
let monitorTimer=null,monitoring=false;
async function monitor(){if(monitoring)return;monitoring=true;let changed=false;try{for(const id of Object.keys(game.links)){if(!game.link(id))continue;const saved=profiles[id];if(saved)try{const update=await game.syncClan(Number(id));const latest=profiles[id],link=game.link(id);if(link){const base=latest.gameStats?.source==='pixel_world_api'&&latest.gameStats.playerId===link.playerId?latest.gameStats:publicSnapshot({source:'pixel_world_api',playerId:link.playerId,periods:{},clan:update.clan,updatedAt:Date.now()},link.playerId);latest.gameStats={...base,...update};await settleQuests(Number(id),latest.gameStats);changed=true;}}catch{}}if(changed)persist();}finally{monitoring=false;}}
function stop(){clearInterval(monitorTimer);worker?.kill();server.close(()=>process.exit(0));}process.on('SIGINT',stop);process.on('SIGTERM',stop);
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.DMX_PORT||8092);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid DMX port');server.listen(port,'127.0.0.1',()=>{console.log('DMX Player Hub: http://127.0.0.1:'+server.address().port);monitorTimer=setInterval(monitor,20000);monitorTimer.unref();});}
