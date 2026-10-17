import {callApplication} from '../lib/bridge.js';
export default async function(input,ctx){return callApplication('leaveTournament',input||{},ctx);}
