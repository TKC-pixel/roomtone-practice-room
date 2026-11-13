import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const remote=process.argv.includes('--remote');
let errors=0;
function check(ok,message){console.log(`${ok?'PASS':'FAIL'} ${message}`);if(!ok)errors++;}
const [major,minor]=process.versions.node.split('.').map(Number);
check(major>22||major===22&&minor>=9,'Node.js supports the configured start command');
for(const file of ['server.mjs','public/app.js','public/metronome.js','public/index.html'])check(fs.existsSync(path.join(root,file)),`${file} exists`);
try{await import('ws');check(true,'WebSocket dependency installed')}catch{check(false,'Run npm ci to install dependencies')}
const data=path.resolve(process.env.ROOMTONE_DATA||path.join(root,'data/roomtone.json'));
try{fs.mkdirSync(path.dirname(data),{recursive:true});fs.accessSync(path.dirname(data),fs.constants.W_OK);if(fs.existsSync(data)){const parsed=JSON.parse(fs.readFileSync(data,'utf8'));if(!parsed.rooms||Array.isArray(parsed.rooms))throw Error('Invalid rooms object');}check(true,'Room data directory is writable and existing data parses')}catch(e){check(false,`Room data: ${e.message}`)}
let servers=[];
try{servers=JSON.parse(process.env.ICE_SERVERS_JSON||'[]');if(!Array.isArray(servers))throw Error('expected an array');check(true,'ICE configuration parses')}catch(e){check(false,`ICE configuration: ${e.message}`)}
const relay=servers.some(s=>[s.urls].flat().some(u=>/^turns?:/.test(u||''))&&s.username&&s.credential);
if(remote){
  check(!!relay,'Remote configuration includes TURN with credentials');
  check(!!(process.env.ROOMTONE_CERT&&process.env.ROOMTONE_KEY)||/^https:\/\//.test(process.env.PUBLIC_ORIGIN||''),'HTTPS certificate pair or PUBLIC_ORIGIN for your reverse proxy is configured');
}else console.log(`INFO TURN relay ${relay?'configured':'not configured; required for reliable remote connectivity'}`);
for(const key of ['ROOMTONE_CERT','ROOMTONE_KEY'])if(process.env[key])check(fs.existsSync(process.env[key]),`${key} file exists`);
check(!!process.env.ROOMTONE_CERT===!!process.env.ROOMTONE_KEY,'Direct HTTPS certificate and key are configured together');
check(['all','relay'].includes(process.env.ICE_TRANSPORT_POLICY||'all'),'ICE_TRANSPORT_POLICY is all or relay');
console.log('This checks files and configuration only. Use Room tools → Connection check to inspect a live media path.');
process.exitCode=errors?1:0;
