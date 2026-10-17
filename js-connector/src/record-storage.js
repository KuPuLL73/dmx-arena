// Keep the application's filesystem contract while storing each top-level
// profile/award/progress record independently. Oversized records are segmented.
const CHARS=131072;
const key=name=>{if(!/^\/data\/[a-z0-9.-]+$/.test(name)||name.includes('..'))throw Error('Invalid application file');return name;};
function chunks(text){
 const result=[];
 for(let start=0;start<text.length;){
  let end=Math.min(text.length,start+CHARS);
  if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;
  result.push(text.slice(start,end));start=end;
 }
 return result;
}
function describe(text,previous){
 const value=JSON.parse(text),format=value!==null&&typeof value==='object'&&!Array.isArray(value)?'object':'value';
 const before=previous?.format===format?previous.records:new Map();
 let next=[...before.values()].reduce((largest,row)=>Math.max(largest,row.ordinal),-1)+1;
 const entries=format==='object'?Object.entries(value):[['',value]],records=new Map();
 for(const [entry,value] of entries){
  const text=JSON.stringify(value),old=before.get(entry);
  records.set(entry,old?.text===text?old:{text,ordinal:old?.ordinal??next++,chunks:chunks(text)});
 }
 return {format,records};
}
export function sqliteFiles(storage){
 const sql=storage.sql,documents=new Map(),values=new Map(),dirty=new Set();let lastFlushRowsWritten=0;
 sql.exec('CREATE TABLE IF NOT EXISTS dmx_files (name TEXT PRIMARY KEY, data TEXT NOT NULL)');
 sql.exec('CREATE TABLE IF NOT EXISTS dmx_documents (name TEXT PRIMARY KEY, format TEXT NOT NULL)');
 sql.exec('CREATE TABLE IF NOT EXISTS dmx_records (file TEXT NOT NULL, entry TEXT NOT NULL, part INTEGER NOT NULL, ordinal INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(file,entry,part))');
 function write(name,next,previous){
  let writes=0;
  if(!next){
   if(previous){sql.exec('DELETE FROM dmx_records WHERE file = ?',name);sql.exec('DELETE FROM dmx_documents WHERE name = ?',name);writes+=1+[...previous.records.values()].reduce((n,row)=>n+row.chunks.length,0);}return writes;
  }
  if(!previous||previous.format!==next.format){
   if(previous){sql.exec('DELETE FROM dmx_records WHERE file = ?',name);writes+=[...previous.records.values()].reduce((n,row)=>n+row.chunks.length,0);}
   sql.exec('INSERT INTO dmx_documents (name,format) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET format=excluded.format',name,next.format);writes++;
  }
  const before=previous?.format===next.format?previous.records:new Map();
  for(const [entry,old] of before)if(!next.records.has(entry)){sql.exec('DELETE FROM dmx_records WHERE file = ? AND entry = ?',name,entry);writes+=old.chunks.length;}
  for(const [entry,row] of next.records){
   const old=before.get(entry);if(old===row)continue;
   for(let part=0;part<row.chunks.length;part++)if(old?.chunks[part]!==row.chunks[part]||old?.ordinal!==row.ordinal){
    sql.exec('INSERT INTO dmx_records (file,entry,part,ordinal,data) VALUES (?,?,?,?,?) ON CONFLICT(file,entry,part) DO UPDATE SET ordinal=excluded.ordinal,data=excluded.data',name,entry,part,row.ordinal,row.chunks[part]);writes++;
   }
   if(old&&old.chunks.length>row.chunks.length){sql.exec('DELETE FROM dmx_records WHERE file = ? AND entry = ? AND part >= ?',name,entry,row.chunks.length);writes+=old.chunks.length-row.chunks.length;}
  }
  return writes;
 }
 // A failed migration rolls back all new rows and all legacy deletions together.
 const legacy=sql.exec('SELECT name,data FROM dmx_files').toArray();
 if(legacy.length)storage.transactionSync(()=>{
  for(const row of legacy){
   key(row.name);
   if(sql.exec('SELECT name FROM dmx_documents WHERE name = ?',row.name).toArray().length)throw Error('Conflicting storage versions; recovery required');
   write(row.name,describe(row.data));sql.exec('DELETE FROM dmx_files WHERE name = ?',row.name);
  }
 });
 for(const row of sql.exec('SELECT name,format FROM dmx_documents').toArray()){
  key(row.name);if(!['object','value'].includes(row.format))throw Error('Invalid document format');documents.set(row.name,{format:row.format,records:new Map()});
 }
 for(const row of sql.exec('SELECT file,entry,part,ordinal,data FROM dmx_records ORDER BY file,ordinal,part').toArray()){
  const document=documents.get(row.file);if(!document)throw Error('Storage record has no document');
  let record=document.records.get(row.entry);if(!record){record={text:'',chunks:[],ordinal:row.ordinal};document.records.set(row.entry,record);}
  if(row.part!==record.chunks.length||row.ordinal!==record.ordinal)throw Error('Incomplete storage record');record.chunks.push(row.data);record.text+=row.data;
 }
 for(const [name,document] of documents){
  let value;
  if(document.format==='object')value=Object.fromEntries([...document.records].map(([entry,row])=>[entry,JSON.parse(row.text)]));
  else{if(document.records.size!==1||!document.records.has(''))throw Error('Invalid value document');value=JSON.parse(document.records.get('').text);}
  values.set(name,JSON.stringify(value));
 }
 return {
  get(name){return values.get(key(name));},
  set(name,value){key(name);if(values.get(name)!==value){values.set(name,value);dirty.add(name);}},
  rename(from,to){const value=this.get(from);if(value===undefined)throw Object.assign(Error('Application file not found'),{code:'ENOENT'});this.set(to,value);values.delete(key(from));dirty.add(from);},
  clear(){for(const name of values.keys())dirty.add(name);values.clear();},
  export(){return Object.fromEntries([...values].map(([name,data])=>[name.slice(6),JSON.parse(data)]));},
  diagnostics(){let records=0,parts=0,largestPartBytes=0;for(const doc of documents.values())for(const row of doc.records.values()){records++;parts+=row.chunks.length;for(const part of row.chunks)largestPartBytes=Math.max(largestPartBytes,Buffer.byteLength(part));}return {version:2,documents:documents.size,records,parts,largestPartBytes,lastFlushRowsWritten};},
  flush(){
   const plans=[...dirty].filter(name=>values.has(name)||documents.has(name)).map(name=>({name,next:values.has(name)?describe(values.get(name),documents.get(name)):null}));
   let writes=0;
   storage.transactionSync(()=>{for(const {name,next} of plans)writes+=write(name,next,documents.get(name));});
   for(const {name,next} of plans)if(next)documents.set(name,next);else documents.delete(name);
   lastFlushRowsWritten=writes;dirty.clear();
  }
 };
}
