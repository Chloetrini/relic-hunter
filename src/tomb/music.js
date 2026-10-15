// Relic Hunter soundtrack: made live with WebAudio, no audio files.
// Moods: 'title' (quiet drone), 'explore' (temple oud and frame drum), 'chase' (fast drums and bass when the
// boulder rolls) and 'win' (a short fanfare). Uses the hijaz scale on D for an old-temple sound.
import { audio } from '../shared/engine.js';

const KEY = 'relichunter.music';
const D = 146.83;                                  // D3
const SCALE = [0, 1, 4, 5, 7, 8, 10];              // D Eb F# G A Bb C
const hz = (deg, oct = 0) => {
  const n = SCALE.length, o = Math.floor(deg / n) + oct;
  return D * Math.pow(2, (SCALE[((deg % n) + n) % n] + 12 * o) / 12);
};

// melodies as scale degrees per 16th step (null = rest)
const EXPLORE_MELODY = [
  [0, null, null, 2, null, null, 4, null, null, null, 3, null, 2, null, null, null],
  [1, null, null, 2, null, null, 1, null, 0, null, null, null, null, null, null, null],
  [4, null, null, 5, null, null, 4, null, null, null, 6, null, 5, null, 4, null],
  [3, null, 2, null, 1, null, null, null, 0, null, null, null, null, null, null, null],
];
const CHASE_BASS = [0, 0, 1, 0, 0, 0, 2, 1, 0, 0, 1, 0, 3, 2, 1, -1];
const CHASE_LEAD = [
  [7, null, null, 8, null, null, 9, null, 8, null, 7, null, 6, null, 7, null],
  [7, null, null, 6, null, null, 5, null, 6, null, 5, null, 4, null, 5, null],
];

export function createMusic() {
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage blocked */ }
  let bus = null, verb = null, drone = null, ac = null;
  let mood = null, step = 0, nextT = 0, timer = 0, bar = 0;

  function build() {
    const a = audio();
    if (!a.ac || bus) return !!bus;
    ac = a.ac;
    bus = ac.createGain();
    bus.gain.value = on ? 1 : 0;
    bus.connect(a.master);
    // temple echo: a short generated reverb
    verb = ac.createConvolver();
    const len = ac.sampleRate * 2.4, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.35;
    verb.connect(wet); wet.connect(bus);
    // low drone on D and A that never stops, only its loudness follows the mood
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 2;
    const g = ac.createGain(); g.gain.value = 0;
    const lfo = ac.createOscillator(), lfoG = ac.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 140; lfo.connect(lfoG); lfoG.connect(f.frequency); lfo.start();
    for (const [fr, type] of [[D / 2, 'sawtooth'], [D * 0.75, 'sawtooth'], [D / 2 * 1.003, 'triangle']]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = fr; o.connect(f); o.start();
    }
    f.connect(g); g.connect(bus); g.connect(verb);
    drone = { g, f };
    return true;
  }

  // one note: oscillator -> optional filter -> gain envelope -> bus (+ reverb)
  function note(freq, t, dur, { type = 'triangle', vol = 0.1, attack = 0.005, cutoff = 0, wet = 0.5, slide = 0 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = o;
    if (cutoff) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); last = f; }
    last.connect(g); g.connect(bus);
    if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function hit(t, { vol = 0.1, cutoff = 4000, dur = 0.06, type = 'highpass' } = {}) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + dur + 0.02);
  }
  const doum = (t, vol = 0.22) => note(110, t, 0.35, { type: 'sine', vol, slide: 0.45, wet: 0.25 });
  const tek = (t, vol = 0.06) => hit(t, { vol, cutoff: 2500, dur: 0.07 });

  function playStep(t, sixteenth) {
    if (mood === 'explore') {
      const m = EXPLORE_MELODY[bar % 4][step];
      if (m !== null) {
        note(hz(m, 1), t, 1.1, { type: 'triangle', vol: 0.07, cutoff: 1800, wet: 0.7 });
        note(hz(m, 2), t, 0.5, { type: 'sine', vol: 0.025, wet: 0.8 });       // bright oud-like overtone
      }
      if (step === 0 || step === 10) doum(t, 0.16);
      if (step === 4 || step === 12) tek(t, 0.035);
      if (step === 0 && bar % 2 === 0) note(hz(0, -1), t, sixteenth * 30, { type: 'sine', vol: 0.05, attack: 0.6, wet: 0.6 });
    } else if (mood === 'chase') {
      if (step === 0 || step === 3 || step === 8 || step === 11) doum(t, 0.3);
      if (step === 4 || step === 12) { tek(t, 0.12); hit(t, { vol: 0.08, cutoff: 900, dur: 0.12, type: 'bandpass' }); }
      if (step % 2 === 1) tek(t, 0.03);
      const b = CHASE_BASS[step];
      note(hz(b, -1), t, sixteenth * 0.9, { type: 'sawtooth', vol: 0.09, cutoff: 700, wet: 0.1 });
      const l = CHASE_LEAD[bar % 2][step];
      if (l !== null && bar % 4 >= 2) note(hz(l, 0), t, sixteenth * 2.6, { type: 'square', vol: 0.035, cutoff: 2400, wet: 0.35 });
    } else if (mood === 'title') {
      if (step === 0 && bar % 2 === 0) note(hz(4, 0), t, 3, { type: 'sine', vol: 0.04, attack: 0.8, wet: 0.9 });
      if (step === 8 && bar % 4 === 1) note(hz(1, 1), t, 2.2, { type: 'triangle', vol: 0.03, cutoff: 1500, wet: 0.9 });
    }
  }

  function tick() {
    if (!ac) return;
    const bpm = mood === 'chase' ? 150 : mood === 'explore' ? 84 : 60;
    const six = 60 / bpm / 4;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.15) {
      if (on && mood !== 'win') playStep(nextT, six);
      nextT += six;
      step = (step + 1) % 16;
      if (step === 0) bar++;
    }
  }

  function fanfare() {
    const t = ac.currentTime + 0.05;
    // D major lift out of the hijaz minor: D F# A D, then a held chord
    [[0, 0], [2, 0.16], [4, 0.32], [7, 0.48]].forEach(([d, at]) => note(hz(d, 1), t + at, 0.6, { type: 'square', vol: 0.05, cutoff: 3000 }));
    for (const f of [D * 2, D * 2 * 1.26, D * 3, D * 4]) note(f, t + 0.66, 2.6, { type: 'triangle', vol: 0.05, attack: 0.05, wet: 0.8 });
    doum(t + 0.66, 0.3); hit(t + 0.66, { vol: 0.12, cutoff: 3000, dur: 1.2 });
  }

  function setMood(m) {
    if (m === mood || !build()) return;
    const prev = mood;
    mood = m;
    step = 0; bar = 0;
    const t = ac.currentTime;
    const droneVol = { title: 0.05, explore: 0.04, chase: 0.07, win: 0.02 }[m];
    drone.g.gain.cancelScheduledValues(t);
    drone.g.gain.setTargetAtTime(droneVol, t, m === 'chase' ? 0.15 : 1.2);
    drone.f.frequency.setTargetAtTime(m === 'chase' ? 900 : 380, t, 0.4);
    if (m === 'win' && prev) fanfare();
    if (!timer) timer = setInterval(tick, 25);
  }

  return {
    get on() { return on; },
    get mood() { return mood; },
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
      if (bus) bus.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.1);
      return on;
    },
    // called every frame: picks the mood from the game state
    update(G) {
      const m = G.mode === 'idle' ? 'title' : G.won ? 'win' : G.idol ? 'chase' : 'explore';
      setMood(m);
    },
  };
}
