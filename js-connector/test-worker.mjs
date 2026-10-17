import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.argv.includes('--cloud')?'https://dmx-arena-connector.dmx-arena-js-connector.workers.dev':'http://127.0.0.1:8094';
try{
 assert.equal((await fetch(origin+'/healthz')).status,200);
 assert.equal((await fetch(origin+'/check',{method:'POST'})).status,403);
 assert.equal((await fetch(origin+'/check',{method:'POST',headers:{Authorization:'Bearer forged'}})).status,403);
 const values=fs.readFileSync(new URL('.dev.vars',import.meta.url),'utf8');
 const key=JSON.parse(values.match(/^PROBE_KEY=(.+)$/m)[1]);
 const response=await fetch(origin+'/check',{method:'POST',headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(60000)});
 const result=await response.json();
 const receipt={...result,status:response.status,unauthorizedRejected:true,checkedAt:Date.now()};
 fs.writeFileSync(new URL(process.argv.includes('--cloud')?'../artifacts/cloud-worker-login-probe.json':'../artifacts/worker-login-probe.json',import.meta.url),JSON.stringify(receipt),{mode:0o600});
 console.log(JSON.stringify(receipt));assert.equal(response.status,200);
}catch(error){console.error('Worker acceptance failed: '+(error.name||'Error'));process.exitCode=1;}
