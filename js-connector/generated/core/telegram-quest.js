// Generated from the preserved Node/Python application.
import {launchView} from './quest-launch.js';
import {randomUUID} from 'node:crypto';
export const SUBSCRIPTION=Object.freeze({id:'dmx_core_subscription',channel:'@DMX_Core',chatId:-1003360145165,url:'https://t.me/DMX_Core',amount:100});
const keyFor=id=>'telegram:'+id+':'+SUBSCRIPTION.id;
export function subscriptionBoard(game,userId){return {...SUBSCRIPTION,claimed:!!game.awards[keyFor(userId)]};}
export class TelegramQuest {
 constructor(game,token,{api,clock=Date.now}={}){this.game=game;this.token=token;this.clock=clock;this.inflight=new Map();this.lastChecks=new Map();this.api=api||this.request.bind(this);}
 async request(method,input={}){
  try{const response=await fetch('https://api.telegram.org/bot'+this.token+'/'+method+'?dmx_request='+randomUUID(),{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify(input),signal:AbortSignal.timeout(12000)}),data=await response.json();if(!response.ok||!data.ok)throw Error();return data.result;}
  catch{throw Error('Telegram пока не подтвердил подписку. Попробуй ещё раз чуть позже.');}
 }
 async check(userId,policy){
  if(!launchView(typeof policy==='function'?policy():policy,userId).claimsEnabled)throw Error('Получение наград пока недоступно.');
  if(!Number.isSafeInteger(userId)||userId<=0)throw Error('Открой DMX в Telegram.');
  if(this.game.awards[keyFor(userId)])return {amount:0,claimed:true};
  if(this.inflight.has(userId))return this.inflight.get(userId);
  if(this.lastChecks.has(userId)&&this.clock()-this.lastChecks.get(userId)<5000)throw Error('Повтори проверку через несколько секунд.');
  const promise=this.verify(userId,policy);this.inflight.set(userId,promise);this.lastChecks.set(userId,this.clock());
  try{return await promise;}finally{this.inflight.delete(userId);}
 }
 async verify(userId,policy){
  const me=await this.api('getMe'),bot=await this.api('getChatMember',{chat_id:SUBSCRIPTION.chatId,user_id:me.id});
  if(!['administrator','creator'].includes(bot?.status))throw Error('Проверка подписки пока недоступна. Попробуй позже.');
  const member=await this.api('getChatMember',{chat_id:SUBSCRIPTION.chatId,user_id:userId});
  if(member?.user?.id!==userId||!(['member','administrator','creator'].includes(member.status)||member.status==='restricted'&&member.is_member===true))throw Error('Подпишись на @DMX_Core и нажми «Проверить подписку».');
  // Recheck after the network wait: concurrent checks and policy changes cannot pay twice.
  const current=typeof policy==='function'?policy():policy;
  if(!launchView(current,userId).claimsEnabled)throw Error('Получение наград пока недоступно.');
  if(this.game.awards[keyFor(userId)])return {amount:0,claimed:true};
  const award={version:'telegram-subscription-v1',questId:SUBSCRIPTION.id,userId,playerId:null,period:'once',amount:100,baseAmount:100,clan:null,channelId:SUBSCRIPTION.chatId,issuedAt:this.clock()};
  const next={...this.game.awards,[keyFor(userId)]:award};this.game.write('game-awards.json',next);this.game.awards=next;return {amount:100,claimed:true};
 }
}
