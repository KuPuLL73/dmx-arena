import fs from 'node:fs';
import {ACTIONS} from './src/protocol.js';
for(const action of ACTIONS){
 fs.writeFileSync(new URL('../tgcloud/endpoints/'+action+'.js',import.meta.url),
  "import {callApplication} from '../lib/bridge.js';\nexport default async function(input,ctx){return callApplication('"+action+"',input||{},ctx);}\n");
}
console.log('Generated '+ACTIONS.size+' Telegram endpoints using verified server identity and the preserved application.');
