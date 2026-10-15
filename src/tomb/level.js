// The temple: three rooms laid out along -z. Every solid block is both a mesh and a collider.
import * as THREE from 'three';

const PI = Math.PI;

function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const TEX = {
  wall: () => canvasTex((g, s) => {
    g.fillStyle = '#8a6e4e'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
      const x = c * 64 + (r % 2 ? 32 : 0), y = r * 32;
      g.fillStyle = ['#94785a', '#7f6447', '#8c7052', '#9a7e5e'][(r * 3 + c) % 4];
      g.fillRect(x + 2, y + 2, 60, 28);
    }
    g.fillStyle = 'rgba(40,60,30,.35)';
    for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(Math.random() * s, s - Math.random() * 60, 4 + Math.random() * 10, 0, PI * 2); g.fill(); }
  }),
  floor: () => canvasTex((g, s) => {
    g.fillStyle = '#6e5a44'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      g.fillStyle = ['#7a654c', '#715d46', '#806a50'][(r + c * 2) % 3];
      g.fillRect(c * 64 + 2, r * 64 + 2, 60, 60);
    }
  }),
};

export function buildLevel(scene) {
  const L = { solids: [], gems: [], keys: [], spikes: [], blades: [], torches: [], doors: {} };
  const base = { wall: TEX.wall(), floor: TEX.floor() };

  function material(kind, rw, rh) {
    const t = base[kind].clone();
    t.repeat.set(Math.max(1, rw), Math.max(1, rh));
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  }

  function solid(x0, x1, y0, y1, z0, z1, kind = 'wall') {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(kind, Math.round(Math.max(w, d) / 2.5), Math.round(h / 2.5) || 1));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const s = { x0, x1, y0, y1, z0, z1, mesh: m };
    L.solids.push(s);
    return s;
  }
  const floor = (x0, x1, z0, z1, top = 0, thick = 2) => solid(x0, x1, top - thick, top, z0, z1, 'floor');

  // ---------------- Room 1: entrance hall
  floor(-6, 6, -8, 4);
  floor(-1.2, 1.2, -12.2, -9.8);              // stepping stone over the first pit
  floor(-6, 6, -40, -14);                     // main floor (ledge sits on it)
  solid(-6, 6, 0, 2.1, -26, -22, 'wall');     // ledge you must climb
  // ---------------- Room 2: spikes, blades, keys
  floor(-4, 4, -50, -40);                     // spike corridor
  floor(-6.3, -4, -47, -43);                  // side alcove
  solid(-6.2, -4.6, 0, 1.9, -45.8, -44.2);    // key 1 pillar
  floor(-1, 1, -60, -50, 0, 0.6);             // narrow bridge
  floor(3, 5.5, -58.5, -55.5);                // key 2 platform
  floor(-6, 6, -70, -60);
  solid(-5.6, -3.4, 0, 2.2, -67.2, -64.8);    // key 3 pillar
  // ---------------- Room 3: idol corridor
  floor(-3, 3, -96, -70);
  solid(-0.8, 0.8, 0, 1, -91, -89);           // pedestal

  // walls
  for (const x of [-6.6, 6.6]) solid(x - 0.3, x + 0.3, -2, 7, -70, 4.3);
  for (const x of [-3.4, 3.4]) solid(x - 0.3, x + 0.3, -2, 7, -96.5, -70.6);
  solid(-6.9, 6.9, -2, 7, 4.3, 4.9);
  solid(-3.7, 3.7, -2, 7, -97.1, -96.5);
  solid(-6.9, -3.1, -2, 7, -71, -70.6); solid(3.1, 6.9, -2, 7, -71, -70.6);
  solid(-6.9, -6, 0, 7, -34.6, -34); solid(6, 6.9, 0, 7, -34.6, -34);

  // doors (move up when opened)
  const gate = solid(-6, 6, 0, 4.6, -34.6, -34);
  const vault = solid(-3.1, 3.1, 0, 4.6, -70.6, -70);
  gate.mesh.material.color.set('#b9a27a'); vault.mesh.material.color.set('#c8a55a');
  L.doors = { gate: { s: gate, open: 0, opening: false }, vault: { s: vault, open: 0, opening: false } };

  // abyss below
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#050302' }));
  abyss.position.y = -14; scene.add(abyss);

  // ---------------- lever on the ledge
  const lever = new THREE.Group();
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#5a4632' }));
  lb.position.y = 0.25; lever.add(lb);
  const handle = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), new THREE.MeshStandardMaterial({ color: '#c9a050', metalness: 0.7, roughness: 0.3 }));
  rod.position.y = 0.55; handle.add(rod);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: '#e04a2a' }));
  knob.position.y = 1.1; handle.add(knob);
  handle.position.y = 0.45; handle.rotation.x = 0.7;
  lever.add(handle);
  lever.position.set(3, 2.1, -24);
  scene.add(lever);
  L.lever = { group: lever, handle, pos: new THREE.Vector3(3, 2.1, -24) };

  // ---------------- collectibles
  const gemGeo = new THREE.OctahedronGeometry(0.28);
  const gemMat = new THREE.MeshStandardMaterial({ color: '#3ad1c8', emissive: '#1a8c86', emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.3 });
  for (const [x, y, z] of [[0, 0, -2], [-3, 0, -5], [3, 0, -5], [0, 0, -11], [-3, 0, -18], [3, 0, -18], [0, 2.1, -24], [-2, 0, -30], [2, 0, -38], [0, 0, -45.7], [0, 0, -52], [0, 0, -58.5], [3, 0, -63], [-1.5, 0, -80], [1.5, 0, -85]]) {
    const m = new THREE.Mesh(gemGeo, gemMat);
    m.position.set(x, y + 0.8, z); m.castShadow = true;
    scene.add(m);
    L.gems.push({ m, base: y + 0.8, taken: false });
  }
  const keyMat = new THREE.MeshStandardMaterial({ color: '#ffd04a', emissive: '#b88a10', emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.25 });
  for (const [x, y, z] of [[-5.4, 1.9, -45], [4.25, 0, -57], [-4.5, 2.2, -66]]) {
    const k = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), keyMat); ring.position.y = 0.3; k.add(ring);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), keyMat); k.add(shaft);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.08), keyMat); tooth.position.set(0.08, -0.18, 0); k.add(tooth);
    k.position.set(x, y + 0.9, z);
    scene.add(k);
    L.keys.push({ m: k, base: y + 0.9, taken: false });
  }
  // idol
  const idol = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcc3a', emissive: '#8a5a00', emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.2 });
  const ib = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.5, 10), gold); ib.position.y = 0.25; idol.add(ib);
  const ih = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), gold); ih.position.y = 0.62; idol.add(ih);
  idol.position.set(0, 1, -90);
  scene.add(idol);
  const idolLight = new THREE.PointLight('#ffcc66', 10, 6, 2);
  idolLight.position.set(0, 2.2, -90); scene.add(idolLight);
  L.idol = { group: idol, pos: new THREE.Vector3(0, 1, -90), light: idolLight };

  // ---------------- spikes
  const spikeGeo = new THREE.ConeGeometry(0.16, 0.7, 6);
  const spikeMat = new THREE.MeshStandardMaterial({ color: '#b9b4ab', metalness: 0.7, roughness: 0.35 });
  [[-43, 0], [-46.2, 1.3], [-49.2, 2.6]].forEach(([zc, phase]) => {
    const g = new THREE.Group();
    for (let x = -3.6; x <= 3.6; x += 0.6) for (let dz = -0.6; dz <= 0.6; dz += 0.6) {
      const sp = new THREE.Mesh(spikeGeo, spikeMat); sp.position.set(x, 0.35, zc + dz); g.add(sp);
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 1.8), new THREE.MeshStandardMaterial({ color: '#3a2c20' }));
    plate.position.set(0, 0.02, zc); scene.add(plate);
    scene.add(g);
    L.spikes.push({ g, x0: -4, x1: 4, z0: zc - 0.9, z1: zc + 0.9, phase, up: false });
  });

  // ---------------- swinging blades over the bridge
  for (const [z, phase] of [[-53.5, 0], [-56.5, 1.6]]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 5.4, z);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 6), new THREE.MeshStandardMaterial({ color: '#555' }));
    arm.position.y = -2.1; pivot.add(arm);
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 20, 1, false, 0, PI), new THREE.MeshStandardMaterial({ color: '#d0d4da', metalness: 0.9, roughness: 0.2 }));
    blade.rotation.z = PI / 2; blade.rotation.y = PI / 2; blade.position.y = -4.2;
    pivot.add(blade);
    scene.add(pivot);
    L.blades.push({ pivot, z, phase, len: 4.4 });
  }

  // ---------------- torches
  for (const [x, z] of [[-6.2, -6], [6.2, -20], [-6.2, -32], [6.2, -47], [-6.2, -63], [3, -83]]) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6), new THREE.MeshStandardMaterial({ color: '#3a2a1a' }));
    stick.rotation.z = x < 0 ? -0.4 : 0.4; g.add(stick);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
    flame.position.set(x < 0 ? 0.15 : -0.15, 0.5, 0); g.add(flame);
    g.position.set(x, 3, z);
    scene.add(g);
    const light = new THREE.PointLight('#ff9a3c', 22, 16, 2);
    light.position.set(x < 0 ? x + 0.6 : x - 0.6, 3.6, z);
    scene.add(light);
    L.torches.push({ flame, light, seed: Math.random() * 10 });
  }

  // ---------------- boulder
  const boulder = new THREE.Mesh(new THREE.SphereGeometry(1.9, 24, 18), material('wall', 2, 2));
  boulder.castShadow = true;
  boulder.visible = false;
  scene.add(boulder);
  L.boulder = { m: boulder, start: new THREE.Vector3(0, 1.9, -94.5), active: false, r: 1.9 };
  boulder.position.copy(L.boulder.start);

  L.checkpoints = [
    { z: 99, pos: new THREE.Vector3(0, 0, 2) },
    { z: -28, pos: new THREE.Vector3(0, 0, -29) },
    { z: -61, pos: new THREE.Vector3(0, 0, -62) },
    { z: -73, pos: new THREE.Vector3(0, 0, -74) },
  ];
  L.totalGems = L.gems.length;
  return L;
}
