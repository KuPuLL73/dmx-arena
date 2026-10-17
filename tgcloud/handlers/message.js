import {api,db} from 'sdk';
import {handleStart,arenaButton,welcomeStore} from '../lib/welcome.js';

export default async function(message){
 return handleStart(message,{
  ...welcomeStore(db),
  send:params=>api.sendMessage(params),
  button:language=>arenaButton(api,message.chat.id,language)
 });
}
