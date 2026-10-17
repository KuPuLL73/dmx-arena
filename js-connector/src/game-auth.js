import {TelegramClient,Api} from 'teleproto';
import {StringSession} from 'teleproto/sessions';
import {Logger,LogLevel} from 'teleproto/extensions/Logger';
const APPS=Object.freeze({notgames:{bot:'notgames_bot',url:'https://webapp.notcoin.tg/'},pixelworld:{bot:'pixelworld',url:'https://pw.game/'}});

export async function telegramInitData(kind,credentials){
 if(!Object.hasOwn(APPS,kind))throw Error('Unsupported game authorization');const app=APPS[kind];
 const client=new TelegramClient(new StringSession(credentials.session),credentials.apiId,credentials.apiHash,{
  baseLogger:new Logger(LogLevel.NONE),connectionRetries:1,requestRetries:1,autoReconnect:false,
  floodSleepThreshold:0,timeout:15,deviceModel:'DMX Arena connector',appVersion:'1.0',
 });
 try{
  await client.connect();const bot=await client.getInputEntity(app.bot);
  const result=await client.invoke(new Api.messages.RequestWebView({peer:bot,bot,url:app.url,platform:'android'}));
  const link=new URL(result.url),params=new URLSearchParams(link.hash.slice(1)||link.search.slice(1)),data=params.get('tgWebAppData');
  if(!data)throw Error('Game initialization unavailable');return data;
 }finally{await client.destroy();}
}

export class GameAuthorization{
 constructor({fetch,credentials,state={},clock=Date.now,initData=telegramInitData}){
  this.fetch=fetch;this.credentials=credentials;this.state=state;this.clock=clock;this.initData=initData;this.inflight=new Map();
 }
 async post(url,body){
  const response=await this.fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error('Game authorization failed');const value=await response.json();
  if(value?.ok===false)throw Error('Game authorization rejected');return value?.data??value;
 }
 async token(kind){
  if(!Object.hasOwn(APPS,kind))throw Error('Unsupported game authorization');
  const old=this.state[kind],ttl=kind==='notgames'?1500000:1200000;
  if(old?.accessToken&&this.clock()-old.refreshedAt<ttl)return old.accessToken;
  if(this.inflight.has(kind))return this.inflight.get(kind);
  const job=this.refresh(kind);this.inflight.set(kind,job);
  try{return await job;}finally{this.inflight.delete(kind);}
 }
 async refresh(kind){
  if(!Object.hasOwn(APPS,kind))throw Error('Unsupported game authorization');
  let result;
  if(kind==='pixelworld'&&this.state.pixelworld?.refreshToken){
   try{result=await this.post('https://release.pw.game/api/v2/auth/refresh-token',{refresh_token:this.state.pixelworld.refreshToken});}catch{}
  }
  if(!result?.access_token){
   const data=await this.initData(kind,this.credentials);
   result=kind==='notgames'?await this.post('https://bff.notcoin.tg/api/v1/auth/login',{webAppData:data})
    :await this.post('https://release.pw.game/api/v2/auth/login/telegram-mini-apps',{web_app_data:data});
  }
  if(typeof result?.access_token!=='string'||!result.access_token)throw Error('Game did not issue access');
  this.state[kind]={accessToken:result.access_token,refreshedAt:this.clock(),...(kind==='pixelworld'&&typeof result.refresh_token==='string'?{refreshToken:result.refresh_token}:{})};
  return result.access_token;
 }
}
