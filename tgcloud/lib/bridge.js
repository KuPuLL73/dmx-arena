import {api,db,fetch,EndpointError} from 'sdk';
import {currentBot} from './instances.js';
export async function callApplication(action,input,ctx){
 const identity=ctx?.initData?.user;
 if(!identity||!Number.isSafeInteger(identity.id)||identity.id<=0||identity.id>=2**52)throw new EndpointError('Открой DMX Arena в Telegram.');
 if(!input||typeof input!=='object'||Array.isArray(input))throw new EndpointError('Неверный запрос.');
 if(JSON.stringify(input).length>32768)throw new EndpointError('Запрос слишком большой.');
 // The destination follows the bot this code runs in; an unknown bot reaches no Worker.
 let current;try{current=await currentBot(api);}catch{throw new EndpointError('Арена временно недоступна.');}
 const {bot,instance}=current;
 if(!instance)throw new EndpointError('Этот бот не настроен для DMX Arena.');
 const record=await db.get('SELECT value FROM dmx_settings WHERE name=:name',{':name':'backend'});
 let config;try{config=JSON.parse(record?.value);}catch{throw new EndpointError('Арена готовится к запуску.');}
 if(config.origin!==instance.workerOrigin||typeof config.key!=='string'||config.key.length<43)throw new EndpointError('Подключение арены требует проверки.');
 const user={id:identity.id,name:String(identity.first_name||'Игрок').slice(0,256),photoUrl:identity.photo_url||null,languageCode:identity.language_code||''};
 let receipt;
 if(action==='checkSubscription'){
  try{
   if(instance.botId===null||bot.id!==instance.botId)throw new Error('Wrong bot');
   const botMember=await api.getChatMember({chat_id:instance.channelId,user_id:bot.id});
   const member=await api.getChatMember({chat_id:instance.channelId,user_id:user.id});
   receipt={userId:user.id,bot:{id:bot.id},botMember,member,checkedAt:Date.now()};
  }catch{throw new EndpointError('Telegram пока не подтвердил подписку. Попробуй чуть позже.');}
 }
 let response;
 try{response=await fetch(instance.workerOrigin+'/bridge',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify({action,input,user,receipt})});}
 catch{throw new EndpointError('Не удалось связаться с ареной. Попробуй ещё раз.');}
 let result;try{result=await response.json();}catch{throw new EndpointError('Арена временно недоступна.');}
 if(response.status<200||response.status>=300)throw new EndpointError(result?.error||'Не удалось выполнить действие.');
 return result;
}
