import assert from 'node:assert/strict';
import {Api} from 'teleproto';
import {signInWithQr,loginErrorCode} from './src/qr-login.js';
const credentials={apiId:1,apiHash:'test'},user={id:123};
const success=()=>new Api.auth.LoginTokenSuccess({authorization:new Api.auth.Authorization({user})});
function mock(results){
 return {requests:[],removed:0,addEventHandler(fn){this.update=fn;},removeEventHandler(){this.removed++;},
  async invoke(request){this.requests.push(request.className);const result=results.shift();if(result instanceof Error)throw result;return result;},
  async _switchDC(dc){this.dc=dc;},async signInWithPassword(_c,opts){this.password=await opts.password('hint');return user;}};
}
{
 const client=mock([success()]);assert.equal(await signInWithQr(client,credentials,{}),user);assert.equal(client.removed,1);
}
{
 const token=new Api.auth.LoginToken({token:Buffer.from('qr'),expires:Math.floor(Date.now()/1000)+30});
 const client=mock([token,success()]);let displayed=0;
 assert.equal(await signInWithQr(client,credentials,{qrCode:async()=>{displayed++;client.update(new Api.UpdateLoginToken());}}),user);
 assert.equal(displayed,1);assert.equal(client.removed,1);
}
{
 const passwordRequired=Object.assign(new Error('sensitive text'),{errorMessage:'SESSION_PASSWORD_NEEDED'});
 const client=mock([passwordRequired]);assert.equal(await signInWithQr(client,credentials,{password:async()=>'local-only'}),user);
 assert.equal(client.password,'local-only');assert.equal(client.removed,1);
}
{
 const migration=new Api.auth.LoginTokenMigrateTo({dcId:2,token:Buffer.from('private')});
 const client=mock([migration,success()]);assert.equal(await signInWithQr(client,credentials,{}),user);
 assert.equal(client.dc,2);assert.deepEqual(client.requests,['auth.ExportLoginToken','auth.ImportLoginToken']);
}
{
 const expired=Object.assign(new Error(),{errorMessage:'AUTH_TOKEN_EXPIRED'});
 const client=mock([expired,success()]);assert.equal(await signInWithQr(client,credentials,{}),user);
}
{
 const client=mock([new Api.auth.LoginToken({token:Buffer.from('qr'),expires:Math.floor(Date.now()/1000)+30})]);
 const controller=new AbortController();
 await assert.rejects(signInWithQr(client,credentials,{signal:controller.signal,qrCode:async()=>controller.abort()}),/LOGIN_CANCELLED/);
 assert.equal(client.removed,1);
}
assert.equal(loginErrorCode(new Error('password=secret session=private')),'Error');
assert.equal(loginErrorCode(Object.assign(new Error(),{errorMessage:'PRIVATE token data'})),'Error');
console.log('QR login transitions: confirmation, password, migration, expiry, abort and safe diagnostics PASS.');
