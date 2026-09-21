// Free, non-generative real HTTP smoke: launches a temporary local Render server.
// No provider tokens, Supabase sessions, user files or external network requests.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { randomInt } from 'node:crypto';

const port=randomInt(18500,24500);
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.js'],{
  cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']
});
let stderr='';
child.stderr.on('data',data=>{stderr+=String(data).slice(0,300)});
async function probe(path,{statuses=[200],method='GET',contentType}={}){
 const response=await fetch(base+path,{method,signal:AbortSignal.timeout(2500),cache:'no-store'});
 if(!statuses.includes(response.status))throw Error(path+': HTTP '+response.status+' expected '+statuses.join('/'));
 if(contentType&&!String(response.headers.get('content-type')||'').includes(contentType))throw Error(path+': incorrect content type');
 return response;
}
try{
 let live=false;
 for(let i=0;i<45;i++){
   if(child.exitCode!==null)throw Error('server exited before smoke checks');
   try{await probe('/api/health/liveness');live=true;break}catch{await delay(100)}
 }
 if(!live)throw Error('liveness did not become ready');
 const state=await(await probe('/api/health/liveness')).json();
 if(state.ok!==true||state.component!=='node-http')throw Error('invalid liveness payload');
 const readiness=await(await probe('/api/health/readiness',{statuses:[200,503]})).json();
 if(readiness.providerInferenceVerified!==false||!readiness.readiness)throw Error('untruthful readiness payload');
 await probe('/',{contentType:'text/html'});
 await probe('/sw.js',{contentType:'text/javascript'});
 await probe('/wae-answer-widgets-v1.js',{contentType:'text/javascript'});
 await probe('/continuity-backup-v7.js',{contentType:'text/javascript'});
 await probe('/continuity-archive-core-v7.js',{contentType:'text/javascript'});
 await probe('/continuity-backup-v7.css',{contentType:'text/css'});
 await probe('/api/chat',{statuses:[405]});
 for(const url of ['/api/no-such-route','/lib/providers.js','/server.js','/package.json','/tests/response-quality.test.js','/%2eenv','/missing.js']){
   await probe(url,{statuses:[404]});
 }
 console.log('[WAE Continuity Smoke] PASS liveness, truthful readiness, public shell, blocked source/config, route isolation; actualInferenceTested=false');
}catch(error){
 console.error('[WAE Continuity Smoke] FAIL '+String(error.message||error).slice(0,250)+(stderr?'; server_stderr='+stderr.slice(0,250):''));
 process.exitCode=1;
}finally{
 child.kill('SIGTERM');
}
