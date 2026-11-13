const tracks = [
  {
    name: "Drums",
    type: "MIDI lane · connect to play",
    icon: "◉",
    status: "READY",
    color: "#c4f66b",
    vol: 78,
    pan: "C",
  },
  {
    name: "Bass",
    type: "MIDI lane · connect to play",
    icon: "▤",
    status: "READY",
    color: "#71dcc4",
    vol: 64,
    pan: "C",
  },
  {
    name: "Keys",
    type: "MIDI lane · connect to play",
    icon: "▦",
    status: "READY",
    color: "#b5a0ff",
    vol: 71,
    pan: "C",
  },
  {
    name: "Electric guitar",
    type: "MIDI lane · connect to play",
    icon: "♬",
    status: "READY",
    color: "#ffb86c",
    vol: 56,
    pan: "C",
  },
  {
    name: "Acoustic guitar",
    type: "Audio lane · connect a mic",
    icon: "♩",
    status: "READY",
    color: "#f19172",
    vol: 62,
    pan: "C",
  },
  {
    name: "Strings",
    type: "MIDI lane · connect to play",
    icon: "〰",
    status: "READY",
    color: "#7ca8ff",
    vol: 43,
    pan: "C",
  },
  {
    name: "Backing vocals",
    type: "Audio lane · connect a mic",
    icon: "♙",
    status: "READY",
    color: "#ec91b9",
    vol: 49,
    pan: "C",
  },
];
let toastTimer,
  midiAccess = null,
  micStreams = { vocal: null, md: null },
  mdActive = false,
  mdTalking = false,
  playing = false,
  elapsed = 84,
  muted = new Set();
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
function notify(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}
let modalCancel=null;
function showModal(title, desc, body, action = "Done", callback = null) {
  closeModal();
  $("#modal").innerHTML =
    `<h2>${title}</h2><p>${desc}</p>${body}<div class="modal-actions"><button class="btn" id="cancelModal">Cancel</button><button class="btn primary" id="confirmModal">${action}</button></div>`;
  $("#modalBackdrop").classList.add("open");
  $("#cancelModal").onclick = closeModal;
  $("#confirmModal").onclick = () => {
    if (callback) callback();
    closeModal();
  };
}
function closeModal() {
  const cancel=modalCancel;modalCancel=null;cancel?.();
  $("#modalBackdrop").classList.remove("open");
}
$("#modalBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "modalBackdrop") closeModal();
});

