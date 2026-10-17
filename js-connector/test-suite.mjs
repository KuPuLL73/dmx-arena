import {execFileSync} from 'node:child_process';
if(Number(process.versions.node.split('.')[0])<24)throw Error('Cloud application checks require Node.js 24 or later');
const cwd=new URL('.',import.meta.url);
for(const file of ['test-auth.mjs','test-qr-login.mjs','test-session-vault.mjs','test-public-game.mjs','test-application-parity.mjs','test-sdk-bridge.mjs','test-record-storage.mjs','test-cloud-application.mjs'])execFileSync(process.execPath,[file],{cwd,stdio:'inherit',windowsHide:true});
console.log('All cloud migration checks passed. Live checks are separate.');
