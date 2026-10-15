// "Customize explorer" drawer: a live 3D preview (always moving, drag to turn) and the
// same options as the start.ng character creator. A start.ng character is shown, not edited:
// players change it on start.ng so it stays the same in every game.
import * as THREE from 'three';
import { buildHuman } from './human.js';
import { SKINS, HAIR_COLORS, TOPS, BOTTOMS, HATS, SECTIONS, withBody } from './character.js';
import { saveLocalUser, signInUrl, startngHome } from '../shared/user.js';

const DRAG_SPEED = 0.006; // radians per pixel

export function mountCustomizer(host, user, onChange) {
  host.innerHTML = `
    <div class="cz-preview"><canvas></canvas><span class="cz-hint">Drag to turn</span></div>
    <div class="cz-note" hidden></div>
    <div class="cz-ctrls">
      <div class="cz-seg" data-k="body"></div>
      <label class="cz-row"><span>Name</span><input type="text" maxlength="24" placeholder="Your name"></label>
      <div class="cz-row"><span>Skin</span><div class="cz-opts" data-k="skinColor"></div></div>
      <div class="cz-row"><span>Hair</span><div class="cz-opts" data-k="hair"></div></div>
      <div class="cz-row cz-haircol"><span>Hair colour</span><div class="cz-opts" data-k="hairColor"></div></div>
      <div class="cz-row"><span>Top</span><div class="cz-opts" data-k="primaryColor"></div></div>
      <div class="cz-row"><span>Bottoms</span><div class="cz-opts" data-k="secondaryColor"></div></div>
      <div class="cz-row"><span>Hat</span><div class="cz-opts" data-k="hat"></div></div>
      <div class="cz-row"><span>Extra</span><div class="cz-opts" data-k="accessory"></div></div>
    </div>`;

  // ---- note about start.ng
  const note = host.querySelector('.cz-note');
  if (user.source === 'startng') {
    note.hidden = false;
    note.innerHTML = `This is <b></b>, your start.ng character. <a target="_blank" rel="noopener">Change it on start.ng</a>`;
    note.querySelector('b').textContent = user.name;
    note.querySelector('a').href = startngHome();
    host.querySelector('.cz-ctrls').hidden = true;
  } else if (signInUrl()) {
    note.hidden = false;
    note.innerHTML = `<a>Sign in with start.ng</a> to play as your start.ng character.`;
    note.querySelector('a').href = signInUrl();
  }

  // ---- 3D preview
  const canvas = host.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4e0', '#3a2a1a', 1.5));
  const key = new THREE.DirectionalLight('#ffe2b8', 2.4);
  key.position.set(1.5, 2.5, 2.5);
  const rim = new THREE.DirectionalLight('#e2c178', 1.6);
  rim.position.set(-2, 2, -2.5);
  scene.add(key, rim);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  camera.position.set(0, 1.05, 4.4);
  camera.lookAt(0, 0.88, 0);
  const turntable = new THREE.Group();
  turntable.rotation.y = 0.35;
  scene.add(turntable);
  let human = null;
  function rebuild() {
    if (human) { turntable.remove(human.root); human.dispose(); }
    human = buildHuman(user.style);
    turntable.add(human.root);
  }
  rebuild();

  let dragging = false, lastX = 0, velocity = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; velocity = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    turntable.rotation.y += dx * DRAG_SPEED; velocity = dx * DRAG_SPEED;
  });
  const up = () => { dragging = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // ---- controls
  const label = (v) => (v === 'tophat' ? 'top hat' : v);
  const lists = () => ({
    skinColor: SKINS, hairColor: HAIR_COLORS, primaryColor: TOPS, secondaryColor: BOTTOMS, hat: HATS,
    hair: SECTIONS[user.style.body].hair, accessory: SECTIONS[user.style.body].accessory,
  });
  function render() {
    const seg = host.querySelector('.cz-seg');
    seg.innerHTML = '';
    for (const b of ['female', 'male']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b === 'female' ? 'Female' : 'Male';
      btn.classList.toggle('on', user.style.body === b);
      btn.onclick = () => { user.style = withBody(user.style, b); changed(); };
      seg.appendChild(btn);
    }
    for (const [k, items] of Object.entries(lists())) {
      const el = host.querySelector(`.cz-opts[data-k="${k}"]`);
      el.innerHTML = '';
      const colour = k.endsWith('Color');
      for (const v of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = colour ? 'cz-sw' : 'cz-opt';
        if (colour) { btn.style.background = v; btn.setAttribute('aria-label', v); } else btn.textContent = label(v);
        btn.classList.toggle('on', user.style[k] === v);
        btn.onclick = () => { user.style = { ...user.style, [k]: v }; changed(); };
        el.appendChild(btn);
      }
    }
    host.querySelector('.cz-haircol').hidden = user.style.hair === 'bald';
  }
  function changed() {
    saveLocalUser(user);
    render();
    rebuild();
    onChange && onChange();
  }
  render();
  const nameEl = host.querySelector('input');
  nameEl.value = user.name === 'Explorer' ? '' : user.name;
  nameEl.addEventListener('input', () => { user.name = nameEl.value.trim().slice(0, 24) || 'Explorer'; saveLocalUser(user); onChange && onChange(); });
  nameEl.addEventListener('keydown', (e) => e.stopPropagation());

  // ---- loop (only while the drawer is open)
  let hidden = true, last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    if (hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio()))) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    if (!dragging) { turntable.rotation.y += velocity; velocity *= Math.pow(0.04, dt); }
    human.update(dt, 0);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  return { setHidden(v) { hidden = v; } };
}
