// Schedule clicks on the audio clock; UI timers never determine click timing.
export class Metronome {
  constructor(context, { bpm = 68, beats = 4, volume = 35, accent = true } = {}) {
    this.context = context;
    this.bpm = this.clamp(bpm, 30, 300, 68);
    this.beats = this.clamp(beats, 1, 12, 4);
    this.accent = Boolean(accent);
    this.output = context.createGain();
    this.output.connect(context.destination);
    this.setVolume(volume);
    this.voices = new Set();
    this.queue = [];
    this.running = false;
  }
  clamp(value, min, max, fallback) {
    return Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback;
  }
  setTempo(value) { this.bpm = this.clamp(value, 30, 300, this.bpm); }
  setBeats(value) { this.beats = this.clamp(value, 1, 12, this.beats); this.beat %= this.beats; }
  setVolume(value) {
    this.volume = this.clamp(value, 0, 100, 35);
    this.output.gain.setTargetAtTime(this.volume / 100 * 0.4, this.context.currentTime, 0.01);
  }
  start(at = this.context.currentTime + 0.04, firstBeat = 0) {
    if (this.running) return;
    this.running = true;
    const interval=60/this.bpm, now=this.context.currentTime;
    const skip=Math.max(0,Math.ceil((now-at)/interval));
    this.beat=(firstBeat+skip)%this.beats;
    this.next=Math.max(now+0.02,at+skip*interval);
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }
  schedule() {
    if (!this.running || this.context.state === 'suspended') return;
    if(this.sharedClock){this.scheduleShared();return;}
    const now = this.context.currentTime;
    // A throttled background tab resumes with one beat, never a burst of missed clicks.
    if(this.next < now){const skip=Math.ceil((now-this.next)/(60/this.bpm));this.next+=skip*60/this.bpm;this.beat=(this.beat+skip)%this.beats;}
    while (this.next < now + 0.12) {
      this.click(this.next,this.beat);
      this.next += 60 / this.bpm;
      this.beat = (this.beat + 1) % this.beats;
    }
  }

  click(time,beat) {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const accented = this.accent && beat === 0;
      oscillator.frequency.value = accented ? 1500 : 900;
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(accented ? 1 : 0.65, time + 0.002);
      envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
      oscillator.connect(envelope).connect(this.output);
      const voice = { oscillator, envelope };
      this.voices.add(voice);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.voices.delete(voice); };
      oscillator.start(time);
      oscillator.stop(time + 0.04);
      this.queue.push({ time: time, beat: beat });
      if (this.queue.length > 32) this.queue.shift();

  }
  applyShared(metro,serverNow) {
    if(!metro.running){this.stop();return;}
    if(this.sharedClock && this.revision===metro.revision)return;
    if(!this.sharedClock)this.stop();
    this.revision=metro.revision;
    this.sharedClock=serverNow;
    this.pendingShared={...metro,origin:metro.at-(metro.countInBars||0)*metro.beats*60000/metro.bpm};
    this.running=true;
    clearInterval(this.timer);
    this.schedule();this.timer=setInterval(()=>this.schedule(),25);
  }
  scheduleShared() {
    const audioNow=this.context.currentTime,wallNow=this.sharedClock(),horizon=wallNow+120;
    const emit=(state,limit)=>{
      const step=60000/state.bpm;
      this.sharedIndex=Math.max(this.sharedIndex,Math.ceil((wallNow+5-state.origin)/step),0);
      this.bpm=state.bpm;this.beats=state.beats;this.accent=state.accent;
      let at=state.origin+this.sharedIndex*step;
      while(at<limit){this.click(audioNow+(at-wallNow)/1000,this.sharedIndex%state.beats);this.sharedIndex++;at=state.origin+this.sharedIndex*step;}
    };
    if(this.activeShared)emit(this.activeShared,Math.min(horizon,this.pendingShared?.origin??Infinity));
    if(this.pendingShared&&this.pendingShared.origin<horizon){
      this.activeShared=this.pendingShared;this.pendingShared=null;this.sharedIndex=0;
      emit(this.activeShared,horizon);
    }
  }
  stop() {
    this.running = false;this.sharedClock=null;this.activeShared=null;this.pendingShared=null;
    clearInterval(this.timer);
    for (const voice of this.voices) {
      try { voice.oscillator.stop(); } catch {}
      voice.oscillator.disconnect(); voice.envelope.disconnect();
    }
    this.voices.clear(); this.queue.length = 0;
  }
}

