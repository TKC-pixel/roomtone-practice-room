import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const port = Number(process.env.PORT || 8787),
  host = process.env.HOST || "127.0.0.1";
const maximum = Number(process.env.MAX_PARTICIPANTS || 8);
if (
  !Number.isInteger(port) ||
  port < 0 ||
  port > 65535 ||
  !Number.isInteger(maximum) ||
  maximum < 1
)
  throw Error("Invalid PORT or MAX_PARTICIPANTS");
const iceServers = process.env.ICE_SERVERS_JSON
  ? JSON.parse(process.env.ICE_SERVERS_JSON)
  : [{ urls: "stun:stun.l.google.com:19302" }];
if (!Array.isArray(iceServers))
  throw Error("ICE_SERVERS_JSON must be an array");
if (!['all','relay'].includes(process.env.ICE_TRANSPORT_POLICY||'all'))
  throw Error('ICE_TRANSPORT_POLICY must be all or relay');
if (!!process.env.ROOMTONE_CERT !== !!process.env.ROOMTONE_KEY)
  throw Error('Configure ROOMTONE_CERT and ROOMTONE_KEY together');
const rooms = new Map();
const dataFile=process.env.ROOMTONE_DATA||path.join(path.dirname(root),"data","roomtone.json");
fs.mkdirSync(path.dirname(dataFile),{recursive:true});
let saved={};
if(fs.existsSync(dataFile)) {
  saved=JSON.parse(fs.readFileSync(dataFile,"utf8"));
  if(!saved || !saved.rooms || typeof saved.rooms!=="object" || Array.isArray(saved.rooms))throw Error("Invalid room data file; restore a backup before starting");
}
const publicId=id=>createHash("sha256").update(id).digest("hex");
const validId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{8,80}$/.test(id)&&!["__proto__","constructor","prototype"].includes(id);
const roomRecords=new Map(Object.entries(saved.rooms||{}));
for(const record of roomRecords.values()) {
  record.members=Object.assign(Object.create(null),record.members||{});
  record.setlistRevision??=0;
  if(record.metro)record.metro.running=false;
}
function persist(){const temp=dataFile+".tmp";fs.writeFileSync(temp,JSON.stringify({rooms:Object.fromEntries(roomRecords)}));fs.renameSync(temp,dataFile)}
async function bodyJson(req){let raw="";for await(const c of req){raw+=c;if(raw.length>1000000)throw Error("Request too large")}const body=JSON.parse(raw||"{}");if(!body||typeof body!=="object"||Array.isArray(body))throw Error("Expected a JSON object");return body}
const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const send = (peer, msg) => {
  if (peer.socket.readyState === WebSocket.OPEN)
    peer.socket.send(JSON.stringify(msg));
};
const broadcast = (room, msg, except) => {
  for (const p of room.peers.values()) if (p !== except) send(p, msg);
};
function authorize(value) {
  const expected = process.env.ROOM_PASSWORD || "";
  if (!expected) return true;
  const a = Buffer.from(String(value || "")),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function remove(peer) {
  if (!peer.joined) return;
  peer.joined = false;
  const room = rooms.get(peer.room);
  if (!room) return;
  room.peers.delete(peer.id);
  room.lastActive = Date.now();
  room.record.history.push({type:"session",action:"left",name:peer.name,at:Date.now()});room.record.history=room.record.history.slice(-200);persist();room.clockReports?.delete(peer.id);
  if(!room.peers.size&&room.record.metro?.running){room.record.metro={...room.record.metro,running:false,at:Date.now(),revision:room.record.metro.revision+1};persist();}
  broadcast(room, { type: "peer-left", peerId: peer.id, name: peer.name });
  broadcast(room,{type:"sync-metrics",metrics:[...(room.clockReports?.values()||[])]});
}
function message(peer, msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return;
  if (!peer.joined) {
    if (msg.type !== "join") return;
    if (!authorize(msg.password)) {
      send(peer, {
        type: "error",
        message: "Incorrect access password. Set it in Settings.",
      });
      peer.socket.close(1008);
      return;
    }
    const clientId=clean(msg.clientId,80)||randomUUID(),name=clean(msg.name,32)||"Musician";
    if(!validId(clientId)){send(peer,{type:"error",message:"Invalid browser identity"});peer.socket.close(1008);return;}
    const code = clean(msg.room, 64);
    if(!code){send(peer,{type:"error",message:"Choose a room code"});return;}
    let record=roomRecords.get(code);
    if(!record){record={id:code,name:clean(msg.roomName,80)||code,ownerId:clientId,members:{[clientId]:{name,role:"owner"}},setlist:[],history:[],metro:null};roomRecords.set(code,record);persist();}
    const member=(Object.hasOwn(record.members,clientId)?record.members[clientId]:null)||{name,role:"member"};record.members[clientId]=member;member.name=name;persist();
    if (!rooms.has(code)) {
      if (rooms.size >= 500) {
        send(peer, { type: "error", message: "Server room limit reached" });
        peer.socket.close(1013);
        return;
      }
      rooms.set(code, { peers: new Map(), record, lastActive: Date.now(),clockReports:new Map() });
    }
    const room = rooms.get(code);
    if (room.peers.size >= maximum) {
      send(peer, {
        type: "error",
        message: `Room is full (${maximum} participants)`,
      });
      peer.socket.close(1008);
      return;
    }
    peer.id = randomUUID();
    peer.name = name;peer.clientId=clientId;peer.role=member.role;
    peer.instrument = clean(msg.instrument, 36) || "Instrument";
    peer.room = code;
    peer.streams = new Map();
    peer.joined = true;
    const others = [...room.peers.values()];
    room.peers.set(peer.id, peer);
    record.history.push({type:"session",action:"joined",name:peer.name,at:Date.now()});record.history=record.history.slice(-200);persist();
    send(peer, {
      type: "joined",
      peerId: peer.id,
      room: code,
      peers: others.map((p) => ({
        peerId: p.id,
        name: p.name,
        instrument: p.instrument,
        role:p.role,
      })),
      history: record.history.slice(-100),setlist:record.setlist,metro:record.metro,role:peer.role,
      syncMetrics:[...(room.clockReports?.values()||[])],
      streams: others.flatMap((p) => [...p.streams.values()]),
    });
    broadcast(
      room,
      {
        type: "peer-joined",
        peerId: peer.id,
        name: peer.name,
        instrument: peer.instrument,
        role:peer.role,
      },
      peer,
    );
    return;
  }
  const room = rooms.get(peer.room);
  if (!room) return;
  room.lastActive = Date.now();
  if (msg.type === "chat") {
    const text = clean(msg.text, 1000);
    if (!text) return;
    const entry = {
      type: "chat",
      peerId: peer.id,
      name: peer.name,
      text,
      at: Date.now(),
    };
    room.record.history.push(entry);
    room.record.history = room.record.history.slice(-200);persist();
    broadcast(room, entry);
  } else if (msg.type === "signal") {
    const recipient = room.peers.get(msg.to);
    if (recipient && msg.signal && typeof msg.signal === "object")
      send(recipient, { type: "signal", from: peer.id, signal: msg.signal });
  } else if (msg.type === "stream-meta") {
    const streamId = clean(msg.streamId, 128);
    if (!streamId || (!peer.streams.has(streamId) && peer.streams.size >= 32))
      return;
    const entry = {
      type: "stream-meta",
      peerId: peer.id,
      streamId,
      label: clean(msg.label, 120) || "Audio",
      kind: clean(msg.kind, 40) || "instrument",
    };
    peer.streams.set(streamId, entry);
    broadcast(room, entry);
  } else if (msg.type === "stream-remove") {
    const streamId = clean(msg.streamId, 128);
    peer.streams.delete(streamId);
    broadcast(room, { type: "stream-remove", peerId: peer.id, streamId });
  } else if(msg.type==="clock"){send(peer,{type:"clock",clientAt:msg.clientAt,serverAt:Date.now()});}
  else if(msg.type==="clock-report"){
    if(!Number.isFinite(msg.rtt)||!Number.isFinite(msg.offset)||!Number.isFinite(msg.driftPpm))return;
    room.clockReports??=new Map();room.clockReports.set(peer.id,{peerId:peer.id,name:peer.name,rtt:Math.max(0,Math.min(60000,msg.rtt)),offset:Math.max(-86400000,Math.min(86400000,msg.offset)),driftPpm:Math.max(-100000,Math.min(100000,msg.driftPpm)),driftReady:!!msg.driftReady,at:Date.now()});
    broadcast(room,{type:"sync-metrics",metrics:[...room.clockReports.values()]});
  }
  else if(msg.type==="metro-start"||msg.type==="metro-tempo"){
    if(!["owner","md"].includes(peer.role)){send(peer,{type:"error",message:"Only the room owner or music director can control the shared metronome"});return;}
    const bpm=Math.max(30,Math.min(300,Math.round(Number(msg.bpm)||68))),beats=Math.max(1,Math.min(12,Math.round(Number(msg.beats)||4)));
    const countInBars=Math.max(0,Math.min(4,Math.round(Number(msg.countInBars)||0))),lead=msg.type==="metro-start"?Math.max(3000,countInBars*beats*60000/bpm+1200):1500;
    const metro={running:true,bpm,beats,accent:msg.accent!==false,countInBars,at:Date.now()+lead,revision:(room.record.metro?.revision||0)+1,by:peer.id};room.record.metro=metro;persist();broadcast(room,{type:"metro-state",metro});
  } else if(msg.type==="metro-stop"){
    if(!["owner","md"].includes(peer.role))return;room.record.metro={...(room.record.metro||{}),running:false,at:Date.now(),revision:(room.record.metro?.revision||0)+1};persist();broadcast(room,{type:"metro-state",metro:room.record.metro});
  }
}
const files = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
  ["/metronome.js", "metronome.js"],
  ["/diagnostics.js", "diagnostics.js"],
]);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
function serve(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const reply=(status,data)=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify(data))};
  const endpoint=async()=>{
    const clientId=clean(req.headers["x-roomtone-client"],80);
    if(!validId(clientId))return reply(400,{error:"Invalid browser identity"});
    if(!authorize(req.headers["x-roomtone-access"]))return reply(403,{error:"Incorrect server access password"});
    if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host && req.headers.origin!==process.env.PUBLIC_ORIGIN)return reply(403,{error:"Origin not allowed"});
    if(url.pathname==="/api/rooms"&&req.method==="GET")return reply(200,{rooms:[...roomRecords.values()].filter(r=>r.members[clientId]).map(r=>({id:r.id,name:r.name,role:r.members[clientId].role}))});
    if(url.pathname==="/api/rooms"&&req.method==="POST"){
      const body=await bodyJson(req),owner=clean(body.clientId||clientId,80),name=clean(body.name,80)||"Practice room";if(!validId(owner))return reply(400,{error:"Client identity is required"});const id=randomUUID().slice(0,8),record={id,name,ownerId:owner,members:{[owner]:{name:clean(body.ownerName,32)||"Musician",role:"owner"}},setlist:[],history:[],metro:null};roomRecords.set(id,record);persist();return reply(201,{room:{id,name,role:"owner"}});
    }
    const match=url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(members|role|setlist))?$/);
    if(match){const record=roomRecords.get(decodeURIComponent(match[1]));if(!record)return reply(404,{error:"Room not found"});const part=match[2];
      if(!part&&req.method==="GET")return reply(200,{room:{id:record.id,name:record.name,role:record.members[clientId]?.role||"member"},members:Object.entries(record.members).map(([id,m])=>({clientId:publicId(id),name:m.name,role:m.role,online:[...(rooms.get(record.id)?.peers.values()||[])].some(p=>p.clientId===id)})),setlist:record.setlist,setlistRevision:record.setlistRevision||0,history:record.history.slice(-100)});
      if(part==="setlist"&&req.method==="PUT"){const body=await bodyJson(req),lines=body.items;if(body.revision!==undefined&&body.revision!==(record.setlistRevision||0))return reply(409,{error:"The setlist changed. Copy your draft, reopen the setlist, and merge your edits."});if(!Array.isArray(lines)||lines.length>100)return reply(400,{error:"Setlists can contain up to 100 lines"});record.setlist=lines.map(x=>clean(x,240)).filter(Boolean);record.setlistRevision=(record.setlistRevision||0)+1;persist();const live=rooms.get(record.id);if(live)broadcast(live,{type:"setlist",items:record.setlist,revision:record.setlistRevision});return reply(200,{items:record.setlist,revision:record.setlistRevision});}
      if(part==="role"&&req.method==="POST"){if(record.ownerId!==clientId)return reply(403,{error:"Only the room owner can assign the MD role"});const body=await bodyJson(req),requested=clean(body.clientId,80),target=Object.keys(record.members).find(id=>publicId(id)===requested)||requested;if(!validId(target)||target===record.ownerId)return reply(400,{error:"Choose another room member"});const member=(Object.hasOwn(record.members,target)?record.members[target]:null)||{name:clean(body.name,32)||"Musician",role:"member"};record.members[target]=member;member.role=body.role==="md"?"md":"member";persist();const live=rooms.get(record.id);if(live)for(const p of live.peers.values())if(p.clientId===target){p.role=member.role;send(p,{type:"role",role:p.role});}return reply(200,{ok:true,role:member.role});}
      return reply(405,{error:"Method not allowed"});}
    return null;
  };  if(url.pathname.startsWith("/api/")){endpoint().then(result=>{if(result===null)reply(404,{error:"Not found"})}).catch(error=>reply(400,{error:error.message||"Invalid request"}));return;}
  if (req.method !== "GET" && req.method !== "HEAD") {res.writeHead(405);res.end();return;}
  if (url.pathname === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        rooms: rooms.size,
        peers: [...rooms.values()].reduce((n, r) => n + r.peers.size, 0),
      }),
    );
    return;
  }
  if (url.pathname === "/config") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ iceServers, iceTransportPolicy:process.env.ICE_TRANSPORT_POLICY||"all", maxParticipants: maximum }));
    return;
  }
  const file = files.get(url.pathname);
  if (!file) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  fs.readFile(path.join(root, file), (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end("Unable to load application");
      return;
    }
    res.setHeader("Content-Type", mime[path.extname(file)]);
    res.end(req.method === "HEAD" ? undefined : data);
  });
}
const tls = process.env.ROOMTONE_CERT && process.env.ROOMTONE_KEY;
const server = tls
  ? https.createServer(
      {
        cert: fs.readFileSync(process.env.ROOMTONE_CERT),
        key: fs.readFileSync(process.env.ROOMTONE_KEY),
      },
      serve,
    )
  : http.createServer(serve);
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 128 * 1024,
  perMessageDeflate: false,
});
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/signal") {
    socket.destroy();
    return;
  }
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host && req.headers.origin !== process.env.PUBLIC_ORIGIN) {
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
});
wss.on("connection", (socket) => {
  const peer = {
    socket,
    joined: false,
    alive: true,
    window: Date.now(),
    count: 0,
  };
  socket.on("pong", () => (peer.alive = true));
  const joinTimer = setTimeout(() => {
    if (!peer.joined) socket.close(1008);
  }, 15000);
  socket.on("message", (data) => {
    if (Date.now() - peer.window > 1000) {
      peer.window = Date.now();
      peer.count = 0;
    }
    if (++peer.count > 150) {
      socket.close(1008);
      return;
    }
    try {
      message(peer, JSON.parse(data.toString()));
    } catch {
      send(peer, { type: "error", message: "Invalid room message" });
    }
  });
  socket.on("close", () => {
    clearTimeout(joinTimer);
    remove(peer);
  });
  socket.on("error", () => remove(peer));
  socket.peer = peer;
});
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.peer.alive) {
      socket.terminate();
      continue;
    }
    socket.peer.alive = false;
    socket.ping();
  }
  for (const [id, r] of rooms)
    if (!r.peers.size && Date.now() - r.lastActive > 3600000) rooms.delete(id);
}, 30000);
server.listen(port, host, () =>
  console.log(
    `Roomtone listening on ${tls ? "https" : "http"}://${host}:${server.address().port}`,
  ),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    clearInterval(heartbeat);
    for (const socket of wss.clients) socket.terminate();
    wss.close();
    server.close(() => process.exit(0));
  });
