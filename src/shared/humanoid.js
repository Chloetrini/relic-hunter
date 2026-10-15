import * as THREE from 'three';

// A stylised, friendly human built from smooth primitives (feet at y = 0, ~2.1 tall at scale 1).
// Used for the player, villagers, witches, vampires and hunters in both games.

const PI = Math.PI;
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, ...o });
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };

function hairCap(R, color, theta, extra = 1.07) {
  const m = mat(color, { roughness: 0.9 });
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(R * extra, 28, 18, 0, PI * 2, 0, theta), m));
  // longer coverage at the back of the head so it never looks bald from behind
  g.add(mesh(new THREE.SphereGeometry(R * extra * 1.01, 28, 18, PI + 0.4, PI - 0.8, 0, PI * 0.64), m));
  return g;
}

function makeHair(style, color, R, accent) {
  const g = new THREE.Group();
  const m = mat(color, { roughness: 0.9 });
  switch (style) {
    case 'afro': {
      const s = mesh(new THREE.SphereGeometry(R * 1.3, 32, 22), m, 0, R * 0.34, -R * 0.34);
      s.scale.set(1.02, 0.95, 1);
      g.add(s);
      break;
    }
    case 'braids': {
      g.add(hairCap(R, color, PI * 0.4));
      const n = 11;
      for (let i = 0; i < n; i++) {
        const a = -PI * 0.78 + (i * PI * 1.56) / (n - 1);
        const len = 0.5 + (i % 3) * 0.08;
        const b = mesh(new THREE.CapsuleGeometry(0.036, len, 4, 8), m, Math.sin(a) * R * 0.98, -len / 2 + R * 0.12, -Math.cos(a) * R * 0.98);
        b.rotation.z = -Math.sin(a) * 0.12;
        b.rotation.x = Math.cos(a) * 0.12;
        g.add(b);
        g.add(mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(accent, { roughness: 0.4 }), b.position.x, b.position.y - len / 2 - 0.02, b.position.z));
      }
      break;
    }
    case 'puffs': {
      g.add(hairCap(R, color, PI * 0.4));
      for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(R * 0.5, 20, 16), m, s * R * 0.72, R * 0.82, -R * 0.05));
      g.add(mesh(new THREE.TorusGeometry(R * 0.22, 0.03, 8, 16), mat(accent, { roughness: 0.4 }), -R * 0.5, R * 0.62, -R * 0.03));
      g.add(mesh(new THREE.TorusGeometry(R * 0.22, 0.03, 8, 16), mat(accent, { roughness: 0.4 }), R * 0.5, R * 0.62, -R * 0.03));
      break;
    }
    case 'wrap': {
      // gele-style head wrap in the outfit colour
      const wm = mat(accent, { roughness: 0.45 });
      const t1 = mesh(new THREE.TorusGeometry(R * 0.86, R * 0.26, 14, 28), wm, 0, R * 0.42, -R * 0.02);
      t1.rotation.x = PI / 2 + 0.12;
      const t2 = mesh(new THREE.TorusGeometry(R * 0.62, R * 0.28, 14, 28), wm, 0, R * 0.78, -R * 0.1);
      t2.rotation.x = PI / 2 + 0.25;
      const fan = mesh(new THREE.SphereGeometry(R * 0.5, 18, 14), wm, R * 0.22, R * 1.12, -R * 0.14);
      fan.scale.set(1.5, 0.8, 1);
      fan.rotation.z = -0.35;
      g.add(t1, t2, fan);
      g.add(mesh(new THREE.SphereGeometry(R * 1.04, 24, 16, 0, PI * 2, 0, PI * 0.3), wm, 0, 0.01, -0.02));
      break;
    }
    default: // short
      g.add(hairCap(R, color, PI * 0.4));
  }
  return g;
}

