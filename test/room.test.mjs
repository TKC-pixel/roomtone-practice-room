import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocket } from "ws";
import fs from "node:fs";
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

test("rooms isolate chat and signals, replay stream metadata, enforce access and capacity", async (t) => {
  const dataFile=path.join(os.tmpdir(),`roomtone-test-${randomUUID()}.json`);t.after(()=>{try{fs.rmSync(dataFile,{force:true})}catch{}});
  const server = spawn(process.execPath, ["server.mjs"], {
    env: {
      ...process.env,
      PORT: "0",
      HOST: "127.0.0.1",
      MAX_PARTICIPANTS: "2",
      ROOM_PASSWORD: "test-password",
      ROOMTONE_DATA:dataFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => server.kill());
  const [line] = await once(server.stdout, "data");
  const origin = line.toString().match(/http:\/\/[^\s]+/)[0];
  const connect = async () => {
    const ws = new WebSocket(origin.replace("http", "ws") + "/signal");
    const queue = [];
    ws.on("message", (d) => queue.push(JSON.parse(d)));
    await once(ws, "open");
    t.after(() => ws.terminate());
    return {
      ws,
      queue,
      send: (m) => ws.send(JSON.stringify(m)),
      async next(type) {
        const until = Date.now() + 3000;
        while (Date.now() < until) {
          const i = queue.findIndex((m) => m.type === type);
          if (i >= 0) return queue.splice(i, 1)[0];
          await new Promise((r) => setTimeout(r, 10));
        }
        throw Error("Timed out waiting for " + type+": "+JSON.stringify(queue));
      },
    };
  };
  const owner="owner-browser",md="md-browser",other="other-browser",third="third-browser";
  const create=async(clientId,name)=>{const r=await fetch(origin+"/api/rooms",{method:"POST",headers:{"content-type":"application/json","x-roomtone-access":"test-password","x-roomtone-client":clientId},body:JSON.stringify({name,clientId,ownerName:clientId})});return (await r.json()).room};
  const room=await create(owner,"Sunday practice"),separate=await create(other,"Separate room");
  const manage=async(clientId,role)=>fetch(`${origin}/api/rooms/${room.id}/role`,{method:"POST",headers:{"content-type":"application/json","x-roomtone-access":"test-password","x-roomtone-client":owner},body:JSON.stringify({clientId,role})});
  assert.equal((await manage(md,"md")).status,200);assert.equal((await manage(third,"member")).status,200);
  const setlistResponse=await fetch(`${origin}/api/rooms/${room.id}/setlist`,{method:"PUT",headers:{"content-type":"application/json","x-roomtone-access":"test-password","x-roomtone-client":md},body:JSON.stringify({items:["Song one","Bridge note"]})});assert.equal(setlistResponse.status,200);
  const join = (c, id, clientId) => c.send({ type: "join", room:id, clientId,name:clientId, password: "test-password" });
  assert.equal((await fetch(origin + "/")).status, 200);
  assert.equal((await fetch(origin + "/.env")).status, 404);
  assert.equal((await fetch(origin + "/server.mjs")).status, 404);
  assert.ok((await (await fetch(origin + "/config")).json()).iceServers.length);
  const bad = await connect();
  bad.send({ type: "join", room: room.id, clientId:owner,name:owner, password: "wrong" });
  assert.match((await bad.next("error")).message, /password/);
  const a = await connect();
  join(a, room.id, owner);
  const aj = await a.next("joined");
  a.send({
    type: "stream-meta",
    streamId: "keys-stream",
    label: "Keys live",
    kind: "keys",
  });
  await a.next("stream-meta");
  a.send({ type: "chat", text: "Start chorus" });
  await a.next("chat");
  const b = await connect();
  join(b, room.id, md);
  const bj = await b.next("joined");
  assert.equal(bj.streams[0].label, "Keys live");
  assert.equal(bj.history.find(x=>x.type==="chat").text, "Start chorus");
  assert.deepEqual(bj.setlist,["Song one","Bridge note"]);assert.equal(bj.role,"md");
  assert.equal(bj.peers[0].peerId, aj.peerId);
  const c = await connect();
  join(c, separate.id, other);
  const cj = await c.next("joined");
  assert.equal(cj.history.filter(x=>x.type==="chat").length, 0);
  b.send({type:"metro-start",bpm:112,beats:3,countInBars:2});const metroA=await a.next("metro-state");assert.equal(metroA.metro.bpm,112);assert.equal(metroA.metro.countInBars,2);await b.next("metro-state");
  b.send({type:"metro-tempo",bpm:124,beats:4});assert.equal((await a.next("metro-state")).metro.bpm,124);await b.next("metro-state");
  b.send({type:"metro-stop"});assert.equal((await a.next("metro-state")).metro.running,false);await b.next("metro-state");
  a.send({
    type: "signal",
    to: bj.peerId,
    signal: { description: { type: "offer", sdp: "sample" } },
  });
  assert.equal((await b.next("signal")).from, aj.peerId);
  a.send({
    type: "signal",
    to: cj.peerId,
    signal: { candidate: "must not cross rooms" },
  });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(
    c.queue.some((x) => x.type === "signal"),
    false,
  );
  const full = await connect();
  join(full, room.id, third);
  assert.match((await full.next("error")).message, /full/);
  a.send({ type: "stream-remove", streamId: "keys-stream" });
  assert.equal((await b.next("stream-remove")).streamId, "keys-stream");
  a.ws.close();
  assert.equal((await b.next("peer-left")).peerId, aj.peerId);
  const denied=await connect();join(denied,room.id,third);await denied.next("joined");
  denied.send({type:"metro-start",bpm:90});assert.match((await denied.next("error")).message,/owner or music director/);
});
test("MD cue gain remains closed during fader changes until held", () => {
  const app = fs.readFileSync("public/app.js", "utf8");
  const body = app.slice(app.indexOf('function applyLaneGain('), app.indexOf('function renderTracks('));
  let value;
  const state = { mdHeld: false };
  const context = vm.createContext({
    roomState: state,
    ensureAudio: () => ({ currentTime: 0 }),
  });
  vm.runInContext(body, context);
  const lane = {
    name: "MD mic",
    vol: 85,
    gainNode: { gain: { setTargetAtTime: (n) => (value = n) } },
  };
  context.applyLaneGain(lane);
  assert.equal(value, 0);
  state.mdHeld = true;
  context.applyLaneGain(lane);
  assert.equal(value, 0.85);
  lane.muted = true;
  context.applyLaneGain(lane);
  assert.equal(value, 0);
});
