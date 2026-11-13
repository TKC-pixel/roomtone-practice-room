import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Metronome} from '../public/metronome.js';

function audioClock() {
  const notes=[];
  const node=()=>({connect(){return this},disconnect(){this.disconnected=true}});
  const context={currentTime:0,state:'running',destination:node(),
    createGain(){return {...node(),gain:{setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}},
    createOscillator(){const voice={...node(),frequency:{value:0},start(time){this.at=time},stop(time){this.stopAt=time}};notes.push(voice);return voice}
  };
  return {context,notes};
}
test('audio-clock cadence, bar accents, live tempo changes and stop cancellation',t=>{
  const {context,notes}=audioClock();const metro=new Metronome(context,{bpm:120,beats:3});t.after(()=>metro.stop());
  metro.start();metro.start();assert.equal(notes.length,1);assert.equal(notes[0].at,.04);assert.equal(notes[0].frequency.value,1500);
  context.currentTime=.5;metro.schedule();assert.equal(notes[1].at,.54);assert.equal(notes[1].frequency.value,900);
  context.currentTime=1;metro.schedule();context.currentTime=1.5;metro.schedule();assert.equal(notes[3].frequency.value,1500);
  metro.setTempo(60);context.currentTime=2;metro.schedule();context.currentTime=3;metro.schedule();assert.equal(notes.at(-1).at-notes.at(-2).at,1);
  metro.stop();assert.ok(notes.every(n=>n.disconnected));assert.equal(metro.queue.length,0);const count=notes.length;context.currentTime=4;metro.schedule();assert.equal(notes.length,count);
});
test('bounds, disabled accent, and no catch-up burst after throttling',t=>{
  const {context,notes}=audioClock();const metro=new Metronome(context,{accent:false});t.after(()=>metro.stop());
  metro.setTempo(0);assert.equal(metro.bpm,30);metro.setTempo(999);assert.equal(metro.bpm,300);metro.setTempo(NaN);assert.equal(metro.bpm,300);
  metro.setBeats(99);assert.equal(metro.beats,12);metro.setVolume(-10);assert.equal(metro.volume,0);
  metro.start();assert.equal(notes[0].frequency.value,900);context.currentTime=100;metro.schedule();assert.equal(notes.length,2);assert.ok(notes[1].at>=100);
});

test('shared clock keeps phase after a long pause and changes tempo at the effective boundary',t=>{
  const {context,notes}=audioClock(),m=new Metronome(context);t.after(()=>m.stop());
  const wall=()=>100000+context.currentTime*1000;
  m.applyShared({running:true,bpm:120,beats:4,accent:true,countInBars:0,at:101000,revision:1},wall);
  assert.equal(notes.length,0);
  context.currentTime=.95;m.schedule();assert.equal(notes[0].at,1);
  context.currentTime=1.1;m.applyShared({running:true,bpm:60,beats:3,accent:true,countInBars:0,at:103000,revision:2},wall);
  context.currentTime=1.45;m.schedule();assert.equal(notes.at(-1).at,1.5,'old tempo continues while new tempo is pending');
  context.currentTime=2.95;m.schedule();assert.equal(notes.at(-1).at,3);
  context.currentTime=3.95;m.schedule();assert.equal(notes.at(-1).at,4);
  context.currentTime=20.95;m.schedule();assert.equal(notes.at(-1).at,21,'background gap preserves the common timeline');
  assert.equal(notes.at(-1).frequency.value,1500,'bar accent remains on the shared downbeat');
});

test('two different audio clocks schedule the same shared server beat',t=>{
  const a=audioClock(),b=audioClock();a.context.currentTime=5;b.context.currentTime=37;
  const ma=new Metronome(a.context),mb=new Metronome(b.context);t.after(()=>{ma.stop();mb.stop()});
  const state={running:true,bpm:120,beats:4,accent:true,countInBars:1,at:103000,revision:1};
  ma.applyShared(state,()=>100000+(a.context.currentTime-5)*1000);
  mb.applyShared(state,()=>100000+(b.context.currentTime-37)*1000);
  a.context.currentTime=5.95;b.context.currentTime=37.95;ma.schedule();mb.schedule();
  assert.equal(a.notes[0].at-5,b.notes[0].at-37);
});