function makeHat(kind) {
  const g = new THREE.Group();
  if (kind === 'witch') {
    const cloth = mat('#2a1744', { roughness: 0.8 });
    g.add(mesh(new THREE.CylinderGeometry(0.78, 0.82, 0.05, 28), cloth, 0, 0, 0));
    const c1 = mesh(new THREE.CylinderGeometry(0.22, 0.46, 0.62, 24), cloth, 0, 0.33, 0);
    const c2 = mesh(new THREE.CylinderGeometry(0.0, 0.22, 0.6, 24), cloth, 0.04, 0.92, 0);
    c2.rotation.z = -0.28;
    c2.position.x = 0.1;
    g.add(c1, c2);
    const band = mesh(new THREE.TorusGeometry(0.43, 0.05, 8, 28), mat('#f0b429', { roughness: 0.35, metalness: 0.4 }), 0, 0.1, 0);
    band.rotation.x = PI / 2;
    g.add(band);
  }
  if (kind === 'chef') {
    const white = mat('#fbfbf6', { roughness: 0.9 });
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.37, 0.24, 22), white, 0, 0.03, 0));
    const puff = mesh(new THREE.SphereGeometry(0.44, 20, 14), white, 0, 0.36, 0);
    puff.scale.set(1, 0.78, 1);
    g.add(puff);
  }
  return g;
}

function makeCape(color, lining) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.4, 0.78, 1.45, 24, 1, true, PI - 1.25, 2.5);
  const outer = mesh(geo, mat(color, { roughness: 0.8 }));
  outer.material.side = THREE.FrontSide;
  const inner = mesh(geo, mat(lining, { roughness: 0.6, side: THREE.BackSide }));
  inner.scale.set(0.995, 1, 0.995);
  g.add(outer, inner);
  return g;
}

