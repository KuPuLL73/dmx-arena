import {timingSafeEqual} from 'node:crypto';
import {INSTANCES} from '../../tgcloud/lib/instances.js';
export const ACTIONS=new Set(['getProfile','getLeaderboard','getTournaments','getTournament','createTournament','joinTournament','leaveTournament','startTournament','setTournamentRoom','readyTournamentMatch','confirmTournamentResult','cancelTournament','getPublicProfile','getClanMembers','getClanMaps','saveSettings','setQuestDismissed','checkSubscription','syncClanBattles','lookupPlayer','linkPlayer','syncGame','equipSlot','unlinkGame','saveBookmark','removeBookmark','saveSet','equipSet','deleteSet','claimQuest','saveProfile']);
export const BOOTSTRAP_FILES=new Set(['profiles.json','game-links.json','game-awards.json','game-map-progress.json','missions-state.json','public-player-cache.json','public-clan-cache.json','quest-launch.json','missions-launch.json','daily-map-launch.json','tournament-settings.json','launch-manifest.json']);
export function authorized(request,key){
 if(typeof key!=='string'||key.length<43)return false;
 const expected=Buffer.from('Bearer '+key),actual=Buffer.from(request.headers.get('Authorization')||'');
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export function bridgeRequest(value){
 if(!value||!ACTIONS.has(value.action)||!value.input||typeof value.input!=='object'||Array.isArray(value.input))throw Error('Invalid action');
 const user=value.user;
 if(!user||!Number.isSafeInteger(user.id)||user.id<=0||user.id>=2**52||typeof user.name!=='string'||user.name.length>256)throw Error('Invalid verified identity');
 return {action:value.action,input:value.input,user:{id:user.id,name:user.name,photoUrl:typeof user.photoUrl==='string'&&user.photoUrl.startsWith('https://')?user.photoUrl:null,languageCode:typeof user.languageCode==='string'?user.languageCode.slice(0,32):''},receipt:value.receipt};
}
export function receiptApi(receipt,userId,{clock=Date.now,instance=INSTANCES.production}={}){
 return async(method,input={})=>{
  if(!receipt||receipt.userId!==userId||instance.botId===null||receipt.bot?.id!==instance.botId||!Number.isSafeInteger(receipt.checkedAt)||clock()-receipt.checkedAt>30000||receipt.checkedAt-clock()>5000)throw Error('Telegram пока не подтвердил подписку. Попробуй ещё раз.');
  if(method==='getMe')return receipt.bot;
  if(method!=='getChatMember'||input.chat_id!==instance.channelId)throw Error('Subscription receipt mismatch');
  if(input.user_id===receipt.bot.id)return receipt.botMember;
  if(input.user_id===userId&&receipt.member?.user?.id===userId)return receipt.member;
  throw Error('Subscription identity mismatch');
 };
}
export function bootstrapFiles(input){
 const files=input?.files;
 if(!files||typeof files!=='object'||Array.isArray(files)||Object.keys(files).length!==BOOTSTRAP_FILES.size||Object.keys(files).some(name=>!BOOTSTRAP_FILES.has(name)))throw Error('Invalid launch files');
 for(const value of Object.values(files))if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid launch file data');
 if(files['quest-launch.json'].mode!=='preview'||Object.keys(files['game-awards.json']).length||Object.keys(files['game-map-progress.json']).length)throw Error('Launch must start with empty awards and a fresh baseline');
 for(const [id,row] of Object.entries(files['profiles.json']))if(!Number.isSafeInteger(Number(id))||Number(id)<=0||row.userId!==Number(id)||row.gameStats||row.score||row.balance||row.dmx)throw Error('Invalid clean launch profile');
 if(!Number.isSafeInteger(files['missions-launch.json'].startedAt)||Math.abs(Date.now()-files['missions-launch.json'].startedAt)>600000)throw Error('Launch candidate is outdated');
 return files;
}
