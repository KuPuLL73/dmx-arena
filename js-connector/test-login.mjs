// Read-only live check. No Python and no credentials in output or temporary files.
import fs from 'node:fs';
import {loadOperatorSession} from './operator-session.mjs';
import {GameAuthorization} from './src/game-auth.js';
import {NotGamesClient} from '../tgcloud/lib/connector/notgames.js';
import {PixelWorldClient} from '../tgcloud/lib/connector/pixel-world.js';
let stage='local encrypted session';
try{
 const credentials=loadOperatorSession(),auth=new GameAuthorization({fetch,credentials});
 stage='NotGames JavaScript login';const inventory=new NotGamesClient({fetch,token:()=>auth.token('notgames')});
 const items=await inventory.inventory(900000001);
 stage='Pixel World JavaScript login';const game=new PixelWorldClient({fetch,token:()=>auth.token('pixelworld')});
 const clan=await game.roster(41),maps=await game.maps();
 stage='Pixel World refresh';auth.state.pixelworld.refreshedAt=0;
 await auth.token('pixelworld');await game.roster(41,{force:true});
 const result={ok:true,pythonUsed:false,inventoryItems:items.length,clanId:clan.id,maps:maps.maps.length,refreshChecked:true,checkedAt:Date.now()};
 fs.writeFileSync(new URL('../artifacts/js-login-probe.json',import.meta.url),JSON.stringify(result),{mode:0o600});
 console.log(JSON.stringify(result));
}catch(error){
 // Emit a sanitized failure category. RPC errors must never dump request/session objects.
 const result={ok:false,stage,errorType:error?.constructor?.name||'Error',code:typeof error?.code==='number'?error.code:null,checkedAt:Date.now()};
 fs.writeFileSync(new URL('../artifacts/js-login-probe.json',import.meta.url),JSON.stringify(result),{mode:0o600});
 console.error(JSON.stringify(result));process.exitCode=1;
}