// Live room client: local signaling, peer-to-peer audio, shared chat, and local mix controls.
const clientId=localStorage.getItem("roomtone-client-id")||(()=>{const id=globalThis.crypto?.randomUUID?.()||`rt-${Math.random().toString(36).slice(2)}-${Date.now()}`;localStorage.setItem("roomtone-client-id",id);return id})();
const roomState = {
  socket: null,
  id: null,
  name: "Musician",
  instrument: "Keys",
  room: "sunday-service-02",
  roster: new Map(),
  pcs: new Map(),
  outgoing: new Map(),
  incoming: new Map(),
  metadata: new Map(),
  audio: null,
  midi: null,
  midiInputs: new Set(),
  synths: new Map(),
  joined: false,
  paused: false,
  clientId,
  role: "member",
  serverOffset: 0,
  clockSamples: [],
  clockAnchor: null,
  syncMetrics: [],
  sharedMetro: null,
};
async function api(path, method="GET", body) {
  const response=await fetch(path,{method,headers:{"Content-Type":"application/json","X-Roomtone-Client":roomState.clientId,"X-Roomtone-Access":sessionStorage.getItem("roomtone-access")||"",...(body?{}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);return data;
}
document.head.insertAdjacentHTML(
  "beforeend",
  "<style>.progress:before{width:var(--progress,0%)}.progress:after{left:var(--progress,0%)}</style>",
);
const supportedParts = [
  "Keys",
  "Drums",
  "Bass",
  "Electric guitar",
  "Acoustic guitar",
  "Lead vocals",
  "Backing vocals",
  "Synth / pad",
  "Percussion",
  "Organ",
  "Software instrument / DAW",
  "Strings",
  "Violin",
  "Cello",
  "Saxophone",
  "Trumpet",
  "Flute",
  "Other instrument",
];
function roomMessage(data) {
  if (roomState.socket?.readyState === WebSocket.OPEN)
    roomState.socket.send(JSON.stringify(data));
}
window.roomState=roomState;window.roomMessage=roomMessage;
function setRoomStatus(text, connected = false) {
  const pill = $("#roomPill");
  pill.innerHTML = `<i class="live-dot" style="background:${connected ? "var(--lime)" : "#ff665f"}"></i> ${text}`;
  $("#streamRoomLabel").textContent = connected ? "CONNECTED" : "NOT CONNECTED";
  $("#streamStatusText").textContent = connected
    ? "Peer audio ready · WebRTC"
    : "Join a room to connect audio";
  $("#streamBtn").disabled = !connected;
  $("#streamPreview").classList.toggle(
    "paused",
    !connected || roomState.paused,
  );
}
function renderRoster() {
  const list = [...roomState.roster.values()];
  $("#peopleCount").textContent = `· ${list.length} in room`;
  document.querySelector(".chat-panel .panel-head span").textContent =
    `${list.length} musician${list.length === 1 ? "" : "s"}`;
  $("#avatarStack").innerHTML = list
    .slice(0, 4)
    .map(
      (p, i) =>
        `<span class="avatar" title="${escapeAttr(p.name)}" style="background:${["#c6e493", "#8fc8bc", "#f0b38d", "#c5b1f5"][i % 4]}">${escapeHtml(initials(p.name))}</span>`,
    )
    .join("");
  if (list.length > 4)
    $("#avatarStack").insertAdjacentHTML(
      "beforeend",
      `<span class="avatar">+${list.length - 4}</span>`,
    );
}
function initials(name) {
  return String(name || "M")
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0] || "")
    .join("")
    .toUpperCase();
}
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function escapeAttr(s) {
  return escapeHtml(s);
}
function showChat(name, text, at = Date.now(), mine = false) {
  const row = document.createElement("div");
  row.className = "message";
  const av = document.createElement("span");
  av.className = "msg-avatar";
  av.textContent = mine ? "YOU" : initials(name);
  const body = document.createElement("div");
  body.className = "msg-body";
  const meta = document.createElement("div");
  meta.className = "msg-meta";
  const who = document.createElement("b");
  who.textContent = mine ? "You" : name;
  const time = document.createElement("time");
  time.textContent = new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  meta.append(who, time);
  const msg = document.createElement("div");
  msg.className = "msg-text";
  msg.textContent = text;
  body.append(meta, msg);
  row.append(av, body);
  $("#messages").append(row);
  $("#messages").scrollTop = $("#messages").scrollHeight;
}
function updateLatency(value) {
  const label = document.querySelector(".latency");
  if (label)
    label.textContent =
      value == null ? "◉ measuring…" : `◉ ${Math.max(1, Math.round(value))} ms`;
}
async function startRoom(name, instrument, room) {
  if (roomState.joined || roomState.connecting) return;
  roomState.connecting = true;
  roomState.name = name;
  roomState.instrument = instrument;
  roomState.room = room;
  $("#roomNameTop").textContent = room
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  localStorage.setItem("roomtone-name", name);
  localStorage.setItem("roomtone-instrument", instrument);
  try {
    ensureAudio().resume();
  } catch {}
  updateRoomLabels(room);
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  const host = location.protocol === "file:" ? "localhost:8787" : location.host;
  let config;
  try {
    config = await fetch("/config").then((r) => r.json());
    roomState.iceServers = config.iceServers;roomState.iceTransportPolicy=config.iceTransportPolicy||"all";
  } catch {
    roomState.connecting = false;
    notify("Server configuration unavailable");
    return;
  }
  const ws = new WebSocket(`${scheme}//${host}/signal`);
  roomState.socket = ws;
  setRoomStatus("CONNECTING");
  ws.onopen = () =>
    ws.send(
      JSON.stringify({
        type: "join",
        name,
        instrument,
        room,
        password: sessionStorage.getItem("roomtone-access") || "",
        clientId: roomState.clientId,
        roomName: roomState.roomName || room,
      }),
    );
  ws.onmessage = (e) => {
    if(roomState.socket!==ws)return;
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    handleRoomMessage(msg);
  };
  ws.onerror = () => {
    if(roomState.socket!==ws)return;
    setRoomStatus("SERVER ERROR");
    notify(
      "Could not reach Roomtone server. Run npm start and open localhost:8787.",
    );
  };
  ws.onclose = () => {
    if (roomState.socket !== ws) return;
    roomState.connecting = false;
    if (roomState.joined) leaveRoom(false);
    setRoomStatus("DISCONNECTED");
  };
}
function beginJoin() {
  const saved = localStorage.getItem("roomtone-name") || "",
    part = localStorage.getItem("roomtone-instrument") || "Keys",
    q = new URLSearchParams(location.search).get("room") || "sunday-service-02";
  showModal(
    "Join the practice room",
    "Choose your name and main instrument. Your teammates will see these in chat and the mixer.",
    `<label for="joinName">Your name</label><input id="joinName" maxlength="32" placeholder="e.g. Jordan" value="${escapeAttr(saved)}"><label for="joinInstrument">Your instrument</label><select id="joinInstrument">${supportedParts.map((x) => `<option ${x === part ? "selected" : ""}>${x}</option>`).join("")}</select><label for="joinRoom">Room code</label><input id="joinRoom" maxlength="64" value="${escapeAttr(q)}" placeholder="sunday-service-02">`,
    "Join room",
    () => {
      const name = $("#joinName").value.trim() || "Musician",
        instrument = $("#joinInstrument").value,
        room = $("#joinRoom").value.trim() || "sunday-service-02";
      startRoom(name, instrument, room);
    },
  );
}
function handleRoomMessage(msg) {
  if (msg.type === "error") {
    roomState.connecting = false;
    notify(msg.message);
    return;
  }
  if (msg.type === "joined") {
    roomState.connecting = false;
    roomState.id = msg.peerId;
    roomState.joined = true;
    roomState.role=msg.role||"member";roomState.sharedMetro=msg.metro||null;roomState.sharedSetlist=msg.setlist||[];roomState.syncMetrics=msg.syncMetrics||[];window.syncMetronomeRole?.();
    roomState.pendingMetro=msg.metro;roomState.clockSamples=[];roomState.serverOffset=0;
    for(let i=0;i<5;i++)roomMessage({type:"clock",clientAt:Date.now()});
    roomState.clockAnchor=null;if(roomState.clockTimer)clearInterval(roomState.clockTimer);roomState.clockTimer=setInterval(()=>roomMessage({type:"clock",clientAt:Date.now()}),10000);
    for (const meta of msg.streams || [])
      roomState.metadata.set(`${meta.peerId}:${meta.streamId}`, meta);
    const log = JSON.parse(localStorage.getItem("roomtone-sessions") || "[]");
    log.unshift({ room: roomState.room, at: new Date().toISOString() });
    localStorage.setItem("roomtone-sessions", JSON.stringify(log.slice(0, 30)));
    roomState.roster.clear();
    roomState.roster.set(msg.peerId, {
      name: roomState.name,
      instrument: roomState.instrument,
    });
    $("#leaveBtn").textContent = "Leave room";
    $("#messages").replaceChildren();
    for (const chat of msg.history || [])if(chat.type==="chat")showChat(chat.name, chat.text, chat.at, false);
    showChat(
      "Roomtone",
      `You joined ${roomState.room}. Say hello to your band.`,
      Date.now(),
    );
    setRoomStatus("IN ROOM", true);
    renderRoster();
    for (const p of msg.peers || []) {
      roomState.roster.set(p.peerId, p);
      makePeer(p.peerId, p.name, p.instrument);
    }
    renderRoster();
    if ($("#backingAudio").src) publishBacking();
    notify(`Joined ${roomState.room}`);
    return;
  }
  if (msg.type === "presence") {
    return;
  }
  if (msg.type === "peer-joined") {
    roomState.roster.set(msg.peerId, {
      name: msg.name,
      instrument: msg.instrument,
    });
    makePeer(msg.peerId, msg.name, msg.instrument);
    renderRoster();
    showChat("Roomtone", `${msg.name} joined the room.`);
    return;
  }
  if (msg.type === "peer-left") {
    roomState.roster.delete(msg.peerId);
    closePeer(msg.peerId);
    renderRoster();
    showChat("Roomtone", `${msg.name || "A musician"} left the room.`);
    return;
  }
  if (msg.type === "peer-renamed") {
    const p = roomState.roster.get(msg.peerId);
    if (p) p.name = msg.name;
    renderRoster();
    return;
  }
  if (msg.type === "chat") {
    showChat(msg.name, msg.text, msg.at, msg.peerId === roomState.id);
    return;
  }
  if(msg.type==="clock"){
    const now=Date.now(),rtt=now-msg.clientAt;
    if(!Number.isFinite(rtt)||rtt<0||rtt>10000)return;
    const offset=msg.serverAt-(msg.clientAt+rtt/2);
    roomState.clockSamples.push({rtt,offset});roomState.clockSamples=roomState.clockSamples.slice(-12);
    const best=[...roomState.clockSamples].sort((a,b)=>a.rtt-b.rtt).slice(0,5);
    roomState.serverOffset=best.reduce((sum,x)=>sum+x.offset,0)/best.length;
    roomState.clockAnchor??={at:now,offset:roomState.serverOffset};
    const age=now-roomState.clockAnchor.at,ready=age>=30000;
    roomMessage({type:"clock-report",rtt,offset:roomState.serverOffset,driftPpm:ready?(roomState.serverOffset-roomState.clockAnchor.offset)/age*1e6:0,driftReady:ready});
    if(roomState.pendingMetro){window.applySharedMetronome?.(roomState.pendingMetro,roomState.serverOffset);roomState.pendingMetro=null;}
    return;
  }
  if(msg.type==="sync-metrics"){roomState.syncMetrics=msg.metrics||[];const el=$("#metroSyncStatus");if(el){const m=roomState.syncMetrics, maxRtt=Math.max(0,...m.map(x=>x.rtt)),ready=m.filter(x=>x.driftReady),maxDrift=Math.max(0,...ready.map(x=>Math.abs(x.driftPpm)));el.textContent=m.length?`Sync check: ${m.length} musician${m.length===1?"":"s"} · worst server RTT ${Math.round(maxRtt)} ms · ${ready.length?`clock drift estimate up to ${maxDrift.toFixed(1)} ppm`:`clock drift estimate starts after 30 sec`}`:"Waiting for musician clock checks";}return;}
  if(msg.type==="metro-state"){roomState.sharedMetro=msg.metro;if(roomState.clockSamples.length)window.applySharedMetronome?.(msg.metro,roomState.serverOffset);else roomState.pendingMetro=msg.metro;return;}
  if(msg.type==="role"){roomState.role=msg.role||"member";window.syncMetronomeRole?.();notify(`Room role: ${roomState.role}`);return;}
  if(msg.type==="setlist"){roomState.sharedSetlist=msg.items||[];notify("Shared setlist updated");return;}
  if (msg.type === "stream-meta") {
    const key = `${msg.peerId}:${msg.streamId}`;
    roomState.metadata.set(key, msg);
    const live = roomState.incoming.get(key);
    if (live) {
      live.name = msg.label;
      live.kind = msg.kind;
      renderRemote();
    }
    return;
  }
  if (msg.type === "stream-remove") {
    dropIncoming(msg.peerId, msg.streamId);
    return;
  }
  if (msg.type === "signal") {
    const previous = roomState.signalQueue?.get(msg.from) || Promise.resolve();
    roomState.signalQueue ??= new Map();
    roomState.signalQueue.set(
      msg.from,
      previous.then(() => handleSignal(msg.from, msg.signal)),
    );
  }
}
function makePeer(id, name = "Musician", instrument = "Other instrument") {
  if (roomState.pcs.has(id)) return roomState.pcs.get(id);
  const pc = new RTCPeerConnection({ iceServers: roomState.iceServers || [],iceTransportPolicy:roomState.iceTransportPolicy||"all" });
  const item = {
    pc,
    name,
    instrument,
    polite: roomState.id > id,
    ignoreOffer: false,
    makingOffer: false,
    remoteDescription: false,
    pendingIce: [],
  };
  roomState.pcs.set(id, item);
  for (const out of roomState.outgoing.values())
    for (const track of out.stream.getTracks()) pc.addTrack(track, out.stream);
  pc.onicecandidate = (e) => {
    if (e.candidate)
      roomMessage({
        type: "signal",
        to: id,
        signal: { candidate: e.candidate },
      });
  };
  pc.ontrack = (e) => {
    const stream = e.streams[0] || new MediaStream([e.track]);
    attachIncoming(id, stream, name, instrument);
  };
  item.restarts=0;
  pc.oniceconnectionstatechange=()=>{
    if(pc.iceConnectionState==="failed"&&item.restarts<3&&roomState.joined){item.restarts++;pc.restartIce();notify(`Reconnecting audio to ${name}…`);}
    if(pc.iceConnectionState==="connected"||pc.iceConnectionState==="completed")item.restarts=0;
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed")
      notify(
        `Connection to ${name} failed. Check the network or TURN configuration.`,
      );
    if (pc.connectionState === "connected") measurePeer(id);
  };
  pc.onnegotiationneeded = async () => {
    try {
      item.makingOffer = true;
      await pc.setLocalDescription();
      roomMessage({
        type: "signal",
        to: id,
        signal: { description: pc.localDescription },
      });
    } catch (err) {
      console.error("Offer error", err);
    } finally {
      item.makingOffer = false;
    }
  };
  return item;
}
async function handleSignal(id, signal) {
  const p = roomState.roster.get(id) || {
    name: "Musician",
    instrument: "Other instrument",
  };
  const item = makePeer(id, p.name, p.instrument),
    pc = item.pc;
  try {
    if (signal.description) {
      const desc = signal.description,
        collision =
          desc.type === "offer" &&
          (item.makingOffer || pc.signalingState !== "stable");
      item.ignoreOffer = !item.polite && collision;
      if (item.ignoreOffer) return;
      if (collision) await pc.setLocalDescription({ type: "rollback" });
      await pc.setRemoteDescription(desc);
      item.remoteDescription = true;
      for (const c of item.pendingIce.splice(0))
        try {
          await pc.addIceCandidate(c);
        } catch {}
      if (desc.type === "offer") {
        await pc.setLocalDescription();
        roomMessage({
          type: "signal",
          to: id,
          signal: { description: pc.localDescription },
        });
      }
    } else if (signal.candidate) {
      if (!item.remoteDescription) item.pendingIce.push(signal.candidate);
      else
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!item.ignoreOffer) console.warn(err);
        }
    }
  } catch (err) {
    console.warn("Signaling error", err);
  }
}
function closePeer(id) {
  const item = roomState.pcs.get(id);
  if (item) {
    item.pc.close();
    roomState.pcs.delete(id);
  }
  for (const [key, c] of roomState.incoming) {
    if (c.peerId === id) dropIncoming(id, c.streamId);
  }
}
function ensureAudio() {
  if (!roomState.audio)
    roomState.audio = new (window.AudioContext || window.webkitAudioContext)();
  if (roomState.audio.state === "suspended") roomState.audio.resume();
  return roomState.audio;
}
function attachIncoming(peerId, stream, name, instrument) {
  const key = `${peerId}:${stream.id}`;
  if (roomState.incoming.has(key)) return;
  const meta = roomState.metadata.get(key) || {
    label: `${name} · ${instrument}`,
    kind: "instrument",
  };
  const media = document.createElement("audio");
  media.autoplay = true;
  media.muted = true;
  media.srcObject = stream;
  document.body.append(media);
  media.play().catch(() => {});
  const ctx = ensureAudio(),
    source = ctx.createMediaStreamSource(stream),
    gain = ctx.createGain();
  gain.gain.value = roomState.paused ? 0 : 0.72;
  source.connect(gain).connect(ctx.destination);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const entry = {
    key,
    peerId,
    streamId: stream.id,
    stream,
    name: meta.label || `${name} · ${instrument}`,
    kind: meta.kind || "instrument",
    media,
    source,
    gain,
    analyser,
    vol: 72,
    muted: false,
  };
  roomState.incoming.set(key, entry);
  renderRemote();
}
function dropIncoming(peerId, streamId) {
  const key = `${peerId}:${streamId}`,
    e = roomState.incoming.get(key);
  if (!e) return;
  try {
    e.source.disconnect();
    e.gain.disconnect();
    e.media?.pause();
    e.media?.remove();
  } catch {}
  roomState.incoming.delete(key);
  renderRemote();
}
function renderRemote() {
  let box = $("#remoteLanes");
  if (!box) {
    box = document.createElement("div");
    box.id = "remoteLanes";
    $("#channels").after(box);
  }
  box.replaceChildren();
  for (const e of roomState.incoming.values()) {
    const row = document.createElement("div");
    row.className = "channel";
    row.innerHTML = `<div class="instrument"><span class="instrument-icon" style="color:var(--teal)">♫</span><div style="min-width:0"><div class="instrument-name"></div><div class="instrument-type">LIVE · ${escapeHtml(e.kind)}</div></div><span class="channel-status connected">LIVE</span></div><div class="meter" style="--meter:var(--teal)">${Array.from({ length: 13 }, (_, i) => `<i class="${i < Math.round(e.vol / 8) ? "on" : ""}"></i>`).join("")}</div><div class="vol-cell"><input aria-label="${escapeAttr(e.name)} volume" type="range" min="0" max="100" value="${e.vol}" style="--fill:${e.vol}%"><span class="db">${Math.round(e.vol)}%</span></div><button class="mute ${e.muted ? "is-muted" : ""}" title="Mute ${escapeAttr(e.name)}">${e.muted ? "ON" : "M"}</button><button class="remove" title="Remove stream">×</button>`;
    row.querySelector(".instrument-name").textContent = e.name;
    const slider = row.querySelector("input");
    slider.oninput = () => {
      e.vol = +slider.value;
      e.gain.gain.setTargetAtTime(
        roomState.paused || e.muted ? 0 : e.vol / 100,
        ensureAudio().currentTime,
        0.02,
      );
      slider.style.setProperty("--fill", `${e.vol}%`);
      row.querySelector(".db").textContent = `${e.vol}%`;
      row
        .querySelectorAll(".meter i")
        .forEach((i, n) => i.classList.toggle("on", n < Math.round(e.vol / 8)));
    };
    row.querySelector(".mute").onclick = () => {
      e.muted = !e.muted;
      e.gain.gain.setTargetAtTime(
        roomState.paused || e.muted ? 0 : e.vol / 100,
        ensureAudio().currentTime,
        0.02,
      );
      renderRemote();
    };
    row.querySelector(".remove").onclick = () => {
      e.muted = !e.muted;
      e.gain.gain.value = e.muted || roomState.paused ? 0 : e.vol / 100;
      renderRemote();
    };
    box.append(row);
  }
}
async function publishStream(stream, label, kind) {
  const id = stream.id;
  if (roomState.outgoing.has(id)) return;
  roomState.outgoing.set(id, { stream, label, kind });
  roomMessage({ type: "stream-meta", streamId: id, label, kind });
  for (const [peerId, item] of roomState.pcs)
    for (const track of stream.getTracks()) item.pc.addTrack(track, stream);
}
function unpublishStream(stream) {
  if (!stream) return;
  const id = stream.id;
  roomState.outgoing.delete(id);
  roomMessage({ type: "stream-remove", streamId: id });
  for (const item of roomState.pcs.values())
    for (const sender of item.pc.getSenders())
      if (stream.getTracks().includes(sender.track))
        item.pc.removeTrack(sender);
  stream.getTracks().forEach((t) => t.stop());
  for (const lane of tracks)
    if (lane.stream === stream) {
      lane.midiInput &&
        ((lane.midiInput.onmidimessage = null),
        roomState.midiInputs.delete(lane.midiInput));
      const synthData = roomState.synths.get(lane);
      if(synthData?.output)for(let channel=0;channel<16;channel++)try{ synthData.output.send([0xb0+channel,64,0]);synthData.output.send([0xb0+channel,123,0]); }catch{}
      if (synthData)
        for (const voice of synthData.voices.values())
          try {
            voice.osc.stop();
          } catch {}
      roomState.synths.delete(lane);
      lane.inputStream?.getTracks().forEach((t) => t.stop());
      try {
        lane.sourceNode?.disconnect();
        lane.gainNode?.disconnect();
      } catch {}
      if (roomState.mdTrack === lane) {
        roomState.mdTrack = null;
        roomState.mdHeld = false;
      }
      if (roomState.vocalOut === stream) roomState.vocalOut = null;
      lane.stream = null;
      lane.inputStream = null;
      lane.sourceNode = null;
      lane.gainNode = null;
      lane.status = "READY";
      lane.type =
        lane.name === "MD mic"
          ? "Director cue channel · Push to talk"
          : `${lane.name.toLowerCase().includes("vocal") ? "Audio lane" : "MIDI lane"} · connect to play`;
    }
}
function meterAudio() {
  const ctx = ensureAudio();
  const destination = ctx.createMediaStreamDestination(),
    master = ctx.createGain();
  master.gain.value = 0.72;
  master.connect(destination);
  return { ctx, destination, master, stream: destination.stream };
}
async function wireAudioInput(input, lane, initialGain = lane.vol / 100) {
  if(!roomState.joined||!tracks.includes(lane)){input.getTracks().forEach(t=>t.stop());throw Error("Channel was removed or room closed");}
  if (lane.stream) unpublishStream(lane.stream);
  const ctx = ensureAudio(),
    source = ctx.createMediaStreamSource(input),
    gain = ctx.createGain(),
    destination = ctx.createMediaStreamDestination();
  gain.gain.value = initialGain;
  source.connect(gain).connect(destination);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  lane.analyser = analyser;
  lane.inputStream = input;
  for(const track of input.getAudioTracks())track.addEventListener("ended",()=>{
    if(lane.inputStream!==input)return;
    unpublishStream(lane.stream);renderTracks();notify(`${lane.name} input disconnected. Reconnect the device and channel.`);
  },{once:true});
  lane.sourceNode = source;
  lane.gainNode = gain;
  lane.stream = destination.stream;
  lane.status = "CONNECTED";
  lane.type = `Audio · ${input.getAudioTracks()[0]?.label || "Audio input"}`;
  await publishStream(
    lane.stream,
    `${roomState.name} · ${lane.name}`,
    lane.name,
  );
  renderTracks();
}
async function micToggle(kind) {
  if (!roomState.joined) {
    notify("Join a room first");
    return;
  }
  if (kind === "vocal" && roomState.vocalOut) {
    unpublishStream(roomState.vocalOut);
    roomState.vocalOut = null;
    micStreams.vocal = null;
    $("#vocalMic").classList.remove("active");
    $("#vocalStatus").textContent = "● OFF";
    $("#vocalDevice").textContent = "No mic connected · Use audio input";
    renderTracks();
    notify("Vocalist mic disconnected");
    return;
  }
  if (kind === "md" && roomState.mdTrack) return;
  try {
    ensureAudio();
    const input = await openAudioInput();
    micStreams[kind] = input;
    const label = input.getAudioTracks()[0]?.label || "Microphone";
    let lane;
    if (kind === "vocal") {
      lane = tracks.find((t) => t.name === "Lead vocals");
      if (!lane) {
        lane = {
          name: "Lead vocals",
          type: "Audio lane",
          icon: "♙",
          status: "READY",
          color: "#ec91b9",
          vol: 70,
        };
        tracks.push(lane);
      }
      await wireAudioInput(input, lane, lane.vol / 100);
      roomState.vocalOut = lane.stream;
      $("#vocalMic").classList.add("active");
      $("#vocalStatus").textContent = "● LIVE";
      $("#vocalStatus").style.color = "var(--lime)";
      $("#vocalDevice").textContent = label + " · broadcasting";
      notify("Vocal mic is live in the room");
    } else {
      lane = {
        name: "MD mic",
        type: "Director cue channel · Push to talk",
        icon: "🎙",
        status: "READY",
        color: "#ffb86c",
        vol: 65,
      };
      tracks.push(lane);
      await wireAudioInput(input, lane, 0);
      roomState.mdTrack = lane;
      roomState.mdHeld = false;
      applyLaneGain(lane);
      $("#mdStatus").textContent = "● READY";
      $("#mdStatus").style.color = "var(--orange)";
      $("#mdDevice").textContent = label + " · hold to talk";
      notify("MD mic ready");
    }
  } catch (err) {
    notify(
      err.name === "NotAllowedError"
        ? "Allow microphone access to use this input"
        : "Could not open microphone: " + err.message,
    );
  }
}
async function connectLaneMic(lane) {
  if (!roomState.joined) {
    notify("Join the room before connecting audio");
    return;
  }
  try {
    let device="";const permission=await navigator.mediaDevices.getUserMedia({audio:true});permission.getTracks().forEach(t=>t.stop());const devices=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==="audioinput");
    if(devices.length>1){const selected=await new Promise(resolve=>{showModal("Choose channel input",`Select the microphone, interface input, or DAW loopback for ${escapeHtml(lane.name)}.`, `<label for="laneAudioInput">Audio input</label><select id="laneAudioInput"><option value="">System default</option>${devices.map(d=>`<option value="${escapeAttr(d.deviceId)}">${escapeHtml(d.label||"Interface or loopback input")}</option>`).join("")}</select>`,"Connect",()=>resolve($("#laneAudioInput").value));modalCancel=()=>resolve(null);});if(selected===null)return;device=selected;}
    if(!roomState.joined||!tracks.includes(lane))return;
    const input = await openAudioInput(device);
    await wireAudioInput(input, lane, lane.vol / 100);
    notify(`${lane.name} is live in the room`);
  } catch (err) {
    notify(
      err.name === "NotAllowedError"
        ? "Allow microphone access to use this input"
        : err.message,
    );
  }
}
function addInstrument() {
  if (!roomState.joined) {
    notify("Join a room first");
    return;
  }
  const opts = supportedParts;
  showModal(
    "Add to your mix",
    "Create a dedicated room channel for another live instrument or vocalist.",
    `<label for="newTrack">Instrument or part</label><select id="newTrack">${opts.map((x) => `<option>${x}</option>`).join("")}</select><label for="trackSource">Input type</label><select id="trackSource"><option value="midi">MIDI controller / built-in synth</option><option value="audio">Microphone, interface, or DAW/VST output</option></select><p>For Kontakt, Logic, FL Studio, or another plugin host, send the DAW master output to an interface input or system loopback device, then select that input for this lane.</p>`,
    "Add channel",
    () => {
      const name = $("#newTrack").value,
        source = $("#trackSource").value,
        lane = {
          name,
          type:
            source === "midi"
              ? "MIDI lane · connect controller"
              : "Audio lane · mic / interface / DAW",
          icon: name.toLowerCase().includes("vocal") ? "♙" : "♫",
          status: "READY",
          color: ["#c4f66b", "#71dcc4", "#b5a0ff", "#ffb86c"][
            tracks.length % 4
          ],
          vol: 60,
          pan: "C",
        };
      tracks.push(lane);
      renderTracks();
      if (source === "audio") connectLaneMic(lane);
      else notify(`${name} lane added. Connect MIDI to send its audio.`);
    },
  );
}
$("#addInstrument").onclick = addInstrument;
$("#addInstrumentTop").onclick = addInstrument;
function mdDown() {
  if (roomState.mdTrack && !roomState.mdTrack.gainNode)
    roomState.mdTrack = null;
  if (!roomState.joined) {
    notify("Join a room first");
    return;
  }
  if (!roomState.mdTrack) {
    micToggle("md");
    return;
  }
  roomState.mdHeld = true;
  applyLaneGain(roomState.mdTrack);
  $("#mdStatus").textContent = "● TRANSMITTING";
  $("#mdMic").classList.add("active");
}
function mdUp() {
  if (!roomState.mdTrack) return;
  roomState.mdHeld = false;
  applyLaneGain(roomState.mdTrack);
  $("#mdStatus").textContent = "● READY";
  $("#mdMic").classList.remove("active");
}
async function connectMidiLive() {
  if (!roomState.joined) {
    notify("Join a room first");
    return;
  }
  if (!navigator.requestMIDIAccess) {
    notify("MIDI input requires Chrome or Edge on desktop");
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess(),
      inputs = [...access.inputs.values()],outputs=[...access.outputs.values()];
    if(!roomState.joined)return;
    access.onstatechange=event=>{
      if(event.port.state!=="disconnected")return;
      for(const lane of tracks){const synth=roomState.synths.get(lane);if(lane.midiInput===event.port||synth?.output===event.port){unpublishStream(lane.stream);notify(lane.name+' MIDI device disconnected');}}
      renderTracks();
    };
    if (!inputs.length) {
      notify("No MIDI controller found. Connect one and try again.");
      return;
    }
    const body = `<label for="liveMidiInput">MIDI controller</label><select id="liveMidiInput">${inputs.map((x, i) => `<option value="${i}">${escapeHtml(x.name || "MIDI controller")}</option>`).join("")}</select><label for="liveMidiLane">Instrument lane</label><select id="liveMidiLane">${tracks.map((x, i) => `<option value="${i}">${escapeHtml(x.name)}</option>`).join("")}</select><label for="liveMidiOutput">Sound route</label><select id="liveMidiOutput"><option value="">Built-in synth streamed to room</option>${outputs.map((x,i)=>`<option value="${i}">External synth: ${escapeHtml(x.name||"MIDI output")}</option>`).join("")}</select><p>To stream external synth sound, connect its audio output to an audio-interface input and add that input as an audio lane.</p>`;
    showModal(
      "Connect MIDI",
      "Route MIDI to the built-in synth or a connected external MIDI output.",
      body,
      "Connect",
      async () => {
        const idx = +$("*#liveMidiInput").value,
          laneIndex = +$("*#liveMidiLane").value,
          input = inputs[idx],
          outputIndex=$("*#liveMidiOutput").value,
          output=outputIndex===""?null:outputs[+outputIndex],
          lane = tracks[laneIndex];
        try {
          if(!roomState.joined||!tracks.includes(lane))throw Error("Join the room and choose an existing channel first");
          if (lane.stream) unpublishStream(lane.stream);
          for (const oldLane of tracks)
            if (
              oldLane !== lane &&
              oldLane.midiInput === input &&
              oldLane.stream
            )
              unpublishStream(oldLane.stream);
          const m = meterAudio(),
            synth = m.ctx.createGain();
          synth.gain.value = output?0:lane.vol / 100;
          synth.connect(m.destination);
          synth.connect(m.ctx.destination);
          const analyser = m.ctx.createAnalyser();
          analyser.fftSize = 256;
          synth.connect(analyser);
          lane.analyser = analyser;
          lane.gainNode = synth;
          lane.stream = m.stream;
          const data = {
            ...m,
            synth,
            lane,
            voices: new Map(),output,
            stream: m.stream,
          };
          roomState.synths.set(lane, data);
          await publishStream(
            data.stream,
            `${roomState.name} · ${lane.name}`,
            lane.name,
          );
          lane.midiInput = input;
          roomState.midiInputs.add(input);
          input.onmidimessage = (e) => {if(data.output&&e.data[0]!==0xf0){try{data.output.send([...e.data]);}catch{}}if(!data.output)playMidi(e,data);};
          lane.status = "CONNECTED";
          lane.type = `MIDI · ${input.name || "Controller"}${output?` → ${output.name||"External synth"}`:" · built-in synth"}`;
          renderTracks();
          notify(
            `${input.name || "MIDI controller"} connected to ${lane.name}`,
          );
        } catch (err) {
          notify("Could not start MIDI audio: " + err.message);
        }
      },
    );
  } catch (e) {
    notify("MIDI permission was not granted");
  }
}
function playMidi(e, data) {
  const [status, note, velocity] = e.data,
    cmd = status & 0xf0,
    key = `${status & 0x0f}:${note}`,
    ctx = data.ctx,
    part = data.lane.name.toLowerCase();
  if (cmd === 0x90 && velocity > 0) {
    if (data.voices.has(key)) return;
    const level = Math.max(0.02, (velocity / 127) * 0.24),
      now = ctx.currentTime;
    if (part.includes("drum") || part.includes("percussion")) {
      const env = ctx.createGain();
      env.gain.setValueAtTime(level, now);
      env.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (note === 36 ? 0.32 : note === 42 ? 0.065 : 0.16),
      );
      env.connect(data.synth);
      if (note === 35 || note === 36) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
        osc.connect(env);
        osc.start(now);
        osc.stop(now + 0.36);
        data.voices.set(key, { osc, env, drum: true });
      } else {
        const length = Math.ceil(ctx.sampleRate * (note === 42 ? 0.08 : 0.2)),
          buffer = ctx.createBuffer(1, length, ctx.sampleRate),
          samples = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.connect(env);
        noise.start(now);
        data.voices.set(key, { osc: noise, env, drum: true });
      }
      setTimeout(() => data.voices.delete(key), 500);
    } else {
      const osc = ctx.createOscillator(),
        env = ctx.createGain(),
        frequency = 440 * Math.pow(2, (note - 69) / 12);
      osc.type = part.includes("bass")
        ? "sawtooth"
        : part.includes("guitar")
          ? "triangle"
          : part.includes("organ")
            ? "square"
            : part.includes("string") ||
                part.includes("violin") ||
                part.includes("cello")
              ? "sawtooth"
              : part.includes("trumpet") || part.includes("sax")
                ? "square"
                : "triangle";
      osc.frequency.value = frequency;
      if (
        part.includes("strings") ||
        part.includes("violin") ||
        part.includes("cello")
      )
        osc.detune.value = -4;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(
        level,
        now + (part.includes("strings") ? 0.08 : 0.01),
      );
      osc.connect(env).connect(data.synth);
      osc.start(now);
      data.voices.set(key, { osc, env });
    }
    const row =
      $$("#channels .channel")[data.lane ? tracks.indexOf(data.lane) : 0];
    row
      ?.querySelectorAll(".meter i")
      .forEach((el, i) =>
        el.classList.toggle("on", i < Math.max(3, Math.round(velocity / 10))),
      );
  } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
    const v = data.voices.get(key);
    if (v && !v.drum) {
      v.env.gain.cancelScheduledValues(ctx.currentTime);
      v.env.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.045);
      v.osc.stop(ctx.currentTime + 0.22);
      data.voices.delete(key);
    }
  }
}
function measurePeer(id) {
  const item = roomState.pcs.get(id);
  if (!item) return;
  const stat = item.pc.getStats();
  stat.then((reports) => {
    for (const r of reports.values())
      if (
        r.type === "candidate-pair" &&
        r.state === "succeeded" &&
        r.currentRoundTripTime
      ) {
        updateLatency(r.currentRoundTripTime * 1000);
        return;
      }
  });
}
function leaveRoom(closeSocket = true) {
  window.applySharedMetronome?.({running:false});
  roomState.joined = false;
  if(roomState.clockTimer)clearInterval(roomState.clockTimer);roomState.clockTimer=null;
  roomState.syncMetrics=[];roomState.clockSamples=[];roomState.clockAnchor=null;roomState.sharedMetro=null;roomState.pendingMetro=null;const syncLabel=$("#metroSyncStatus");if(syncLabel)syncLabel.textContent="Join musicians on separate networks to compare clock timing";
  roomState.id = null;
  for (const id of [...roomState.pcs.keys()]) closePeer(id);
  roomState.roster.clear();
  renderRoster();
  if (closeSocket && roomState.socket) {
    const s = roomState.socket;
    roomState.socket = null;
    s.close();
  }
  for (const out of [...roomState.outgoing.values()])
    unpublishStream(out.stream);
  for (const k of ["vocal", "md"]) {
    if (micStreams[k]) {
      micStreams[k].getTracks().forEach((t) => t.stop());
      micStreams[k] = null;
    }
  }
  roomState.mdHeld = false;
  roomState.vocalOut = null;
  roomState.backingStream = null;
  if (backingGain && roomState.backingDest) {
    try { backingGain.disconnect(roomState.backingDest); } catch {}
    roomState.backingDest = null;
  }
  roomState.paused = false;
  roomState.mdTrack = null;
  roomState.mdActive = false;
  roomState.synths.clear();
  renderTracks();
  renderRemote();
  $("#leaveBtn").textContent = "Join room";
  $("#vocalStatus").textContent = "● OFF";
  $("#vocalMic").classList.remove("active");
  $("#mdStatus").textContent = "● READY";
  $("#mdMic").classList.remove("active");
  $("#vocalDevice").textContent = "No mic connected · Use audio input";
  $("#mdDevice").textContent = "Director cue channel · Push to talk";
  $("#messages").replaceChildren();
  setRoomStatus("NOT CONNECTED");
  notify("You left the practice room");
}
const backingAudio = $("#backingAudio");
let backingSource = null,
  backingGain = null,
  backingUrl = null;