export function buildHuman(opts = {}) {
  const {
    skin = '#8d5a36', hair = 'short', hairColor = '#17120f', outfit = '#2e86ab', trim = '#f6c945',
    pants = '#2b2b3a', shoes = '#3a2a20', robe = false, robeColor = null, hat = null, cape = null,
    capeLining = '#8a0f1f', fangs = false, glowEyes = null, scale = 1, bareHead = false,
  } = opts;

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const flashMats = [];
  const track = (m) => { flashMats.push(m); return m; };

  const skinM = track(mat(skin, { roughness: 0.62 }));
  const outfitM = track(mat(outfit, { roughness: 0.7 }));
  const pantsM = track(mat(pants, { roughness: 0.8 }));
  const shoesM = track(mat(shoes, { roughness: 0.6 }));
  const trimM = mat(trim, { roughness: 0.4, metalness: 0.2 });

  // ----- legs
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.13, 0.64, 0);
    leg.add(mesh(new THREE.CapsuleGeometry(0.105, 0.34, 6, 12), pantsM, 0, -0.3, 0));
    const foot = mesh(new THREE.SphereGeometry(0.125, 14, 10), shoesM, 0, -0.58, 0.07);
    foot.scale.set(1, 0.62, 1.5);
    leg.add(foot);
    rig.add(leg);
    legs.push(leg);
  }

  // ----- torso
  const torso = mesh(new THREE.CapsuleGeometry(0.255, 0.34, 8, 16), outfitM, 0, 0.98, 0);
  torso.scale.set(1.0, 1, 0.82);
  rig.add(torso);
  const belt = mesh(new THREE.TorusGeometry(0.255, 0.035, 8, 20), trimM, 0, 0.72, 0);
  belt.rotation.x = PI / 2;
  belt.scale.set(1, 0.82, 1);
  rig.add(belt);

  let skirt = null;
  if (robe) {
    const pts = [[0.7, 0.03], [0.66, 0.18], [0.52, 0.42], [0.36, 0.66], [0.3, 0.78]].map(([r, y]) => new THREE.Vector2(r, y));
    const rm = track(mat(robeColor || outfit, { roughness: 0.75, side: THREE.DoubleSide }));
    skirt = mesh(new THREE.LatheGeometry(pts, 28), rm);
    rig.add(skirt);
    const hem = mesh(new THREE.TorusGeometry(0.69, 0.03, 8, 32), trimM, 0, 0.05, 0);
    hem.rotation.x = PI / 2;
    rig.add(hem);
  }

  // ----- neck + head
  rig.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 12), skinM, 0, 1.44, 0));
  const head = new THREE.Group();
  head.position.set(0, 1.84, 0);
  rig.add(head);
  const R = 0.4;
  const skull = mesh(new THREE.SphereGeometry(R, 32, 24), skinM);
  skull.scale.set(1, 1.05, 0.98);
  head.add(skull);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.07, 10, 8), skinM, s * R * 0.97, -0.02, 0);
    ear.scale.set(0.6, 1, 0.8);
    head.add(ear);
  }
  // face
  const white = mat('#fbfbf6', { roughness: 0.3 });
  const iris = glowEyes
    ? new THREE.MeshStandardMaterial({ color: glowEyes, emissive: glowEyes, emissiveIntensity: 1.3, roughness: 0.3 })
    : mat('#241812', { roughness: 0.25 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const browM = mat(hairColor, { roughness: 0.9 });
  for (const s of [-1, 1]) {
    const ex = s * 0.145, ey = 0.0;
    const ez = Math.sqrt(R * R - ex * ex - ey * ey) * 0.98;
    const eye = mesh(new THREE.SphereGeometry(0.078, 16, 12), white, ex, ey, ez - 0.005);
    eye.scale.set(1, 1.15, 0.55);
    const pup = mesh(new THREE.SphereGeometry(0.052, 14, 10), iris, ex, ey - 0.005, ez + 0.03);
    pup.scale.set(1, 1.1, 0.5);
    const sh = mesh(new THREE.SphereGeometry(0.014, 8, 6), shine, ex + 0.018, ey + 0.025, ez + 0.05);
    head.add(eye, pup, sh);
    const brow = mesh(new THREE.BoxGeometry(0.11, 0.022, 0.03), browM, ex, ey + 0.115, ez - 0.02);
    brow.rotation.z = s * (glowEyes ? 0.28 : 0.1);
    brow.rotation.y = s * -0.35;
    head.add(brow);
    // cheeks
    const cheek = mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#d86a5a', { roughness: 0.9, transparent: true, opacity: 0.35 }), s * 0.24, -0.12, 0.3);
    cheek.scale.set(1, 0.6, 0.3);
    head.add(cheek);
  }
  const nose = mesh(new THREE.SphereGeometry(0.045, 10, 8), skinM, 0, -0.07, R * 0.99);
  nose.scale.set(1, 0.85, 0.8);
  head.add(nose);
  const smile = mesh(new THREE.TorusGeometry(0.075, 0.011, 6, 14, PI), mat('#4a1b1b', { roughness: 0.5 }), 0, -0.14, R * 0.93);
  smile.rotation.z = PI;
  smile.rotation.x = -0.1;
  head.add(smile);
  if (fangs) {
    for (const s of [-1, 1]) {
      const f = mesh(new THREE.ConeGeometry(0.016, 0.06, 6), mat('#ffffff', { roughness: 0.2 }), s * 0.04, -0.175, R * 0.93);
      f.rotation.x = PI;
      head.add(f);
    }
  }
  if (!bareHead) head.add(makeHair(hair, hairColor, R, outfit));
  if (hat) {
    const h = makeHat(hat);
    h.position.set(0, 0.2, -0.02);
    h.rotation.x = -0.08;
    head.add(h);
  }

  // ----- arms
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.37, 1.27, 0);
    arm.rotation.z = s * 0.1;
    arm.add(mesh(new THREE.CapsuleGeometry(0.092, 0.3, 6, 12), outfitM, 0, -0.22, 0));
    arm.add(mesh(new THREE.SphereGeometry(0.088, 12, 10), skinM, 0, -0.47, 0.02));
    rig.add(arm);
    arms.push(arm);
  }
  const [armL, armR] = arms;
  const handR = new THREE.Group();
  handR.position.set(0, -0.48, 0.08);
  armR.add(handR);

  // ----- cape
  let capeG = null;
  if (cape) {
    capeG = makeCape(cape, capeLining);
    capeG.position.set(0, 0.74, -0.02);
    rig.add(capeG);
    // high collar
    for (const s of [-1, 1]) {
      const col = mesh(new THREE.ConeGeometry(0.16, 0.34, 4), mat(cape, { roughness: 0.8 }), s * 0.2, 1.52, -0.08);
      col.rotation.z = s * -0.25;
      col.rotation.x = -0.15;
      rig.add(col);
    }
  }

  root.scale.setScalar(scale);

  // ----- animation state
  let phase = 0, t = Math.random() * 10, attackT = 0, attackSide = 1, kickT = 0, hitT = 0, flashT = 0, deadT = 0, dead = false;
  const parts = { rig, head, armL, armR, legL: legs[0], legR: legs[1], handR, skirt, cape: capeG, torso };

  function update(dt, speed = 0, o = {}) {
    t += dt;
    const moving = speed > 0.15;
    phase += dt * (5 + speed * 1.2);
    const amp = moving ? Math.min(1, speed / 3.5) * 0.8 : 0;
    legs[0].rotation.x = Math.sin(phase) * amp;
    legs[1].rotation.x = -Math.sin(phase) * amp;
    armL.rotation.x = -Math.sin(phase) * amp * 0.9;
    armR.rotation.x = Math.sin(phase) * amp * 0.9;
    rig.position.y = moving ? Math.abs(Math.sin(phase)) * 0.07 : Math.sin(t * 2) * 0.012;
    head.rotation.y = Math.sin(t * 0.7) * 0.12;
    if (o.carry) armR.rotation.x = -0.95 + (moving ? Math.sin(phase * 2) * 0.05 : 0);
    if (o.raise) { armL.rotation.x = -2.5; armR.rotation.x = -2.5; }
    if (attackT > 0) {
      attackT = Math.max(0, attackT - dt * 3.4);
      (attackSide < 0 ? armL : armR).rotation.x = -Math.sin((1 - attackT) * PI) * 2.1;
    }
    if (kickT > 0) {
      kickT = Math.max(0, kickT - dt * 2.8);
      legs[1].rotation.x = -Math.sin((1 - kickT) * PI) * 1.7;
    }
    if (hitT > 0) hitT -= dt;
    if (!dead) rig.rotation.x = hitT > 0 ? -0.5 * Math.min(1, hitT / 0.3) : kickT > 0 ? Math.sin((1 - kickT) * PI) * 0.25 : 0;
    if (skirt) { skirt.rotation.y = Math.sin(phase * 0.5) * 0.05; skirt.scale.x = skirt.scale.z = 1 + (moving ? Math.sin(phase * 2) * 0.03 : 0); }
    if (capeG) capeG.rotation.x = moving ? 0.12 + Math.sin(phase) * 0.05 : Math.sin(t * 1.6) * 0.03;
    if (flashT > 0) {
      flashT -= dt;
      const k = Math.max(0, flashT / 0.25);
      for (const m of flashMats) { m.emissive.setRGB(k * 0.9, k * 0.1, k * 0.1); }
    } else if (flashMats[0].emissive.r > 0) {
      for (const m of flashMats) m.emissive.setRGB(0, 0, 0);
    }
    if (dead) {
      deadT += dt;
      rig.rotation.x = -Math.min(1, deadT * 3) * 1.45;
    }
  }

  return {
    root, parts, update,
    attack(side = 1) { attackT = 1; attackSide = side; },
    kick() { kickT = 1; },
    hit() { hitT = 0.3; flashT = 0.25; },
    flash() { flashT = 0.25; },
    setDead(v) { dead = v; deadT = 0; if (!v) rig.rotation.x = 0; },
  };
}

// ---------- props ----------
export function makeLantern(color = '#ffcf6b') {
  const g = new THREE.Group();
  const metal = mat('#2c2218', { roughness: 0.5, metalness: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 10), metal, 0, -0.14, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.05, 10), metal, 0, 0.16, 0));
  const glass = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, transparent: true, opacity: 0.9, roughness: 0.2 });
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.3, 10), glass, 0, 0.01, 0));
  const ring = mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, PI), metal, 0, 0.2, 0);
  g.add(ring);
  g.userData.glass = glass;
  return g;
}

export function makeBroom() {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), mat('#6b4a2b', { roughness: 0.8 }), 0, 0, 0);
  pole.rotation.z = PI / 2;
  g.add(pole);
  const bristles = mesh(new THREE.ConeGeometry(0.25, 0.7, 10), mat('#c9a35a', { roughness: 1 }), -1.35, 0, 0);
  bristles.rotation.z = PI / 2;
  g.add(bristles);
  return g;
}
