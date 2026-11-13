import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('guest room API guards passwords, hides browser secrets, rejects stale setlists and persists across restart',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roomtone-state-')),data=path.join(dir,'rooms.json');let server;
  async function stop(){if(server&&server.exitCode===null){const ended=once(server,'exit');server.kill();await ended;}}
  t.after(async()=>{await stop();fs.rmSync(dir,{recursive:true,force:true});});
  async function start(){server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',ROOM_PASSWORD:'band-pass',ROOMTONE_DATA:data},stdio:['ignore','pipe','pipe']});const [line]=await once(server.stdout,'data');return line.toString().match(/http:\/\/\S+/)[0];}
  let origin=await start();const owner='owner-secret-browser-123456';
  async function request(route,method='GET',body,headers={}){return fetch(origin+route,{method,headers:{'content-type':'application/json','x-roomtone-client':owner,'x-roomtone-access':'band-pass',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  assert.equal((await request('/api/rooms','GET',undefined,{'x-roomtone-access':''})).status,403);
  assert.equal((await request('/api/rooms','POST',{name:'Bad',clientId:'__proto__'})).status,400);
  assert.equal((await request('/api/rooms','POST',null)).status,400);
  const response=await request('/api/rooms','POST',{name:'Band rehearsal',clientId:owner});assert.equal(response.status,201);const {room}=await response.json();
  const route='/api/rooms/'+room.id;
  const info=await (await request(route)).json();assert.equal(info.room.role,'owner');assert.ok(!JSON.stringify(info).includes(owner));
  assert.equal((await request(route+'/role','POST',{clientId:'another-player',role:'md'},{'x-roomtone-client':'another-player'})).status,403);
  assert.equal((await request(route+'/setlist','PUT',{items:['Opening song'],revision:0})).status,200);
  assert.equal((await request(route+'/setlist','PUT',{items:['Old draft'],revision:0})).status,409);
  assert.equal((await request(route+'/setlist','PUT',{items:['Injected'],revision:1},{origin:'https://unrelated.example'})).status,403);
  await stop();origin=await start();
  const restored=await (await request(route)).json();assert.deepEqual(restored.setlist,['Opening song']);assert.equal(restored.setlistRevision,1);
  await stop();fs.writeFileSync(data,'invalid json');
  server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',ROOMTONE_DATA:data},stdio:['ignore','pipe','pipe']});
  const [exitCode]=await once(server,'exit');assert.notEqual(exitCode,0);assert.equal(fs.readFileSync(data,'utf8'),'invalid json','corrupt state must not be replaced with an empty database');
});
