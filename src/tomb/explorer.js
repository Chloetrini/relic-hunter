// An adult explorer with real proportions (about 1.8 m tall), elbows and knees, and adventure gear.
// Same interface as the shared humanoid: { root, parts, update(dt, speed, opts), attack(side), hit(), flash(), setDead(v) }.
import * as THREE from 'three';

const PI = Math.PI;
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
function mesh(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; }
const cap = (r, len, m, y) => mesh(new THREE.CapsuleGeometry(r, len, 6, 12), m, 0, y, 0);

function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k).getStyle(); }

export function buildExplorer(opts = {}) {
  const skin = opts.skin || '#8d5a36';
  const hairColor = opts.hairColor || '#17120f';
  const top = opts.outfit || '#2e86ab';
  const hair = opts.hair || 'braids';

  const flashMats = [];
  const track = (m) => { flashMats.push(m); return m; };
  const skinM = track(mat(skin, { roughness: 0.5 }));
  const topM = track(mat(top, { roughness: 0.75 }));
  const pantsM = track(mat('#6b5b3e', { roughness: 0.9 }));
  const bootM = track(mat('#3b2716', { roughness: 0.7 }));
  const gearM = mat('#4a3320', { roughness: 0.6 });
  const gloveM = mat('#2a1f18', { roughness: 0.7 });
  const hairM = mat(hairColor, { roughness: 0.85 });

  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);

  // ---------- legs (hip -> knee -> boot)
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.095, -0.02, 0); hips.add(hip);
    hip.add(cap(0.068, 0.3, pantsM, -0.2));
    const holster = mesh(new THREE.BoxGeometry(0.05, 0.16, 0.11), gearM, s * 0.075, -0.2, 0.01); hip.add(holster);
    const knee = new THREE.Group(); knee.position.y = -0.43; hip.add(knee);
    knee.add(cap(0.052, 0.3, pantsM, -0.19));
    const boot = new THREE.Group(); boot.position.y = -0.41; knee.add(boot);
    boot.add(mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.14, 12), bootM, 0, 0.0, 0));
    const toe = mesh(new THREE.CapsuleGeometry(0.052, 0.12, 4, 10), bootM, 0, -0.07, 0.06); toe.rotation.x = PI / 2; boot.add(toe);
    legs.push({ hip, knee });
  }
  hips.add(mesh(new THREE.SphereGeometry(0.15, 18, 12), pantsM, 0, 0.02, 0)).scale.set(1, 0.62, 0.72);
  const belt = mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 24), gearM, 0, 0.07, 0); belt.rotation.x = PI / 2; belt.scale.set(1, 0.72, 1); hips.add(belt);

  // ---------- torso (spine -> chest -> neck -> head)
  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  const prof = [[0.12, 0], [0.122, 0.07], [0.106, 0.17], [0.125, 0.27], [0.145, 0.36], [0.14, 0.43], [0.11, 0.48], [0.05, 0.51]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = mesh(new THREE.LatheGeometry(prof, 24), topM); torso.scale.z = 0.68; spine.add(torso);
  // backpack + straps
  const pack = mesh(new THREE.BoxGeometry(0.2, 0.24, 0.09), gearM, 0, 0.3, -0.13); spine.add(pack);
  for (const s of [-1, 1]) { const strap = mesh(new THREE.BoxGeometry(0.025, 0.3, 0.2), gearM, s * 0.08, 0.32, -0.01); spine.add(strap); }
  const neck = mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.1, 10), skinM, 0, 0.55, 0); spine.add(neck);

  const head = new THREE.Group(); head.position.y = 0.67; spine.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.105, 24, 18), skinM); skull.scale.set(0.92, 1.12, 1.0); head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.075, 16, 12), skinM, 0, -0.055, 0.02); jaw.scale.set(1, 0.85, 1); head.add(jaw);
  // face
  const eyeW = mat('#f4efe6', { roughness: 0.3 }), iris = mat('#2b1a10', { roughness: 0.25 });
  const browM = mat(hairColor, { roughness: 0.9 });
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.SphereGeometry(0.017, 10, 8), eyeW, s * 0.037, 0.012, 0.088); w.scale.set(1.35, 0.7, 0.5); head.add(w);
    const i = mesh(new THREE.SphereGeometry(0.0105, 10, 8), iris, s * 0.037, 0.012, 0.096); i.scale.set(1, 1, 0.5); head.add(i);
    const b = mesh(new THREE.BoxGeometry(0.038, 0.006, 0.01), browM, s * 0.038, 0.04, 0.092); b.rotation.z = s * -0.12; head.add(b);
    const ear = mesh(new THREE.SphereGeometry(0.02, 8, 6), skinM, s * 0.096, 0, 0); ear.scale.set(0.5, 1, 0.8); head.add(ear);
  }
  const nose = mesh(new THREE.ConeGeometry(0.014, 0.04, 8), skinM, 0, -0.012, 0.104); nose.rotation.x = PI / 2 + 0.3; head.add(nose);
  const lipM = mat(shade(skin, 0.7), { roughness: 0.4 });
  const lips = mesh(new THREE.SphereGeometry(0.02, 10, 6), lipM, 0, -0.05, 0.088); lips.scale.set(1.3, 0.38, 0.5); head.add(lips);

  // hair
  const capGeo = new THREE.SphereGeometry(0.112, 24, 16, 0, PI * 2, 0, PI * 0.52);
  const hairCap = mesh(capGeo, hairM, 0, 0.012, -0.006); hairCap.scale.set(0.95, 1.12, 1.04); head.add(hairCap);
  const back = mesh(new THREE.SphereGeometry(0.11, 18, 12), hairM, 0, -0.005, -0.03); back.scale.set(0.95, 1.05, 0.9); head.add(back);
  let braid = null;
  if (hair === 'braids' || hair === 'short' && false) {
    braid = new THREE.Group(); braid.position.set(0, -0.02, -0.1); head.add(braid);
    let parent = braid;
    for (let k = 0; k < 7; k++) {
      const seg = new THREE.Group(); seg.position.set(0, k ? -0.055 : 0, 0); parent.add(seg);
      seg.add(mesh(new THREE.SphereGeometry(0.03 - k * 0.002, 10, 8), hairM));
      parent = seg;
    }
    parent.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), gearM, 0, -0.03, 0));
  } else if (hair === 'afro') {
    const a = mesh(new THREE.SphereGeometry(0.155, 20, 14), hairM, 0, 0.05, -0.04); a.scale.set(1, 0.92, 0.95); head.add(a);
  } else if (hair === 'puffs') {
    head.add(mesh(new THREE.SphereGeometry(0.06, 14, 10), hairM, 0, 0.12, -0.06));
  } else if (hair === 'wrap') {
    const band = mesh(new THREE.TorusGeometry(0.108, 0.018, 8, 24), topM, 0, 0.05, -0.005); band.rotation.x = PI / 2 + 0.2; head.add(band);
    head.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), topM, 0, 0.03, -0.12));
  }

  // ---------- arms (shoulder -> elbow -> hand)
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.19, 0.44, 0); spine.add(sh);
    sh.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), topM));
    sh.add(cap(0.04, 0.2, skinM, -0.14));
    const elbow = new THREE.Group(); elbow.position.y = -0.29; sh.add(elbow);
    elbow.add(cap(0.034, 0.18, skinM, -0.12));
    const hand = new THREE.Group(); hand.position.y = -0.26; elbow.add(hand);
    hand.add(mesh(new THREE.SphereGeometry(0.042, 10, 8), gloveM)).scale.set(0.8, 1.1, 1);
    arms.push({ sh, elbow, hand, side: s });
  }

  // ---------- animation
  let ph = 0, t = Math.random() * 10, aimT = 0, kickSide = 1, kickT = 0, hitT = 0, flashT = 0, dead = false, deadT = 0;
  const lerp = (a, b, k) => a + (b - a) * k;

  function update(dt, speed = 0, o = {}) {
    t += dt;
    const amp = Math.min(1, speed / 6.5);
    if (speed > 0.2) ph += dt * (5 + speed * 1.05);
    const sn = Math.sin(ph);
    const [L, Rl] = legs;
    const [AL, AR] = arms;
    const k = Math.min(1, dt * 14);

    // targets
    let lhx = -sn * 0.95 * amp, rhx = sn * 0.95 * amp;
    let lkx = (0.15 + 1.0 * Math.max(0, Math.sin(ph + 1.3))) * amp + 0.05, rkx = (0.15 + 1.0 * Math.max(0, Math.sin(ph + 1.3 + PI))) * amp + 0.05;
    let alx = sn * 0.75 * amp, arx = -sn * 0.75 * amp, ale = -(0.35 + 0.55 * amp), are = -(0.35 + 0.55 * amp);
    let alz = -0.12, arz = 0.12;
    let lean = 0.14 * amp, bob = Math.abs(sn) * 0.045 * amp - 0.025 * amp;

    if (o.air) { lhx = -0.75; lkx = 1.2; rhx = 0.25; rkx = 0.5; alx = -0.6; arx = -0.9; ale = -0.6; are = -0.4; lean = 0.05; bob = 0; }
    if (o.raise) { alx = arx = -2.9; ale = are = -0.25; lhx = -0.5; lkx = 1.1; rhx = -0.2; rkx = 0.6; lean = -0.1; bob = 0; }
    if (aimT > 0) {
      aimT -= dt;
      const recoil = Math.max(0, kickT) * 0.6; kickT -= dt * 6;
      alx = -1.5 + (kickSide < 0 ? recoil : 0); arx = -1.5 + (kickSide > 0 ? recoil : 0);
      ale = are = -0.05; alz = 0.15; arz = -0.15;
    }
    if (speed <= 0.2 && !o.air && !o.raise) {
      const br = Math.sin(t * 1.8) * 0.015;
      lhx = rhx = 0; lkx = rkx = 0.06; lean = br; bob = br * 0.5;
      if (aimT <= 0) { alx = arx = 0.05; ale = are = -0.25; }
    }

    L.hip.rotation.x = lerp(L.hip.rotation.x, lhx, k); Rl.hip.rotation.x = lerp(Rl.hip.rotation.x, rhx, k);
    L.knee.rotation.x = lerp(L.knee.rotation.x, lkx, k); Rl.knee.rotation.x = lerp(Rl.knee.rotation.x, rkx, k);
    AL.sh.rotation.x = lerp(AL.sh.rotation.x, alx, k); AR.sh.rotation.x = lerp(AR.sh.rotation.x, arx, k);
    AL.sh.rotation.z = lerp(AL.sh.rotation.z, alz, k); AR.sh.rotation.z = lerp(AR.sh.rotation.z, arz, k);
    AL.elbow.rotation.x = lerp(AL.elbow.rotation.x, ale, k); AR.elbow.rotation.x = lerp(AR.elbow.rotation.x, are, k);
    spine.rotation.x = lerp(spine.rotation.x, lean + (hitT > 0 ? -0.35 : 0), k);
    spine.rotation.y = Math.sin(ph) * 0.12 * amp;
    hips.position.y = 0.95 + bob;
    if (braid) { braid.rotation.x = 0.25 + amp * 0.5 + Math.sin(t * 3) * 0.05; braid.rotation.z = Math.sin(ph) * 0.25 * amp; }
    if (hitT > 0) hitT -= dt;

    if (flashT > 0) { flashT -= dt; const f = Math.max(0, flashT / 0.25); for (const m of flashMats) m.emissive.setRGB(f * 0.8, f * 0.1, f * 0.08); }
    else if (flashMats[0].emissive.r > 0) for (const m of flashMats) m.emissive.setRGB(0, 0, 0);

    if (dead) {
      deadT += dt;
      const d = Math.min(1, deadT * 2.5);
      hips.rotation.x = -d * 1.45; hips.position.y = 0.95 - d * 0.75;
    } else if (hips.rotation.x !== 0) { hips.rotation.x = 0; }
  }

  return {
    root,
    parts: { handR: arms[1].hand, handL: arms[0].hand, head, spine },
    update,
    attack(side = 1) { aimT = 0.45; kickSide = side; kickT = 1; },
    hit() { hitT = 0.3; flashT = 0.25; },
    flash() { flashT = 0.25; },
    setDead(v) { dead = v; deadT = 0; if (!v) { hips.rotation.x = 0; hips.position.y = 0.95; } },
  };
}
