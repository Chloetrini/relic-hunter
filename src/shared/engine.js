import * as THREE from 'three';
import { buildHuman } from './humanoid.js';
import { SKINS, HAIRS, HAIR_COLORS, OUTFITS, saveLocalUser } from './user.js';
import './shared.css';

export const $ = (id) => document.getElementById(id);
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// ---------------------------------------------------------------- input
export function createInput(keyMap) {
  const held = new Set();
  const edge = new Set();
  const virt = new Set();
  const byKey = {};
  for (const [action, keys] of Object.entries(keyMap)) for (const k of keys) byKey[k] = action;
  const stick = { x: 0, y: 0 };

  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    const a = byKey[e.code];
    if (a) edge.add(a);
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => { held.clear(); virt.clear(); });

  const joy = $('joy');
  let joyId = null, ox = 0, oy = 0;
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || joyId !== null) return;
    if (e.target.closest && e.target.closest('button, .panel, .dlg')) return;
    if (e.clientX > innerWidth * 0.55) return;
    joyId = e.pointerId; ox = e.clientX; oy = e.clientY;
    if (joy) { joy.style.display = 'block'; joy.style.left = ox + 'px'; joy.style.top = oy + 'px'; joy.firstElementChild.style.transform = ''; }
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const l = Math.hypot(dx, dy), max = 50;
    if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
    stick.x = dx / max; stick.y = dy / max;
    if (joy) joy.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endJoy = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null; stick.x = stick.y = 0;
    if (joy) joy.style.display = 'none';
  };
  addEventListener('pointerup', endJoy);
  addEventListener('pointercancel', endJoy);

  return {
    held(action) {
      if (virt.has(action)) return true;
      for (const [k, a] of Object.entries(byKey)) if (a === action && held.has(k)) return true;
      return false;
    },
    pressed(action) { const r = edge.has(action); edge.delete(action); return r; },
    clearEdges() { edge.clear(); },
    // WASD / arrows / joystick -> {x, y} in -1..1 (y positive = down the screen)
    axis() {
      let x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      let y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      x += stick.x; y += stick.y;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x, y, mag: Math.min(1, l) };
    },
    bindButton(el, action) {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); virt.add(action); edge.add(action); el.classList.add('down'); });
      const up = () => { virt.delete(action); el.classList.remove('down'); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('pointercancel', up);
    },
  };
}

