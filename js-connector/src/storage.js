import {AsyncLocalStorage} from 'node:async_hooks';
export {sqliteFiles} from './record-storage.js';
const context=new AsyncLocalStorage();
export const withFiles=(files,callback)=>context.run(files,callback);
function store(){const value=context.getStore();if(!value)throw Error('Storage context missing');return value;}
function missing(){return Object.assign(Error('Application file not found'),{code:'ENOENT'});}
const filename=value=>String(value).replaceAll('\\','/');
export default {
 readFileSync(name){const value=store().get(filename(name));if(value===undefined)throw missing();return value;},
 writeFileSync(name,value){store().set(filename(name),String(value));},
 renameSync(from,to){store().rename(filename(from),filename(to));},
 mkdirSync(){},
 existsSync(name){return store().get(filename(name))!==undefined;}
};
