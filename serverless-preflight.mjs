import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),missing=[];
const required=['getProfile','getLeaderboard','getPublicProfile','getClanMembers','getClanMaps','saveSettings','checkSubscription','syncClanBattles','lookupPlayer','linkPlayer','syncGame','equipSlot','unlinkGame','saveBookmark','removeBookmark','saveSet','equipSet','deleteSet'];
for(const name of required){const file=path.join(root,'tgcloud/endpoints',name+'.js');if(!fs.existsSync(file)||!fs.readFileSync(file,'utf8').includes("callApplication('"+name+"'"))missing.push(name);}
const receiptFile=path.join(root,'artifacts/telegram-cloud-acceptance.json');
const receipt=fs.existsSync(receiptFile)?JSON.parse(fs.readFileSync(receiptFile,'utf8')):{};
if(missing.length||!receipt.ok||receipt.inventoryStatus!=='connected'||receipt.maps!==11){
 console.error('Telegram deployment needs the full cloud connector and live acceptance.');
 if(missing.length)console.error('Missing endpoints: '+missing.join(', '));
 if(!receipt.ok)console.error('Run the Telegram cloud acceptance check before publishing.');
 process.exitCode=1;
}else console.log('Required serverless modules are present. Live acceptance on the new bot is still required.');
