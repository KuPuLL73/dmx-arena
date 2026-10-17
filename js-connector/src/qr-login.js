import {Api} from 'teleproto';
import {Raw} from 'teleproto/events/Raw';

// Handle every Telegram result at every step, including a confirmation that
// arrives while an expired QR code is being renewed.
export async function signInWithQr(client, credentials, options) {
 let wake, changed=false;
 const event=new Raw({});
 const notify=update=>{if(update instanceof Api.UpdateLoginToken){changed=true;wake?.();}};
 const aborted=()=>{if(options.signal?.aborted)throw new Error('LOGIN_CANCELLED');};
 async function wait(ms){
  if(changed){changed=false;return;}
  await new Promise(resolve=>{
   let timer;
   const finish=()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',finish);wake=null;resolve();};
   wake=finish;timer=setTimeout(finish,ms);options.signal?.addEventListener('abort',finish,{once:true});
   if(options.signal?.aborted)finish();
  });
  changed=false;aborted();
 }
 client.addEventHandler(notify,event);
 try{
  while(true){
   aborted();
   try{
    let result=await client.invoke(new Api.auth.ExportLoginToken({...credentials,exceptIds:[]}));
    if(result instanceof Api.auth.LoginTokenMigrateTo){
     await client._switchDC(result.dcId);
     result=await client.invoke(new Api.auth.ImportLoginToken({token:result.token}));
    }
    if(result instanceof Api.auth.LoginTokenSuccess&&result.authorization instanceof Api.auth.Authorization)return result.authorization.user;
    if(!(result instanceof Api.auth.LoginToken))throw new Error('LOGIN_RESULT_UNSUPPORTED');
    await options.qrCode(result);
    const remaining=Math.max(1000,Math.min(30000,result.expires*1000-Date.now()));
    await wait(remaining);
   }catch(error){
    if(error.errorMessage==='SESSION_PASSWORD_NEEDED'){
     return await client.signInWithPassword(credentials,{
      password:options.password,
      onError:async failure=>{
       aborted();
       if(failure.errorMessage!=='PASSWORD_HASH_INVALID')throw failure;
       await options.passwordError?.();return false;
      }
     });
    }
    if(['AUTH_TOKEN_EXPIRED','AUTH_TOKEN_INVALID'].includes(error.errorMessage))continue;
    throw error;
   }
  }
 }finally{client.removeEventHandler(notify,event);}
}

export function loginErrorCode(error){
 const rpc=error?.errorMessage;
 if(typeof rpc==='string'&&/^[A-Z][A-Z0-9_]{1,70}$/.test(rpc))return rpc;
 const message=error?.message;
 if(['LOGIN_CANCELLED','LOGIN_RESULT_UNSUPPORTED','TIMEOUT','Not connected','Connection closed'].includes(message))return message;
 return /^[A-Za-z]{1,50}$/.test(error?.constructor?.name||'')?error.constructor.name:'Error';
}