function initialize() {
  const get = id => document.getElementById(id);
  let settings = { bpm: 68, beats: 4, volume: 35, accent: true };
  try { const saved = JSON.parse(localStorage.getItem('roomtone-metronome') || '{}');
    for (const key of ['bpm','beats','volume']) if (Number.isFinite(saved[key])) settings[key] = saved[key];
    if (typeof saved.accent === 'boolean') settings.accent = saved.accent;
  } catch {}
  settings.bpm = Math.max(30, Math.min(300, Math.round(settings.bpm)));
  settings.beats = Math.max(1, Math.min(12, Math.round(settings.beats)));
  settings.volume = Math.max(0, Math.min(100, Math.round(settings.volume)));
  let engine, starting = false, frame, taps = [], flashUntil = 0, shared=false,listenerMuted=false;
  const save = () => { try { localStorage.setItem('roomtone-metronome', JSON.stringify(settings)); } catch {} };
  function paintControls() {
    get('metroBpm').value = get('metroTempoRange').value = settings.bpm;
    get('metroBeats').value = settings.beats;
    get('metroVolume').value = settings.volume;
    get('metroVolumeValue').value = settings.volume + '%';
    get('metroAccent').checked = settings.accent;
    get('metroBeatLights').replaceChildren(...Array.from({ length: settings.beats }, (_, i) => {
      const dot = document.createElement('span'); dot.textContent = i + 1; return dot;
    }));
    get('metroStatus').textContent = `${engine?.running ? 'Playing' : 'Stopped'} · ${settings.bpm} BPM`;
  }
  function tempo(value) {
    if (String(value).trim() === '' || !Number.isFinite(Number(value))) { paintControls(); return; }
    settings.bpm = Math.max(30, Math.min(300, Math.round(Number(value))));
    if(!shared)engine?.setTempo(settings.bpm); save(); paintControls();
  }
  function animate() {
    if (!engine?.running) return;
    const now = engine.context.currentTime;
    let event;
    while (engine.queue.length && engine.queue[0].time <= now) event = engine.queue.shift();
    if (event) {
      [...get('metroBeatLights').children].forEach((dot, i) => dot.classList.toggle('active', i === event.beat));
      flashUntil = now + 0.1;
    } else if (now > flashUntil) {
      [...get('metroBeatLights').children].forEach(dot => dot.classList.remove('active'));
    }
    frame = requestAnimationFrame(animate);
  }
  function stop() {
    engine?.stop(); cancelAnimationFrame(frame);
    shared=false;listenerMuted=false;
    get('metroToggle').textContent = 'Start metronome';
    get('metroToggle').setAttribute('aria-pressed', 'false'); paintControls();window.syncMetronomeRole?.();
  }
  const syncTempo=()=>{if(shared&&['owner','md'].includes(window.roomState?.role))window.roomMessage?.({type:'metro-tempo',bpm:settings.bpm,beats:settings.beats,accent:settings.accent,countInBars:0});};
  get('metroBpm').onchange = e => {tempo(e.target.value);syncTempo();};
  get('metroBpm').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); tempo(e.target.value);syncTempo(); } };
  get('metroTempoRange').oninput = e => tempo(e.target.value);
  get('metroTempoRange').onchange=syncTempo;
  get('metroMinus').onclick = () => {tempo(settings.bpm - 1);syncTempo();};
  get('metroPlus').onclick = () => {tempo(settings.bpm + 1);syncTempo();};
  get('metroVolume').oninput = e => { settings.volume = +e.target.value; engine?.setVolume(listenerMuted?0:settings.volume); get('metroVolumeValue').value = settings.volume + '%'; save(); };
  get('metroAccent').onchange = e => { settings.accent = e.target.checked; if (engine&&!shared) engine.accent = settings.accent; save();syncTempo(); };
  get('metroToggle').onclick = async () => {
    if(starting)return;
    if(shared&&!['owner','md'].includes(window.roomState?.role)){
      listenerMuted=!listenerMuted;engine.setVolume(listenerMuted?0:settings.volume);
      get('metroToggle').textContent=listenerMuted?'Unmute my click':'Mute my click';return;
    }
    if(engine?.running){if(shared&&window.roomState?.joined&&['owner','md'].includes(window.roomState.role))window.roomMessage({type:'metro-stop'});else stop();return;}
    starting=true;try{const context=window.ensureAudio();await context.resume();engine??=new Metronome(context,settings);if(!shared){engine.setTempo(settings.bpm);engine.setBeats(settings.beats);engine.setVolume(settings.volume);engine.accent=settings.accent;}if(window.roomState?.joined&&['owner','md'].includes(window.roomState.role)){window.roomMessage({type:'metro-start',bpm:settings.bpm,beats:settings.beats,accent:settings.accent,countInBars:+get('metroCountIn').value});get('metroStatus').textContent='Scheduling shared start…';}else{engine.start();get('metroToggle').textContent='Stop metronome';get('metroToggle').setAttribute('aria-pressed','true');paintControls();animate();}}catch{get('metroStatus').textContent='Audio unavailable. Try starting again.';}finally{starting=false;}
  };
  get('metroBeats').onchange=e=>{settings.beats=+e.target.value;if(!shared)engine?.setBeats(settings.beats);save();paintControls();syncTempo();};
  get('metroTap').onclick = () => {
    const now = performance.now();
    if (taps.length && now - taps.at(-1) > 2200) taps = [];
    taps.push(now); taps = taps.slice(-5);
    if (taps.length > 1) {tempo(60000 * (taps.length - 1) / (now - taps[0]));syncTempo();}
    else get('metroStatus').textContent = 'Tap again to set tempo';
  };
  window.addEventListener('pagehide', stop);
  window.applySharedMetronome=(metro,offset=0)=>{
    if(!metro)return;
    if(!metro.running){stop();get('metroStatus').textContent='Shared metronome stopped';return;}
    settings.bpm=metro.bpm;settings.beats=metro.beats;settings.accent=metro.accent!==false;
    get('metroCountIn').value=String(metro.countInBars||0);
    engine??=new Metronome(window.ensureAudio(),settings);
    engine.applyShared(metro,()=>Date.now()+(window.roomState?.serverOffset??offset));engine.setVolume(listenerMuted?0:settings.volume);
    shared=true;cancelAnimationFrame(frame);
    get('metroToggle').textContent=['owner','md'].includes(window.roomState?.role)?'Stop shared metronome':listenerMuted?'Unmute my click':'Mute my click';
    get('metroToggle').setAttribute('aria-pressed','true');paintControls();
    get('metroStatus').textContent=engine.context.state==='suspended'?'Click the page to enable audio':`Room sync · ${settings.bpm} BPM · ${metro.countInBars||0} count-in bars`;
    window.syncMetronomeRole?.();animate();
  };
  window.syncMetronomeRole=()=>{
    const can=window.roomState?.joined&&['owner','md'].includes(window.roomState.role);
    if(shared)get('metroToggle').textContent=can?'Stop shared metronome':listenerMuted?'Unmute my click':'Mute my click';
    for(const id of ['metroBpm','metroTempoRange','metroMinus','metroPlus','metroTap','metroBeats','metroAccent','metroCountIn'])get(id).disabled=shared&&!can;
    get('metroToggle').title=can?'Control the shared room metronome':'Control the click in your headphones';
  };
  paintControls();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}
