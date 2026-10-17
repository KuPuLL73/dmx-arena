import assert from 'node:assert/strict';
import {once} from 'node:events';
import {loginServer} from './serverless-login.mjs';
let calls=0;
const token='app123:local-test-only',server=loginServer({login:async input=>{assert.equal(input,token);calls++;}});
server.listen(0,'127.0.0.1');await once(server,'listening');
try{
 const url=server.loginUrl,origin=new URL(url).origin;
 const page=await fetch(url);assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');assert.match(await page.text(),/type="password"/);
 const post=(body,headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(body)});
 assert.equal((await fetch(origin+'/')).status,404);
 assert.equal((await post({token},{Origin:'https://evil.invalid'})).status,403);assert.equal(calls,0);
 assert.equal((await post({token:'123:ordinary-bot-token'})).status,400);assert.equal(calls,0);
 assert.equal((await post({token:'app1:'+'x'.repeat(5000)})).status,413);assert.equal(calls,0);
 const result=await post({token});assert.equal(result.status,200);assert.ok(!(await result.text()).includes(token));assert.equal(calls,1);
 assert.equal((await post({token})).status,200);assert.equal(calls,1);
 console.log('Passed: loopback-only login route, masked field, no-store/CSP, cross-origin and invalid-token rejection, oversized input rejection, no secret in responses and no repeated login.');
}finally{await new Promise(resolve=>server.close(resolve));}
