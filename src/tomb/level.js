// The temple: three rooms laid out along -z. Every solid block is both a mesh and a collider.
import * as THREE from 'three';
import { stoneWall, stoneFloor, rock, flame as flameTex, glow as glowTex } from './textures.js';

const PI = Math.PI;

// A box whose texture keeps the same real size on every face (one tile = `tile` units), so long
// floors and tall walls aren't stretched.
export function boxGeo(w, h, d, tile = 2.5) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * size[f][0] / tile, uv.getY(i) * size[f][1] / tile);
  }
  return g;
}

export function buildLevel(scene) {
  const L = { solids: [], gems: [], keys: [], spikes: [], blades: [], torches: [], doors: {} };
  const base = { wall: stoneWall(), floor: stoneFloor(), rock: rock() };
  L.tex = base;

  // one material per size, sharing the textures (each with its own repeat)
  const mats = new Map();
  function material(kind, rw, rh) {
    rw = Math.max(1, rw); rh = Math.max(1, rh);
    const key = `${kind}|${rw}|${rh}`;
    if (mats.has(key)) return mats.get(key);
    const map = base[kind].map.clone(), normalMap = base[kind].normalMap.clone();
    for (const t of [map, normalMap]) { t.repeat.set(rw, rh); t.needsUpdate = true; }
    const m = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.92, metalness: 0 });
    mats.set(key, m);
    return m;
  }

  function solid(x0, x1, y0, y1, z0, z1, kind = 'wall') {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const m = new THREE.Mesh(boxGeo(w, h, d, kind === 'floor' ? 3 : 2.5), material(kind, 1, 1));
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
  for (const [d, tint] of [[gate, '#d9c39a'], [vault, '#e8c77a']]) { d.mesh.material = d.mesh.material.clone(); d.mesh.material.color.set(tint); }
  L.doors = { gate: { s: gate, open: 0, opening: false }, vault: { s: vault, open: 0, opening: false } };

  // abyss below
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#0a0604' }));
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
  const gemGeo = new THREE.OctahedronGeometry(0.26, 0).scale(0.8, 1.45, 0.8);
  const gemMat = new THREE.MeshStandardMaterial({ color: '#5ff5e6', emissive: '#19c6b8', emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.1, flatShading: true });
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
  const dark = new THREE.MeshStandardMaterial({ color: '#3a2508', metalness: 0.6, roughness: 0.5 });
  const ib = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.32, 12), gold); ib.position.y = 0.16; idol.add(ib);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.12, 12), gold); neck.position.y = 0.37; idol.add(neck);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), gold); face.scale.set(0.9, 1.15, 0.85); face.position.y = 0.6; idol.add(face);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.12, 4, 1), gold); crown.rotation.y = PI / 4; crown.position.y = 0.82; idol.add(crown);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), gold); plume.position.y = 0.95; idol.add(plume);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.02), dark); eye.position.set(sx * 0.06, 0.64, 0.142); idol.add(eye);
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), gold); ear.position.set(sx * 0.165, 0.6, 0); idol.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.05), gold); nose.position.set(0, 0.58, 0.15); idol.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.02), dark); mouth.position.set(0, 0.5, 0.138); idol.add(mouth);
  const eyeGlow = new THREE.MeshBasicMaterial({ color: '#7ff8ee' });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeGlow); e.position.set(sx * 0.06, 0.64, 0.152); idol.add(e); }
  idol.position.set(0, 1, -90);
  scene.add(idol);
  const idolLight = new THREE.PointLight('#ffcc66', 14, 7, 2);
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

  // ---------------- fire bowls: stone stand, bronze bowl, layered flame sprites
  const fireTex = flameTex(), glowT = glowTex();
  const bowlMat = new THREE.MeshStandardMaterial({ color: '#6b4a24', metalness: 0.7, roughness: 0.45 });
  for (const [x, z] of [[-5.6, -6], [5.6, -20], [-5.6, -32], [5.4, -38.5], [-5.6, -63], [2.5, -83], [-2.5, -76]]) {
    const g = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.6, 8), material('wall', 1, 1));
    stand.position.y = 0.8; stand.castShadow = true; stand.receiveShadow = true; g.add(stand);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.3, 14, 1, true), bowlMat);
    bowl.position.y = 1.75; bowl.material.side = THREE.DoubleSide; g.add(bowl);
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.38, 14).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7a1a' }));
    coals.position.y = 1.86; g.add(coals);
    const flames = [];
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: k ? '#ffb05a' : '#fff0c0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.position.set((k - 1) * 0.12, 2.35, (k % 2) * 0.08);
      sp.scale.set(0.55 - k * 0.08, 1.1 - k * 0.15, 1);
      g.add(sp); flames.push(sp);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#ff8a2a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    halo.position.y = 2.2; halo.scale.setScalar(2.6); g.add(halo);
    g.position.set(x, 0, z);
    scene.add(g);
    const light = new THREE.PointLight('#ff9440', 26, 15, 1.8);
    light.position.set(x, 2.6, z);
    scene.add(light);
    // the stand is solid (you can't walk through it)
    L.solids.push({ x0: x - 0.3, x1: x + 0.3, y0: 0, y1: 1.6, z0: z - 0.3, z1: z + 0.3, mesh: stand });
    L.torches.push({ flame: flames[0], flames, halo, light, seed: Math.random() * 10, pos: new THREE.Vector3(x, 2.3, z) });
  }

  // ---------------- boulder
  const bGeo = new THREE.IcosahedronGeometry(1.9, 4);
  { // lumpy rock, not a perfect ball
    const p = bGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 2.1) * Math.sin(v.y * 2.7 + 1) * Math.sin(v.z * 1.9 + 2) * 0.09 + Math.sin(v.x * 6 + v.z * 5) * 0.025;
      v.multiplyScalar(1 + n); p.setXYZ(i, v.x, v.y, v.z);
    }
    bGeo.computeVertexNormals();
  }
  const boulder = new THREE.Mesh(bGeo, material('rock', 2, 2));
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
