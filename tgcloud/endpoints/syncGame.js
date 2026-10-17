import {callApplication} from '../lib/bridge.js';
export default async function(input,ctx){return callApplication('syncGame',input||{},ctx);}
