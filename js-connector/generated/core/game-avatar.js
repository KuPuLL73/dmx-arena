// Generated from the preserved Node/Python application.
// Clan emblems supplied by Pixel World's public API.
export function clanPhoto(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='static.pw.game'&&url.pathname.startsWith('/teams/')&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
