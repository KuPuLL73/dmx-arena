import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {StringSession} from 'teleproto/sessions';
import {AuthKey} from 'teleproto/crypto/AuthKey';
import {saveCloudSession} from './cloud-session-vault.mjs';
import {decodeOperatorSession} from './operator-session.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dmx-vault-test-'));
try{
 const session=new StringSession();session.setDC(2,'149.154.167.51',443);
 const auth=new AuthKey();await auth.setKey(crypto.randomBytes(256));session.authKey=auth;
 const value=session.save();assert.ok(/[+/]/.test(value),'exercise standard Base64, not just URL-safe Base64');
 const vault=pathToFileURL(path.join(directory,'vault')+path.sep),file=path.join(directory,'.dev.vars'),receiptFile=path.join(directory,'receipt.json');
 fs.writeFileSync(file,'OPERATOR_SESSION="previous"\nPROBE_KEY="keep-this"\n');
 saveCloudSession(value,{vault,file,receiptFile});
 assert.equal(decodeOperatorSession(fs.readFileSync(new URL('master.key',vault),'utf8'),fs.readFileSync(new URL('session.enc',vault),'utf8')),value);
 assert.ok(fs.readFileSync(file,'utf8').includes('PROBE_KEY="keep-this"'));
 assert.equal(/^OPERATOR_SESSION=/m.test(fs.readFileSync(file,'utf8')),false,'no plaintext Telegram session in development bindings');
 const saved=new StringSession(decodeOperatorSession(fs.readFileSync(new URL('master.key',vault),'utf8'),fs.readFileSync(new URL('session.enc',vault),'utf8')));await saved.load();
 assert.equal(saved.save(),value);assert.equal(JSON.parse(fs.readFileSync(receiptFile)).encryptedLocally,true);
 assert.throws(()=>saveCloudSession(value,{vault,file,receiptFile}),/already prepared/);
 console.log('Cloud session vault: actual JS session encoding, encrypted round-trip, deployment binding and duplicate-save protection PASS.');
}finally{
 assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('dmx-vault-test-'));
 fs.rmSync(directory,{recursive:true,force:true});
}
