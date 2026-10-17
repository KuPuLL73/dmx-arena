const assert=require('node:assert/strict'),crypto=require('node:crypto');
async function main(){
 const {playerId,validateSet,validatePreview,rankPlayers}=await import('./domain.mjs');
 const {verifyInit}=await import('./server.mjs');
 const id='00000000-0000-4000-8000-000000000001';assert.equal(playerId(id),id);assert.throws(()=>playerId('bad'));
 const inventory=[{id:'nft:knife',slot:"Chef's Knife",source:'notgames',owned:true}];
 assert.deepEqual(validateSet({name:' Test ',slots:{"Chef's Knife":'nft:knife'}},inventory),{name:'Test',slots:{melee:'nft:knife'}});
 for(const input of [{name:'Other',slots:{"Chef's Knife":'foreign'}},{name:'Wrong slot',slots:{Mask:'nft:knife'}},{name:'Empty',slots:{}}])assert.throws(()=>validateSet(input,inventory));
 assert.throws(()=>validateSet({name:'Old',slots:{"Chef's Knife":'nft:knife'}},[]));
 const weapons=[{id:'a',collection:'Ak-69',slot:'Ak-69',source:'notgames',owned:true},{id:'b',collection:'Ivory Beam',slot:'Ivory Beam',source:'notgames',owned:true},{id:'p',collection:'Micro Mayhem',slot:'Micro Mayhem',source:'notgames',owned:true}];
 assert.throws(()=>validateSet({name:'Two primary',slots:{'Ak-69':'a','Ivory Beam':'b'}},weapons));
 assert.throws(()=>validateSet({name:'Wrong category',slots:{melee:'p'}},weapons));
 assert.deepEqual(validateSet({name:'Five categories',slots:{primary:'a',backup:'p'}},weapons).slots,{primary:'a',backup:'p'});
 const preview={id:'sample-1',name:'Пример',slots:{Mask:'test'},items:[{id:'test',name:'Маска',slot:'Mask',collection:'Test',image:'https://example.com/item.png',owned:true}]};
 assert.equal(validatePreview(preview).items[0].owned,false);assert.equal(validatePreview(preview).items[0].source,'shared_preview');
 assert.throws(()=>validatePreview({...preview,items:[{...preview.items[0],image:'javascript:alert(1)'}]}));assert.throws(()=>validatePreview({...preview,slots:{Mask:'missing'}}));
 assert.deepEqual(rankPlayers([{name:'ignored',link:{name:'B'},userId:2,score:10,scoreVerified:true},{name:'ignored',link:{name:'A'},userId:1,score:200,scoreVerified:true},{name:'Fake',score:9999,scoreVerified:false}]).map(x=>x.name),['A','B']);
 const token='test-only:secret',now=1000,fields={auth_date:'1000',user:JSON.stringify({id:123,first_name:'Fixture'})};
 const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();const hash=crypto.createHmac('sha256',secret).update(Object.entries(fields).sort().map(([k,v])=>k+'='+v).join('\n')).digest('hex');const raw=new URLSearchParams({...fields,hash}).toString();
 assert.equal(verifyInit(raw,token,now).id,123);assert.throws(()=>verifyInit(raw,'wrong',now));assert.throws(()=>verifyInit(raw,token,9000));assert.throws(()=>verifyInit(raw+'&user=forged',token,now));
 assert.deepEqual(rankPlayers([{userId:1,name:'Telegram name',link:{name:'Game nickname'},score:0,scoreVerified:true},{name:'Public game player',score:9999,scoreVerified:true},{userId:2,name:'Negative',score:-1,scoreVerified:true}]).map(x=>x.name),['Game nickname']);
 console.log('Passed: UUID validation, owned-slot validation, missing-item rejection, DMX-only ranking, Telegram HMAC/timestamp/replay-field checks.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
