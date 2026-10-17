export const WELCOME_TEXT='Welcome to DMX Arena!\n\nOpen the app and link your Pixel World UID. Build a loadout with your skins, complete quests and earn DMX in clan battles.\n\nTap “Open arena” to get started.';
export const RETURN_TEXT='Tap “Open arena” to open DMX Arena.';
export const WELCOME_TEXT_RU='Добро пожаловать в DMX Arena!\n\nОткрой приложение и привяжи UID Pixel World. Выбери свои скины для сета, выполняй задания и зарабатывай DMX в клановых битвах.\n\nНажми «Открыть арену», чтобы начать.';
export const RETURN_TEXT_RU='Нажми «Открыть арену», чтобы открыть DMX Arena.';
export const APP_LINK='https://t.me/DMXARENABOT';
export const APP_URL='https://app8760866719.tgcloud.ai/';
export async function arenaButton(api,chatId,language){
 const text=language==='ru'?'Открыть арену':'Open arena';let url=APP_URL;
 try{const menu=await api.getChatMenuButton();if(menu?.type==='web_app'&&/^https:\/\//i.test(menu.web_app?.url||''))url=menu.web_app.url;}catch{}
 try{await api.setChatMenuButton({chat_id:chatId,menu_button:{type:'web_app',text,web_app:{url}}});}catch{}
 return {text,web_app:{url}};
}

// The lease prevents simultaneous deliveries and can recover a crashed attempt.
export const CLAIM_SQL=`INSERT INTO dmx_bot_visits
 (user_id,last_message_id,last_attempt_at,welcomed_at) VALUES (:uid,:message,:now,NULL)
 ON CONFLICT(user_id) DO UPDATE SET
 last_message_id=excluded.last_message_id,last_attempt_at=excluded.last_attempt_at
 WHERE (dmx_bot_visits.last_message_id<excluded.last_message_id
 OR (dmx_bot_visits.last_message_id=excluded.last_message_id AND dmx_bot_visits.welcomed_at IS NULL))
 AND dmx_bot_visits.last_attempt_at<=:expired
 RETURNING welcomed_at`;
export const COMPLETE_SQL=`UPDATE dmx_bot_visits SET
 welcomed_at=COALESCE(welcomed_at,:now),last_attempt_at=0
 WHERE user_id=:uid AND last_message_id=:message AND last_attempt_at=:attempt`;
export const RELEASE_SQL=`UPDATE dmx_bot_visits SET last_attempt_at=0,last_message_id=:retry
 WHERE user_id=:uid AND last_message_id=:message AND last_attempt_at=:attempt`;

export function welcomeStore(db){
 return {
  claim:async params=>(await db.run(CLAIM_SQL,{':uid':params.uid,':message':params.message,':now':params.now,':expired':params.expired})).rows[0]||null,
  complete:params=>db.run(COMPLETE_SQL,{':uid':params.uid,':message':params.message,':now':params.now,':attempt':params.attempt}),
  release:params=>db.run(RELEASE_SQL,{':uid':params.uid,':message':params.message,':retry':params.retry,':attempt':params.attempt})
 };
}

export async function handleStart(message,{claim,complete,release,send,button,now=Date.now}){
 if(message?.chat?.type!=='private'||message.from?.is_bot
  ||!Number.isSafeInteger(message.from?.id)||message.from.id<=0
  ||message.chat.id!==message.from.id||!Number.isSafeInteger(message.message_id)||message.message_id<=0
  ||typeof message.text!=='string'||!/^\/start(?:@DMXARENABOT)?(?:\s|$)/i.test(message.text))return {handled:false};
 const attempt=now(),key={uid:message.from.id,message:message.message_id,attempt};
 const row=await claim({...key,now:attempt,expired:attempt-60000});
 if(!row)return {handled:true,duplicate:true};
 const first=row.welcomed_at==null,language=/^ru(?:[-_]|$)/i.test(String(message.from.language_code||''))?'ru':'en';
 try{
  const openButton=await button(language);
  await send({chat_id:message.chat.id,text:language==='ru'?(first?WELCOME_TEXT_RU:RETURN_TEXT_RU):(first?WELCOME_TEXT:RETURN_TEXT),
   reply_markup:{inline_keyboard:[[openButton]]}});
 }catch(error){
  await release({...key,retry:message.message_id-1});
  throw error;
 }
 await complete({...key,now:now()});
 return {handled:true,first};
}