function publishBacking() {
  if (!roomState.joined || !backingAudio.src) return;
  const ctx = ensureAudio();
  if (!backingSource) {
    backingSource = ctx.createMediaElementSource(backingAudio);
    backingGain = ctx.createGain();
    backingGain.gain.value = 0.8;
    backingSource.connect(backingGain);
    backingGain.connect(ctx.destination);
  }
  if (roomState.backingStream) {
    try {
      backingGain.disconnect(roomState.backingDest);
    } catch {}
    unpublishStream(roomState.backingStream);
  }
  const dest = ctx.createMediaStreamDestination();
  roomState.backingDest = dest;
  roomState.backingStream = dest.stream;
  backingGain.connect(dest);
  publishStream(
    dest.stream,
    `Backing track · ${$("#backingName").textContent}`,
    "Backing track",
  );
}
$("#loadTrackBtn").onclick = () => $("#backingFile").click();
$("#backingFile").onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (backingUrl) URL.revokeObjectURL(backingUrl);
  if (roomState.backingStream) {
    try {
      backingGain?.disconnect(roomState.backingDest);
    } catch {}
    unpublishStream(roomState.backingStream);
    roomState.backingStream = null;
  }
  backingUrl = URL.createObjectURL(file);
  backingAudio.src = backingUrl;
  $("#backingName").textContent = file.name;
  $("#backingDetails").textContent =
    `${(file.size / 1048576).toFixed(1)} MB · streamed to room members when you press play`;
  ensureAudio();
  if (roomState.joined) publishBacking();
  notify("Backing track loaded");
};
$("#playTrack").onclick = async () => {
  if (!backingAudio.src) {
    notify("Load an audio file first");
    $("#backingFile").click();
    return;
  }
  try {
    ensureAudio();
    if (roomState.audio?.state === "suspended") await roomState.audio.resume();
    if (backingAudio.paused) {
      if (roomState.joined && !roomState.backingStream) publishBacking();
      await backingAudio.play();
      $("#playTrack").textContent = "Ⅱ";
      notify("Backing track playing in the room");
    } else {
      backingAudio.pause();
      $("#playTrack").textContent = "▶";
    }
  } catch (err) {
    notify("Could not play this audio file: " + err.message);
  }
};
function updateBackingProgress() {
  if (!Number.isFinite(backingAudio.duration)) return;
  const cur = backingAudio.currentTime || 0,
    dur = backingAudio.duration || 0,
    fmt = (v) =>
      `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;
  $("#trackTime").innerHTML =
    `${fmt(cur)} <span style="color:#666d62">/ ${fmt(dur)}</span>`;
  $("#trackProgress").style.setProperty(
    "--progress",
    `${dur ? (100 * cur) / dur : 0}%`,
  );
  if (backingAudio.ended) $("#playTrack").textContent = "▶";
}
backingAudio.addEventListener("timeupdate", updateBackingProgress);
backingAudio.addEventListener("loadedmetadata", updateBackingProgress);
backingAudio.addEventListener("ended", () => {
  $("#playTrack").textContent = "▶";
  updateBackingProgress();
});
$("#leaveBtn").onclick = () =>
  roomState.joined
    ? showModal(
        "Leave this practice room?",
        "Your live audio and room chat will disconnect.",
        '<div class="device-item"><span>Live WebRTC room</span><small>Leave now</small></div>',
        "Leave room",
        () => leaveRoom(),
      )
    : beginJoin();
$("#vocalMic").onclick = () => micToggle("vocal");
const mdOld = $("#mdMic"),
  mdFresh = mdOld.cloneNode(true);
mdOld.replaceWith(mdFresh);
mdFresh.addEventListener("pointerdown", mdDown);
mdFresh.addEventListener("pointerup", mdUp);
mdFresh.addEventListener("pointerleave", mdUp);
mdFresh.addEventListener("pointercancel", mdUp);
mdFresh.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
    e.preventDefault();
    mdDown();
  }
});
mdFresh.addEventListener("keyup", (e) => {
  if (e.key === " " || e.key === "Enter") mdUp();
});
$("#midiTop").onclick = connectMidiLive;
$("#streamBtn").onclick = () => {
  roomState.paused = !roomState.paused;
  $("#streamPreview").classList.toggle("paused", roomState.paused);
  $("#streamBtn").textContent = roomState.paused
    ? "Resume room audio"
    : "Pause room audio";
  for (const e of roomState.incoming.values())
    e.gain.gain.setTargetAtTime(
      roomState.paused || e.muted ? 0 : e.vol / 100,
      ensureAudio().currentTime,
      0.02,
    );
  notify(roomState.paused ? "Room audio paused" : "Room audio resumed");
};
$("#inviteBtn").onclick = async () => {
  const url = new URL(location.href);
  url.searchParams.set("room", roomState.room);
  try {
    await navigator.clipboard.writeText(url.href);
    notify("Invite link copied");
  } catch {
    showModal(
      "Invite your band",
      "Share this link with musicians who can reach this Roomtone server.",
      '<label>Room invite link</label><input readonly id="inviteLink">',
      "Close",
    );
    $("#inviteLink").value = url.href;
  }
};
const chatOld = $("#chatForm"),
  chatFresh = chatOld.cloneNode(true);
chatOld.replaceWith(chatFresh);
chatFresh.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chatInput"),
    text = input.value.trim();
  if (!text) return;
  if (!roomState.joined) {
    notify("Join the room before sending messages");
    return;
  }
  roomMessage({ type: "chat", text });
  input.value = "";
});
$("#streamBtn").textContent = "Room audio";
$("#streamBtn").disabled = true;
$("#messages").replaceChildren();
setRoomStatus("NOT CONNECTED");
renderRemote();

function applyLaneGain(lane) {
  if (!lane?.gainNode) return;
  const cue = lane.name === "MD mic";
  lane.gainNode.gain.setTargetAtTime(
    lane.muted || (cue && !roomState.mdHeld) ? 0 : lane.vol / 100,
    ensureAudio().currentTime,
    0.015,
  );
}
function renderTracks() {
  const root = $("#channels");
  root.replaceChildren();
  tracks.forEach((lane) => {
    const row = document.createElement("div");
    row.className = "channel";
    row.innerHTML = `<div class="instrument"><span class="instrument-icon">${lane.icon}</span><div><div class="instrument-name"></div><div class="instrument-type"></div></div></div><div class="meter">${"<i></i>".repeat(13)}</div><div class="vol-cell"><input type="range" min="0" max="100"><span class="db"></span></div><button class="mute">M</button><button class="remove">×</button>`;
    row.querySelector(".instrument-name").textContent = lane.name;
    row.querySelector(".instrument-type").textContent = lane.type;
    row.querySelector(".instrument-icon").style.color = lane.color;
    const range = row.querySelector("input");
    range.value = lane.vol;
    range.setAttribute("aria-label", `${lane.name} send volume`);
    const update = () => {
      range.style.setProperty("--fill", lane.vol + "%");
      row.querySelector(".db").textContent = lane.vol + "%";
      applyLaneGain(lane);
    };
    range.oninput = () => {
      lane.vol = +range.value;
      update();
    };
    const mute = row.querySelector(".mute");
    mute.setAttribute("aria-label", `Mute ${lane.name}`);
    mute.classList.toggle("is-muted", !!lane.muted);
    mute.onclick = () => {
      lane.muted = !lane.muted;
      applyLaneGain(lane);
      renderTracks();
    };
    row.querySelector(".remove").onclick = () => {
      if (lane.stream) unpublishStream(lane.stream);
      tracks.splice(tracks.indexOf(lane), 1);
      renderTracks();
    };
    row.querySelector(".instrument").title = "Click to connect an audio input";
    row.querySelector(".instrument").style.cursor = "pointer";
    row.querySelector(".instrument").onclick = () => {
      if (lane.name === "MD mic") micToggle("md");
      else connectLaneMic(lane);
    };
    root.append(row);
    update();
  });
}
async function openAudioInput(deviceIdOverride) {
  if (!navigator.mediaDevices?.getUserMedia)
    throw Error("Open this app on localhost or HTTPS to use audio inputs");
  const deviceId = deviceIdOverride || localStorage.getItem("roomtone-device");
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
}
async function devicesPanel() {
  try {
    const temporary = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    temporary.getTracks().forEach((t) => t.stop());
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (x) => x.kind === "audioinput",
    );
    showModal(
      "Audio devices",
      "Choose the microphone or audio interface for new channels. Reconnect existing channels to change their device.",
      `<label for="audioDevice">Input device</label><select id="audioDevice"><option value="">System default</option>${devices.map((d) => `<option value="${escapeAttr(d.deviceId)}">${escapeHtml(d.label || "Audio input")}</option>`).join("")}</select>`,
      "Save",
      () => {
        localStorage.setItem("roomtone-device", $("#audioDevice").value);
        notify("Input device saved");
      },
    );
    $("#audioDevice").value = localStorage.getItem("roomtone-device") || "";
  } catch (e) {
    notify(e.message);
  }
}
function updateRoomLabels(room) {
  const title = room.replace(/[-_]/g, " ");
  $(".pagehead h1").textContent = title;
  $(".room-card h3").textContent = title;
  $(".room-card .tiny").textContent = "Rehearsal room";
  $(".room-card p").textContent = "Room code: " + room;
}
async function setlistsPanel() {
  const room=roomState.joined?roomState.room:null;
  let items=JSON.parse(localStorage.getItem("roomtone-setlist")||"[]"),revision=0;
  if(room)try{const data=await api(`/api/rooms/${encodeURIComponent(room)}`);items=data.setlist;revision=data.setlistRevision||0;}catch(e){notify(e.message);return;}
  showModal(room?"Shared setlist":"Setlist draft",room?"One song or note per line. Saves are shared with the room.":"Join a room to share this draft.",'<label for="setlistText">Songs and notes</label><textarea id="setlistText" rows="9" style="width:100%"></textarea><p id="setlistError" role="alert"></p>',"Save setlist");
  $("#setlistText").value=items.join("\n");
  $("#confirmModal").onclick=async()=>{
    const button=$("#confirmModal"),error=$("#setlistError"),lines=$("#setlistText").value.split("\n").map(x=>x.trim()).filter(Boolean);
    button.disabled=true;
    try{localStorage.setItem("roomtone-setlist",JSON.stringify(lines));if(room)await api(`/api/rooms/${encodeURIComponent(room)}/setlist`,"PUT",{items:lines,revision});closeModal();notify(room?"Shared setlist saved":"Draft saved");}
    catch(e){error.textContent=e.message;button.disabled=false;}
  };
}
async function sessionsPanel() {
  const sessions = JSON.parse(
    localStorage.getItem("roomtone-sessions") || "[]",
  );
  showModal(
    "Recent sessions",
    "Session history is shared with members of this room.",
    sessions.length
      ? '<div class="device-list">' +
          sessions
            .map(
              (s) =>
                `<div class="device-item"><span>${escapeHtml(s.room)}</span><small>${escapeHtml(new Date(s.at).toLocaleString())}</small></div>`,
            )
            .join("")
      : "<p>No sessions joined yet.</p>",
    "Close",
  );
  if(roomState.joined)try{const data=await api(`/api/rooms/${encodeURIComponent(roomState.room)}`),sessions=(data.history||[]).filter(x=>x.type==="session").reverse(),panel=$("#modal");panel.insertAdjacentHTML("afterbegin",sessions.length?'<div class="device-list">'+sessions.map(s=>`<div class="device-item"><span>${escapeHtml(s.name)} ${s.action==="joined"?"joined":"left"}</span><small>${escapeHtml(new Date(s.at).toLocaleString())}</small></div>`).join("")+'</div>':'<p>No shared sessions yet.</p>')}catch(e){notify(e.message)}
}
async function roomsPanel(){
  if(roomState.joined||roomState.connecting){notify("Leave the current room before opening another room");return;}
  let rooms=[];try{rooms=(await api("/api/rooms")).rooms}catch(e){notify(e.message);return}
  showModal("Your rooms","Open rooms you have joined or create one. Anyone with the room code can join.",'<div class="device-list">'+rooms.map(r=>`<button class="btn room-open" data-room="${escapeAttr(r.id)}">${escapeHtml(r.name)} · ${escapeHtml(r.role)}</button>`).join("")+'</div><label for="newRoomName">New room name</label><input id="newRoomName" maxlength="80" placeholder="Band practice">',"Create room",async()=>{});
  for(const b of $$(".room-open"))b.onclick=()=>{const room=b.dataset.room,u=new URL(location.href);u.searchParams.set("room",room);history.replaceState({},"",u);roomState.room=room;closeModal();beginJoin();};
  $("#confirmModal").onclick=async()=>{try{const data=await api("/api/rooms","POST",{name:$("#newRoomName").value,clientId:roomState.clientId,ownerName:localStorage.getItem("roomtone-name")||"Musician"}),u=new URL(location.href);u.searchParams.set("room",data.room.id);history.replaceState({},"",u);roomState.room=data.room.id;roomState.roomName=data.room.name;closeModal();beginJoin()}catch(e){notify(e.message)}};
}
async function manageMembers(){
  if(!roomState.joined){notify("Join a room first");return}let members=[];try{members=(await api(`/api/rooms/${encodeURIComponent(roomState.room)}`)).members}catch(e){notify(e.message);return}
  const controls=roomState.role==="owner"?members.filter(m=>m.role!=="owner").map(m=>`<button class="btn role-toggle" data-client="${escapeAttr(m.clientId)}" data-role="${m.role==="md"?"member":"md"}">${escapeHtml(m.name)} · ${escapeHtml(m.role)} · ${m.role==="md"?"remove MD":"make MD"}</button>`).join(""):'<p>Only the room owner can assign the MD role.</p>';
  showModal("Room musicians","Join by entering the room code and a display name. The owner can assign an MD role to another device.",`<div class="device-list">${members.map(m=>`<div class="device-item"><span>${escapeHtml(m.name)}</span><small>${escapeHtml(m.role)}${m.online?" · online":""}</small></div>`).join("")}</div>${controls}`,"Done");
  for(const b of $$(".role-toggle"))b.onclick=async()=>{try{await api(`/api/rooms/${encodeURIComponent(roomState.room)}/role`,"POST",{clientId:b.dataset.client,role:b.dataset.role});closeModal();manageMembers()}catch(e){notify(e.message)}};
}
function displayNamePanel(){showModal("Display name","Choose the name musicians will see when you join.",`<label for="displayName">Your name</label><input id="displayName" maxlength="32" value="${escapeAttr(localStorage.getItem("roomtone-name")||"")}" placeholder="e.g. Jordan">`,"Save",()=>{localStorage.setItem("roomtone-name",$("#displayName").value.trim());notify("Name saved");});}
function settingsPanel() {
  showModal(
    "Room access",
    "If the server owner configured an access password, enter it here before joining. Use headphones when adding microphones.",
    '<label for="accessPassword">Server access password</label><input type="password" id="accessPassword" autocomplete="off">',
    "Save",
    () => {
      sessionStorage.setItem("roomtone-access", $("#accessPassword").value);
      notify("Access setting saved");
    },
  );
  $("#accessPassword").value = sessionStorage.getItem("roomtone-access") || "";
}
for (const nav of $$(".nav-item")) {
  nav.tabIndex = 0;
  const action = () => {
    const text = nav.textContent;
    if (text.includes("Devices")) devicesPanel();
    else if (text.includes("Setlists")) setlistsPanel();
    else if (text.includes("Sessions")) sessionsPanel();
    else if (text.includes("Settings")) settingsPanel();
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };
  nav.onclick = action;
  nav.onkeydown = (e) => {
    if (e.key === "Enter") action();
  };
}
$$(".view-switch button").forEach(
  (button, index) =>
    (button.onclick = () => {
      $$(".view-switch button").forEach((b) =>
        b.classList.toggle("selected", b === button),
      );
      $("#remoteLanes").hidden = index === 1;
    }),
);
$("#trackProgress").title = "Click to seek";
$("#trackProgress").style.cursor = "pointer";
$("#trackProgress").onclick = (e) => {
  if (!Number.isFinite(backingAudio.duration)) return;
  const rect = e.currentTarget.getBoundingClientRect();
  backingAudio.currentTime =
    Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) *
    backingAudio.duration;
  updateBackingProgress();
};
window.addEventListener("blur", mdUp);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) mdUp();
});
window.addEventListener("pointerup", mdUp);
window.addEventListener("beforeunload", () => {
  mdUp();
  roomState.socket?.close();
});
const originalUnpublish = unpublishStream;
unpublishStream = function (stream) {
  originalUnpublish(stream);
  if (!roomState.mdTrack) {
    $("#mdStatus").textContent = "● READY";
    $("#mdMic").classList.remove("active");
  }
  if (!roomState.vocalOut) {
    $("#vocalStatus").textContent = "● OFF";
    $("#vocalMic").classList.remove("active");
  }
};
setInterval(() => {
  const entries = [...tracks, ...roomState.incoming.values()];
  const rows = [...$$("#channels .channel"), ...$$("#remoteLanes .channel")];
  entries.forEach((entry, i) => {
    let level = 0;
    if (entry.analyser) {
      const a = new Uint8Array(entry.analyser.fftSize);
      entry.analyser.getByteTimeDomainData(a);
      level = Math.min(
        13,
        Math.ceil(
          Math.sqrt(
            a.reduce((v, b) => v + ((b - 128) / 128) ** 2, 0) / a.length,
          ) * 45,
        ),
      );
    }
    rows[i]
      ?.querySelectorAll(".meter i")
      .forEach((bar, j) => bar.classList.toggle("on", j < level));
  });
}, 100);
setInterval(() => {
  for (const id of roomState.pcs.keys()) measurePeer(id);
}, 5000);
renderTracks();
renderRoster();
updateLatency(null);
const toolsButton = document.createElement("button");
toolsButton.className = "icon-button";
toolsButton.textContent = "☰";
toolsButton.setAttribute("aria-label", "Room tools");
$("#inviteBtn").before(toolsButton);
toolsButton.onclick = () => {
  showModal(
    "Room tools",
    "Manage your rehearsal and inputs.",
    '<div style="display:grid;gap:8px"><button class="btn" id="toolRooms">My rooms / create room</button><button class="btn" id="toolMembers">Room musicians / MD role</button><button class="btn" id="toolCheck">Connection check</button><button class="btn" id="toolDevices">Audio devices</button><button class="btn" id="toolSetlists">Shared setlists</button><button class="btn" id="toolSessions">Session history</button><button class="btn" id="toolName">Display name</button><button class="btn" id="toolSettings">Settings</button></div>',
    "Close",
  );
  $("#toolRooms").onclick=roomsPanel;
  $("#toolMembers").onclick=manageMembers;
  $("#toolCheck").onclick=()=>window.connectionCheck();
  $("#toolDevices").onclick = devicesPanel;
  $("#toolSetlists").onclick = setlistsPanel;
  $("#toolSessions").onclick = sessionsPanel;
  $("#toolSettings").onclick = settingsPanel;
  $("#toolName").onclick=displayNamePanel;
};
setInterval(() => {
  if (!roomState.joined) return;
  const received = [...roomState.incoming.values()];
  const active = received.filter((e) => {
    const samples = new Float32Array(256);
    e.analyser?.getFloatTimeDomainData(samples);
    return samples.some((x) => Math.abs(x) > 0.001);
  }).length;
  $("#streamStatusText").textContent =
    `Audio ${roomState.audio?.state || "off"} · ${received.length} received · ${active} sounding`;
}, 500);
const captureInput = openAudioInput;
openAudioInput = async function (deviceIdOverride) {
  const session = roomState.id;
  if (!session) throw Error("Join a room first");
  const stream = await captureInput(deviceIdOverride);
  if (roomState.id !== session || !roomState.joined) {
    stream.getTracks().forEach((t) => t.stop());
    throw Error("Room closed before the input was ready");
  }
  return stream;
};
const pendingInputs = new Set(),
  toggleMic = micToggle,
  connectAudioLane = connectLaneMic;
micToggle = async function (kind) {
  if (pendingInputs.has(kind)) return;
  pendingInputs.add(kind);
  try {
    return await toggleMic(kind);
  } finally {
    pendingInputs.delete(kind);
  }
};
connectLaneMic = async function (lane) {
  if (pendingInputs.has(lane)) return;
  pendingInputs.add(lane);
  try {
    return await connectAudioLane(lane);
  } finally {
    pendingInputs.delete(lane);
  }
};
