import {api,db} from 'sdk';
import {handleStart,arenaButton,welcomeStore} from '../lib/welcome.js';
import {currentBot,appUrlFor} from '../lib/instances.js';

export default async function(message){
 // An unconfigured bot stays silent rather than advertising another bot's arena.
 const {bot,instance}=await currentBot(api);
 const appUrl=appUrlFor(instance,bot?.id);
 if(!instance||!appUrl)return {handled:false};
 return handleStart(message,{
  ...welcomeStore(db),
  username:instance.botUsername,
  send:params=>api.sendMessage(params),
  button:language=>arenaButton(api,message.chat.id,language,appUrl)
 });
}
