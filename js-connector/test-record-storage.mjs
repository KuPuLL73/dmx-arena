import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteFiles} from './src/record-storage.js';
const db=new DatabaseSync(':memory:');let fail=false,failAfter=0,enforceLimits=true;
const storage={sql:{exec(query,...args){
 if(enforceLimits&&query.startsWith('INSERT INTO dmx_records'))for(const value of args)if(typeof value==='string')assert.ok(Buffer.byteLength(value)<512000,'each bound record stays below the 2 MB limit');
 if(fail&&(query.startsWith('INSERT INTO dmx_records')||query.startsWith('DELETE FROM dmx_files'))&&--failAfter===0)throw Error('Simulated storage interruption');
 const statement=db.prepare(query),rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};
 }},transactionSync(callback){db.exec('BEGIN');try{const result=callback();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
try{
 db.exec('CREATE TABLE dmx_files (name TEXT PRIMARY KEY,data TEXT NOT NULL)');
 const legacy={'profiles.json':{777:{userId:777,name:'DMX 🐺',sets:[{id:'set:1',slots:{primary:'nft:1'}}],active:'set:1',dismissedQuests:['nickname_dmx'],language:'ru',privateProfile:true}},'game-awards.json':{subscription:{userId:777,amount:100}},'game-links.json':{777:{playerId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}};
 for(const [name,value] of Object.entries(legacy))db.prepare('INSERT INTO dmx_files VALUES (?,?)').run('/data/'+name,JSON.stringify(value));
 fail=true;failAfter=2;assert.throws(()=>sqliteFiles(storage),/interruption/);
 assert.equal(db.prepare('SELECT count(*) n FROM dmx_files').get().n,3,'failed migration retains every legacy file');
 assert.equal(db.prepare('SELECT count(*) n FROM dmx_records').get().n,0,'failed migration leaves no partial new records');
 fail=false;let files=sqliteFiles(storage);assert.deepEqual(files.export(),legacy);assert.equal(files.diagnostics().version,2);
 assert.equal(db.prepare('SELECT count(*) n FROM dmx_files').get().n,0,'legacy data removed only after successful atomic migration');
 const big=Object.fromEntries(Array.from({length:35},(_,i)=>[String(i+1),{userId:i+1,payload:'я'.repeat(80000),nick:'DMX💀'}]));
 files.set('/data/large-profiles.json',JSON.stringify(big));files.set('/data/large-value.json',JSON.stringify(['x'.repeat(131070)+'💀'+'я'.repeat(1400000)]));files.set('/data/empty.json','{}');files.set('/data/null.json','null');files.flush();
 assert.ok(Buffer.byteLength(JSON.stringify(big))>2000000,'exercise total profile file larger than old row ceiling');
 files=sqliteFiles(storage);assert.deepEqual(JSON.parse(files.get('/data/large-profiles.json')),big);
 assert.deepEqual(JSON.parse(files.get('/data/large-value.json')),['x'.repeat(131070)+'💀'+'я'.repeat(1400000)]);
 assert.equal(files.get('/data/empty.json'),'{}');assert.equal(files.get('/data/null.json'),'null');
 const edited=structuredClone(big);edited['5'].nick='Updated';
 files.set('/data/large-profiles.json.tmp',JSON.stringify(edited));files.rename('/data/large-profiles.json.tmp','/data/large-profiles.json');files.flush();
 assert.equal(files.diagnostics().lastFlushRowsWritten,1,'editing one profile writes only that record');
 assert.equal(files.get('/data/large-profiles.json.tmp'),undefined);
 assert.equal(db.prepare("SELECT count(*) n FROM dmx_documents WHERE name LIKE '%.tmp'").get().n,0);
 const before=files.export();files.set('/data/game-awards.json',JSON.stringify({next:{amount:150}}));files.set('/data/game-links.json',JSON.stringify({888:{playerId:'next'}}));
 fail=true;failAfter=2;assert.throws(()=>files.flush(),/interruption/);fail=false;
 assert.deepEqual(sqliteFiles(storage).export(),before,'failed commit cannot save only the balance or only the link');
 files.flush();assert.equal(sqliteFiles(storage).export()['game-awards.json'].next.amount,150);
 files.set('/data/large-value.json','[]');files.flush();assert.deepEqual(JSON.parse(sqliteFiles(storage).get('/data/large-value.json')),[],'shrinking removes old tail chunks');
 assert.throws(()=>files.set('/data/../secret.json','{}'),/Invalid/);
 // Replay the actual private pre-update snapshot without changing production.
 const directory=new URL('../.data/cloud-backups/',import.meta.url);
 const names=fs.existsSync(directory)?fs.readdirSync(directory).filter(name=>name.endsWith('.json')).sort():[];
 if(names.length){
  files.clear();files.flush();const snapshot=JSON.parse(fs.readFileSync(new URL(names.at(-1),directory),'utf8')).files;
  for(const [name,value] of Object.entries(snapshot))db.prepare('INSERT INTO dmx_files VALUES (?,?)').run('/data/'+name,JSON.stringify(value));
  const migrated=sqliteFiles(storage);assert.deepEqual(migrated.export(),snapshot,'all actual profiles, UID links, equipment, rewards and settings survive migration');
 }
 console.log('Record storage: atomic legacy/live-snapshot migration, interruption rollback, files above 2 MB, Unicode boundaries, incremental writes, restart and shrink PASS.');
}finally{db.close();}
