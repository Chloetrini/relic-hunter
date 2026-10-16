// Dressing the temple to look like the cover: carved stone heads, pillars, teal crystal clusters,
// hanging vines, floating dust and shafts of golden light. None of it is solid; it's all scenery.
import * as THREE from 'three';
import { glow } from './textures.js';
import { boxGeo } from './level.js';

const PI = Math.PI;

export function dressTemple(scene, L, { low = false } = {}) {
  const wallTex = L.tex.wall, rockTex = L.tex.rock;
  const stone = (rw = 1, rh = 1, tint = '#ffffff') => {
    const map = wallTex.map.clone(), normalMap = wallTex.normalMap.clone();
    for (const t of [map, normalMap]) { t.repeat.set(rw, rh); t.needsUpdate = true; }
    return new THREE.MeshStandardMaterial({ map, normalMap, color: tint, roughness: 0.95 });
  };
  const rockMat = new THREE.MeshStandardMaterial({ map: rockTex.map, normalMap: rockTex.normalMap, color: '#b49a78', roughness: 1 });
  const add = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
  const updaters = [];

  // ---- carved stone heads set into the walls, facing the hall
  const headMat = stone(1, 1, '#c9ad85');
  function stoneHead(x, y, z, face) {
    const g = new THREE.Group();
    const box = (w, h, d, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), headMat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    box(1.3, 1.6, 0.9, 0, 0, 0);                 // head
    box(1.6, 0.5, 1.0, 0, 1.0, 0);               // headdress band
    box(1.2, 0.5, 0.9, 0, 1.45, -0.05);          // headdress top
    box(1.4, 0.16, 0.25, 0, 0.42, 0.5);          // brow
    box(0.3, 0.55, 0.3, 0, 0.05, 0.55);          // nose
    box(0.7, 0.14, 0.2, 0, -0.42, 0.48);         // lips
    for (const s of [-1, 1]) {
      box(0.32, 0.12, 0.12, s * 0.33, 0.25, 0.47);  // closed eyes
      box(0.22, 0.7, 0.4, s * 0.76, 0.05, 0);       // ears
      box(0.18, 0.3, 0.3, s * 0.78, -0.4, 0.05);    // ear spools
    }
    box(1.5, 0.4, 1.0, 0, -1.0, 0);              // chin plinth
    g.position.set(x, y, z);
    g.rotation.y = face;
    scene.add(g);
  }
  for (const [x, z] of [[-6.2, -12], [6.2, -12], [-6.2, -29], [6.2, -29], [-6.2, -52], [6.2, -66]]) stoneHead(x, 4.6, z, x < 0 ? PI / 2 : -PI / 2);
  stoneHead(0, 4.4, -96.3, 0);                   // above the idol, watching over it

  // ---- pillars with glyph bands along the idol corridor
  for (const z of [-74, -80, -86, -92]) for (const x of [-2.75, 2.75]) {
    const p = add(new THREE.Mesh(boxGeo(0.7, 6.5, 0.7, 1.6), stone(1, 1)));
    p.position.set(x, 3.25, z);
    L.solids.push({ x0: x - 0.35, x1: x + 0.35, y0: 0, y1: 6.5, z0: z - 0.35, z1: z + 0.35, mesh: p });
    const cap = add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 1), stone(1, 1, '#b89a72')));
    cap.position.set(x, 6.4, z);
  }

  // ---- rubble along the walls
  const rubbleGeo = new THREE.DodecahedronGeometry(0.3, 0);
  const rubble = new THREE.InstancedMesh(rubbleGeo, rockMat, 70);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  let n = 0;
  const spots = [[-5.5, 5.5, -7, 3], [-5.5, 5.5, -39, -15], [-5.5, 5.5, -69, -61], [-2.6, 2.6, -95, -71]];
  for (let i = 0; i < 70; i++) {
    const [x0, x1, z0, z1] = spots[i % spots.length];
    const side = Math.random() < 0.5 ? x0 : x1;
    pos.set(side + (side < 0 ? Math.random() * 0.5 : -Math.random() * 0.5), 0.1, z0 + Math.random() * (z1 - z0));
    e.set(Math.random() * PI, Math.random() * PI, 0); q.setFromEuler(e);
    const s = 0.4 + Math.random() * 0.9; sc.set(s, s * 0.7, s);
    rubble.setMatrixAt(n++, m4.compose(pos, q, sc));
  }
  rubble.castShadow = true; rubble.receiveShadow = true;
  scene.add(rubble);

  // ---- teal crystal clusters glowing in the corners
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#6ff6e8', emissive: '#17b8ab', emissiveIntensity: 1.8, roughness: 0.1, metalness: 0.05, flatShading: true, transparent: true, opacity: 0.92 });
  const shard = new THREE.CylinderGeometry(0, 0.16, 1, 6, 1).translate(0, 0.5, 0);
  const glowT = glow();
  const crystals = [];
  function cluster(x, z, size = 1, light = false) {
    const g = new THREE.Group();
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(shard, crystalMat);
      const h = (0.5 + Math.random() * 1.1) * size;
      m.scale.set(size * (0.7 + Math.random() * 0.6), h, size * (0.7 + Math.random() * 0.6));
      m.position.set((Math.random() - 0.5) * 0.5 * size, 0, (Math.random() - 0.5) * 0.5 * size);
      m.rotation.set((Math.random() - 0.5) * 0.9, Math.random() * PI, (Math.random() - 0.5) * 0.9);
      g.add(m);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#2fe0d0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    halo.position.y = 0.5 * size; halo.scale.setScalar(2.4 * size); g.add(halo);
    g.position.set(x, 0, z);
    scene.add(g);
    if (light) { const l = new THREE.PointLight('#34e3d2', 7, 6, 2); l.position.set(x, 0.9, z); scene.add(l); }
    crystals.push({ halo, seed: Math.random() * 10 });
  }
  for (const [x, z, s, l] of [[-5.6, 2.5, 1.1, true], [5.5, -9, 0.8], [-5.6, -17, 0.9], [5.5, -37.5, 1.2, true], [-5.9, -60.6, 0.9], [5.5, -68.8, 1.1, true], [-2.6, -94.5, 1], [2.6, -95, 0.9, true], [2.6, -71.5, 0.7]]) {
    cluster(x, z, s, l && !low);
  }

  // ---- hanging vines down the walls, swaying a little
  const vineMat = new THREE.MeshStandardMaterial({ color: '#3f5a22', roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4f7a2a', roughness: 0.8, side: THREE.DoubleSide });
  const leafGeo = new THREE.PlaneGeometry(0.22, 0.12);
  const vines = [];
  function vine(x, z, len) {
    const pts = [];
    const dir = x < 0 ? 1 : -1;
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(x + dir * (0.05 + Math.sin(t * 5) * 0.08), 7 - t * len, z + Math.sin(t * 3 + z) * 0.25)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 5), vineMat));
    for (let i = 0; i < 14; i++) {
      const p = curve.getPoint(Math.random());
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.copy(p); leaf.rotation.set(Math.random() * PI, Math.random() * PI, Math.random() * PI);
      g.add(leaf);
    }
    scene.add(g);
    vines.push({ g, seed: Math.random() * 10, x, top: 7 });
  }
  for (const [x, z, len] of [[-6.25, -3, 4.5], [6.25, -7, 5.5], [-6.25, -19, 5], [6.25, -25, 4], [-6.25, -38, 5.5], [6.25, -44, 4.5], [-6.25, -58, 5], [6.25, -62, 5.5], [-3.05, -78, 4.5], [3.05, -84, 5], [-3.05, -90, 5.5]]) vine(x, z, len);

  // ---- floating golden dust, lit by the torches
  const dustCount = low ? 260 : 700;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(dustCount * 3), dv = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const z = 4 - Math.random() * 100, wide = z < -70 ? 2.8 : 5.8;
    dp[i * 3] = (Math.random() * 2 - 1) * wide; dp[i * 3 + 1] = Math.random() * 6.5; dp[i * 3 + 2] = z; dv[i] = Math.random();
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: glowT, color: '#ffcf8a', size: 0.09, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  scene.add(dust);

  // ---- shafts of light falling through cracks in the ceiling
  const shaftMat = new THREE.MeshBasicMaterial({ color: '#ffd59a', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
  const shafts = [];
  for (const [x, z, r] of [[1.5, -16, 1.1], [-2, -30, 0.9], [2, -56, 1.0], [0, -88, 1.3], [-1, -4, 0.8]]) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r, 9, 18, 1, true), shaftMat.clone());
    cone.position.set(x, 4, z); cone.rotation.z = 0.12; cone.rotation.x = -0.08;
    scene.add(cone);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    spot.position.set(x + 0.5, 0.02, z - 0.3);
    scene.add(spot);
    shafts.push({ cone, seed: Math.random() * 10 });
  }

  // ---- bright opening at the far end of the idol room (the way the light comes in)
  const opening = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.0 }));
  opening.visible = false;
  const backGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#ffb866', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  backGlow.position.set(0, 3, -95.8); backGlow.scale.set(8, 6, 1);
  scene.add(opening, backGlow);

  return {
    update(dt, t) {
      // dust drifts up slowly and wraps around
      const p = dustGeo.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        let y = p.getY(i) + dt * (0.08 + dv[i] * 0.12);
        if (y > 6.6) y = 0;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.5 + dv[i] * 20) * dt * 0.05);
      }
      p.needsUpdate = true;
      for (const c of crystals) c.halo.material.opacity = 0.4 + Math.sin(t * 1.5 + c.seed) * 0.12;
      for (const s of shafts) s.cone.material.opacity = 0.06 + Math.sin(t * 0.4 + s.seed) * 0.015;
    },
  };
}