// ---------------------------------------------------------------- sound
let ac = null;
let master = null;
export function unlockAudio() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.35;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch { /* no audio available */ }
}
export function audio() { return { ac, master }; }
export function tone(freq, dur = 0.15, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
export function noise(dur = 0.2, vol = 0.3, delay = 0) {
  if (!ac) return;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = buf; g.gain.value = vol;
  s.connect(g); g.connect(master);
  s.start(ac.currentTime + delay);
}

// ---------------------------------------------------------------- toast + dialogue
let toastTimer = 0;
export function toast(text, ms = 2200) {
  const el = $('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// lines: [{ who, text }]  -> calls done() after the last one
export function createDialogue() {
  const box = $('dlg'), who = $('dlgWho'), txt = $('dlgTxt');
  let lines = [], i = 0, shown = 0, full = '', done = null, timer = 0, active = false;

  function showLine() {
    const l = lines[i];
    who.textContent = l.who;
    full = l.text; shown = 0; txt.textContent = '';
    clearInterval(timer);
    timer = setInterval(() => {
      shown += 2;
      txt.textContent = full.slice(0, shown);
      if (shown >= full.length) clearInterval(timer);
    }, 22);
  }
  function advance() {
    if (!active) return;
    if (shown < full.length) { shown = full.length; txt.textContent = full; clearInterval(timer); unlockAudio(); return; }
    i++;
    unlockAudio(); tone(520, 0.05, 'triangle', 0.12);
    if (i >= lines.length) { active = false; box.classList.remove('show'); clearInterval(timer); const d = done; done = null; if (d) d(); }
    else showLine();
  }
  box.addEventListener('pointerdown', (e) => { e.stopPropagation(); advance(); });
  addEventListener('keydown', (e) => {
    if (!active) return;
    if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); advance(); }
  });
  return {
    get active() { return active; },
    say(list, cb) { lines = list; i = 0; done = cb; active = true; box.classList.add('show'); showLine(); },
  };
}

// ---------------------------------------------------------------- character picker with live 3D preview
export function mountCustomizer(host, user, humanOpts = {}) {
  host.innerHTML = `
    <div class="pick">
      <canvas id="pv"></canvas>
      <div class="ctrls">
        <div class="row"><label>Name</label><input type="text" id="pvName" maxlength="14" placeholder="Your name"></div>
        <div class="row"><label>Skin</label><div class="opts" id="pvSkin"></div></div>
        <div class="row"><label>Hair</label><div class="opts" id="pvHair"></div></div>
        <div class="row"><label>Colour</label><div class="opts" id="pvHairC"></div></div>
        <div class="row"><label>Outfit</label><div class="opts" id="pvOutfit"></div></div>
      </div>
    </div>`;
  const canvas = host.querySelector('#pv');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 150 / 210, 0.1, 50);
  cam.position.set(0, humanOpts.camY || 1.5, humanOpts.camZ || 7.2);
  cam.lookAt(0, humanOpts.lookY || 1.15, 0);
  sc.add(new THREE.HemisphereLight('#ffffff', '#6a5a8a', 1.5));
  const key = new THREE.DirectionalLight('#fff0d8', 2.2);
  key.position.set(3, 5, 6);
  sc.add(key);
  let human = null;

  function rebuild() {
    if (human) sc.remove(human.root);
    human = (humanOpts.builder || buildHuman)({ ...humanOpts, ...user.style });
    human.root.rotation.y = 0.5;
    if (humanOpts.decorate) humanOpts.decorate(human);
    sc.add(human.root);
  }
  rebuild();

  const fill = (id, items, key2, render) => {
    const el = host.querySelector(id);
    el.innerHTML = '';
    items.forEach((v) => {
      const b = document.createElement('button');
      b.type = 'button';
      render(b, v);
      b.addEventListener('click', () => {
        user.style[key2] = v;
        saveLocalUser(user);
        refresh();
        rebuild();
      });
      b.dataset.v = v;
      el.appendChild(b);
    });
    return el;
  };
  const sw = (b, v) => { b.className = 'sw'; b.style.background = v; b.setAttribute('aria-label', v); };
  const opt = (b, v) => { b.className = 'opt'; b.textContent = v; };
  const els = {
    skin: fill('#pvSkin', SKINS, 'skin', sw),
    hair: fill('#pvHair', HAIRS, 'hair', opt),
    hairColor: fill('#pvHairC', HAIR_COLORS, 'hairColor', sw),
    outfit: fill('#pvOutfit', OUTFITS, 'outfit', sw),
  };
  function refresh() {
    for (const [k, el] of Object.entries(els)) for (const b of el.children) b.classList.toggle('on', b.dataset.v === user.style[k]);
  }
  refresh();
  const nameEl = host.querySelector('#pvName');
  nameEl.value = user.name === 'Guest' ? '' : user.name;
  nameEl.addEventListener('input', () => { user.name = nameEl.value.trim().slice(0, 14) || 'Guest'; saveLocalUser(user); });
  nameEl.addEventListener('keydown', (e) => e.stopPropagation());

  let raf = 0, last = performance.now(), alive = true;
  function loop(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && (canvas.width !== Math.floor(w * r.getPixelRatio()) || canvas.height !== Math.floor(h * r.getPixelRatio()))) {
      r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    human.root.rotation.y += dt * 0.7;
    human.update(dt, 0, humanOpts.pose || {});
    r.render(sc, cam);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    setHidden(hidden) {
      alive = !hidden;
      if (alive) { last = performance.now(); raf = requestAnimationFrame(loop); } else cancelAnimationFrame(raf);
    },
    hideControls() { host.querySelector('.ctrls').style.display = 'none'; },
    rebuild,
    attach(prop) { human.parts.handR.add(prop); },
  };
}

// ---------------------------------------------------------------- base renderer
export function createStage({ fog = '#0d1030', near = 30, far = 95, fov = 50 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'game';
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(fog);
  scene.fog = new THREE.Fog(fog, near, far);
  const camera = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.1, 300);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
  return { renderer, scene, camera };
}
