import {callApplication} from '../lib/bridge.js';
export default async function(input,ctx){return callApplication('startTournament',input||{},ctx);}
