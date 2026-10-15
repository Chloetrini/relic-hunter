import * as THREE from 'three';

// Tiny particle + shockwave system shared by everything in the witch game.
export function createFx(scene) {
  const geo = new THREE.SphereGeometry(1, 6, 5);
  const mats = new Map();
  const matFor = (c) => { if (!mats.has(c)) mats.set(c, new THREE.MeshBasicMaterial({ color: c })); return mats.get(c); };
  const parts = [];
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2);

  return {
    burst(pos, color = '#ffcf6b', n = 12, speed = 4, size = 0.14, life = 0.6) {
      for (let i = 0; i < n && parts.length < 400; i++) {
        const m = new THREE.Mesh(geo, matFor(color));
        m.position.copy(pos);
        m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.6);
        parts.push({ m, vx: Math.cos(a) * s, vy: Math.random() * speed * 0.7, vz: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6) });
        scene.add(m);
      }
    },
    ring(pos, color = '#ffcf6b', maxR = 8, dur = 0.5) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set(pos.x, 0.15, pos.z);
      m.scale.setScalar(0.1);
      scene.add(m);
      rings.push({ m, t: 0, dur, maxR });
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        p.vy -= 9 * dt;
        p.m.position.x += p.vx * dt;
        p.m.position.y = Math.max(0.05, p.m.position.y + p.vy * dt);
        p.m.position.z += p.vz * dt;
        p.m.scale.multiplyScalar(Math.max(0, 1 - dt * 1.4));
        if (p.life <= 0) { scene.remove(p.m); parts.splice(i, 1); }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.t += dt;
        const k = Math.min(1, r.t / r.dur);
        r.m.scale.setScalar(Math.max(0.1, r.maxR * k));
        r.m.material.opacity = (1 - k) * 0.8;
        if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
      }
    },
  };
}
