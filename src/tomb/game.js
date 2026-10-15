// Relic Hunter rules: platforming physics, climbing, traps, enemies, pickups, doors and the boulder chase.
// Nothing in here touches the DOM; it reports to the UI through `hooks`.
import * as THREE from 'three';
import { buildHuman } from './human.js';
import { lerpAngle, tone, noise } from '../shared/engine.js';

const V = THREE.Vector3;
const SPEED = 6.8, JUMP = 8.6, GRAV = 24, R = 0.38, STEP = 0.45, REACH = 2.6;

function pistol() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.6, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.34), m); body.position.set(0, 0, 0.12); g.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), m); grip.position.set(0, -0.08, 0); g.add(grip);
  return g;
}

function makeBat() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: '#2a1c22', roughness: 0.8 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), dark));
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.3), dark);
    w.position.x = s * 0.35; g.add(w); wings.push(w);
  }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3030' })); e.position.set(s * 0.08, 0.05, 0.19); g.add(e); }
  return { g, wings };
}

function makeScorpion() {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: '#7a2a14', roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), shell); body.scale.set(1, 0.5, 1.4); body.position.y = 0.3; g.add(body);
  const tail = new THREE.Group(); tail.position.set(0, 0.35, -0.5); g.add(tail);
  let parent = tail;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group(); seg.position.set(0, 0.18, -0.12); seg.rotation.x = -0.55; parent.add(seg);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.13 - i * 0.015, 8, 6), shell); seg.add(b);
    parent = seg;
  }
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), new THREE.MeshStandardMaterial({ color: '#e0c060' }));
  sting.position.set(0, 0.1, 0.05); sting.rotation.x = 2.4; parent.add(sting);
  for (const s of [-1, 1]) {
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), shell); claw.scale.set(1, 0.6, 1.4); claw.position.set(s * 0.32, 0.25, 0.65); g.add(claw);
    for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 4), shell); leg.rotation.z = s * 1.1; leg.position.set(s * 0.42, 0.18, 0.2 - k * 0.25); g.add(leg); }
  }
  return { g, tail };
}

export function createGame({ scene, level, fx, hooks }) {
  const L = level;
  const G = {
    mode: 'idle', time: 0, gems: 0, keys: 0, deaths: 0, hp: 100, inv: 0,
    lever: false, vault: false, idol: false, won: false, prompt: '', shake: 0,
    enemies: [], tracers: [], triggers: new Set(), checkpoint: L.checkpoints[0].pos.clone(), cpIndex: 0,
  };

  // ------------------------------------------------------------ player
  let P = null;
  G.setupPlayer = (style) => {
    if (P) { scene.remove(P.root); P.human.dispose(); }
    const human = buildHuman(style);
    human.parts.handR.add(pistol());
    human.parts.handL.add(pistol());
    scene.add(human.root);
    P = { human, root: human.root, pos: human.root.position, vel: new V(), face: Math.PI, onGround: true, coyote: 0, jumpBuf: 0, climb: null, side: 1, shootCd: 0 };
    P.pos.copy(G.checkpoint);
    G.player = P;
  };

  // ------------------------------------------------------------ collision helpers
  function groundAt(x, z, maxY) {
    let best = -Infinity;
    for (const s of L.solids) {
      if (s.y1 > maxY) continue;
      if (x + R * 0.8 < s.x0 || x - R * 0.8 > s.x1 || z + R * 0.8 < s.z0 || z - R * 0.8 > s.z1) continue;
      if (s.y1 > best) best = s.y1;
    }
    return best;
  }
  G.groundAt = groundAt;

  function pushOut(p, fromY) {
    let hit = null;
    for (const s of L.solids) {
      if (s.y1 <= fromY + STEP || s.y0 >= fromY + 1.75) continue;
      const cx = Math.max(s.x0, Math.min(p.x, s.x1)), cz = Math.max(s.z0, Math.min(p.z, s.z1));
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d >= R) continue;
      let nx, nz;
      if (d > 1e-5) { nx = dx / d; nz = dz / d; p.x = cx + nx * R; p.z = cz + nz * R; }
      else {
        const opts = [[p.x - s.x0, -1, 0], [s.x1 - p.x, 1, 0], [p.z - s.z0, 0, -1], [s.z1 - p.z, 0, 1]].sort((a, b) => a[0] - b[0]);
        [, nx, nz] = opts[0];
        p.x += nx * (opts[0][0] + R); p.z += nz * (opts[0][0] + R);
      }
      hit = { s, nx, nz };
    }
    return hit;
  }

  // ------------------------------------------------------------ damage / death
  function hurt(dmg, kx = 0, kz = 0) {
    if (G.inv > 0 || G.mode !== 'play') return;
    G.hp -= dmg; G.inv = 0.9; G.shake = 0.35;
    P.human.hit();
    P.vel.x += kx; P.vel.z += kz; if (kx || kz) P.vel.y = Math.max(P.vel.y, 5);
    tone(160, 0.18, 'sawtooth', 0.16, 80); noise(0.1, 0.18);
    hooks.hurt && hooks.hurt(dmg);
    if (G.hp <= 0) die('You were defeated');
  }
  function die(reason) {
    if (G.mode !== 'play') return;
    G.mode = 'dead'; G.deadT = 1.8; G.deaths++;
    P.human.setDead(true);
    tone(220, 0.6, 'sawtooth', 0.15, 60);
    hooks.dead && hooks.dead(reason);
  }
  function respawn() {
    P.pos.copy(G.checkpoint); P.vel.set(0, 0, 0); P.climb = null; P.face = Math.PI;
    G.hp = 100; G.inv = 1.2;
    P.human.setDead(false);
    if (G.idol && !G.won) {   // failed the escape: put the idol back and reset the boulder
      G.idol = false; L.idol.group.visible = true; L.idol.light.visible = true;
      L.boulder.active = false; L.boulder.m.visible = false; L.boulder.m.position.copy(L.boulder.start);
    }
    G.mode = 'play';
    hooks.respawn && hooks.respawn();
  }

  // ------------------------------------------------------------ enemies
  function spawn(type, x, y, z) {
    if (type === 'bat') { const b = makeBat(); b.g.position.set(x, y, z); scene.add(b.g); G.enemies.push({ type, ...b, pos: b.g.position, hp: 1, t: Math.random() * 6, state: 'chase', st: 0 }); }
    else { const s = makeScorpion(); s.g.position.set(x, y, z); scene.add(s.g); G.enemies.push({ type, ...s, pos: s.g.position, hp: 3, t: 0, state: 'walk', st: 0, face: 0 }); }
  }
  function killEnemy(e) {
    e.dead = true;
    fx.burst(new V(e.pos.x, e.pos.y + 0.3, e.pos.z), e.type === 'bat' ? '#7a5a6a' : '#c0502a', 14, 4, 0.12, 0.6);
    scene.remove(e.g);
    G.enemies.splice(G.enemies.indexOf(e), 1);
    tone(e.type === 'bat' ? 900 : 300, 0.15, 'triangle', 0.12, e.type === 'bat' ? 400 : 120);
  }
  function updateEnemies(dt) {
    const chest = new V(P.pos.x, P.pos.y + 1.2, P.pos.z);
    for (const e of [...G.enemies]) {
      e.t += dt;
      if (e.type === 'bat') {
        e.wings.forEach((w, i) => { w.rotation.z = Math.sin(e.t * 22) * 0.7 * (i ? -1 : 1); });
        const to = chest.clone().sub(e.pos); const d = to.length() || 0.001; to.divideScalar(d);
        if (e.state === 'retreat') {
          e.st -= dt; e.pos.addScaledVector(to, -3.5 * dt); e.pos.y += 2 * dt;
          if (e.st <= 0) e.state = 'chase';
        } else {
          e.pos.addScaledVector(to, 4.3 * dt);
          e.pos.y += Math.sin(e.t * 5) * 0.02;
          if (d < 0.9) { hurt(10, to.x * 3, to.z * 3); e.state = 'retreat'; e.st = 1.0; }
        }
        e.g.rotation.y = Math.atan2(to.x, to.z);
      } else {
        const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 0.001;
        e.face = lerpAngle(e.face, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
        e.g.rotation.y = e.face;
        e.tail.rotation.x = Math.sin(e.t * 4) * 0.15 - (e.state === 'wind' ? 0.6 : 0);
        if (e.state === 'walk') {
          if (d > 1.3 && d < 18) {
            const nx = e.pos.x + (dx / d) * 2.2 * dt, nz = e.pos.z + (dz / d) * 2.2 * dt;
            const gy = groundAt(nx, nz, e.pos.y + 0.3);
            if (gy > -1 && Math.abs(gy - e.pos.y) < 0.3) { e.pos.x = nx; e.pos.z = nz; }
          } else if (d <= 1.3) { e.state = 'wind'; e.st = 0.5; }
        } else if (e.state === 'wind') {
          e.st -= dt;
          if (e.st <= 0) {
            if (d < 1.7 && Math.abs(P.pos.y - e.pos.y) < 1) hurt(15, (dx / d) * 4, (dz / d) * 4);
            e.state = 'rest'; e.st = 0.8;
          }
        } else { e.st -= dt; if (e.st <= 0) e.state = 'walk'; }
      }
    }
  }

  // ------------------------------------------------------------ shooting
  G.shoot = () => {
    if (G.mode !== 'play' || P.climb || P.shootCd > 0) return;
    P.shootCd = 0.2;
    let target = null, bd = 16;
    for (const e of G.enemies) { const d = e.pos.distanceTo(P.pos); if (d < bd) { bd = d; target = e; } }
    const from = new V(P.pos.x + Math.sin(P.face) * 0.5, P.pos.y + 1.25, P.pos.z + Math.cos(P.face) * 0.5);
    let to;
    if (target) {
      P.face = Math.atan2(target.pos.x - P.pos.x, target.pos.z - P.pos.z);
      to = target.pos.clone(); to.y += target.type === 'bat' ? 0 : 0.3;
      target.hp -= 1;
      fx.burst(to, '#ffe0a0', 5, 3, 0.08, 0.3);
      if (target.hp <= 0) killEnemy(target);
    } else to = new V(from.x + Math.sin(P.face) * 12, from.y, from.z + Math.cos(P.face) * 12);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffe08a', transparent: true }));
    scene.add(line);
    G.tracers.push({ line, t: 0.07 });
    P.side = -P.side;
    P.human.attack(P.side);
    noise(0.05, 0.2); tone(520, 0.05, 'square', 0.12, 160);
  };

  // ------------------------------------------------------------ interactions
  function nearestUse() {
    if (!G.lever && P.pos.distanceTo(L.lever.pos) < 1.9) return 'lever';
    if (!G.idol && P.pos.distanceTo(new V(0, 0, -90)) < 2.4) return G.vault ? 'idol' : null;
    return null;
  }
  G.use = () => {
    if (G.mode !== 'play') return;
    const u = nearestUse();
    if (u === 'lever') {
      G.lever = true;
      L.doors.gate.opening = true;
      tone(140, 0.3, 'square', 0.15, 90); noise(1.2, 0.12);
      G.shake = 0.4;
      hooks.event && hooks.event('gate');
    } else if (u === 'idol') {
      G.idol = true;
      L.idol.group.visible = false; L.idol.light.visible = false;
      tone(660, 0.3, 'triangle', 0.15); tone(990, 0.4, 'triangle', 0.15, null, 0.15);
      hooks.event && hooks.event('idol');
      setTimeout(() => {
        if (!G.idol || G.won) return;
        L.boulder.active = true; L.boulder.m.visible = true; L.boulder.m.position.copy(L.boulder.start);
        G.shake = 0.8; noise(1.2, 0.3);
        spawn('bat', -2, 3, -78); spawn('bat', 2, 3, -76);
      }, 900);
    }
  };

  // ------------------------------------------------------------ start
  G.start = () => {
    G.mode = 'play'; G.time = 0;
    P.pos.copy(G.checkpoint);
  };

  // ------------------------------------------------------------ per-frame
  G.update = (dt, input) => {
    G.shake = Math.max(0, G.shake - dt * 1.5);
    const t = performance.now() / 1000;
    animateWorld(dt, t);
    for (let i = G.tracers.length - 1; i >= 0; i--) {
      const tr = G.tracers[i]; tr.t -= dt; tr.line.material.opacity = Math.max(0, tr.t / 0.07);
      if (tr.t <= 0) { scene.remove(tr.line); tr.line.geometry.dispose(); G.tracers.splice(i, 1); }
    }
    fx.update(dt);

    if (G.mode === 'dead') {
      P.human.update(dt, 0);
      G.deadT -= dt;
      if (G.deadT <= 0) respawn();
      return;
    }
    if (G.mode !== 'play') { P.human.update(dt, 0); return; }

    G.time += dt;
    G.inv = Math.max(0, G.inv - dt);
    P.shootCd = Math.max(0, P.shootCd - dt);
    const ax = input.axis;
    if (input.jump) P.jumpBuf = 0.14; else P.jumpBuf = Math.max(0, P.jumpBuf - dt);

    if (P.climb) {
      const c = P.climb;
      c.t = Math.min(1, c.t + dt / 0.5);
      const up = Math.min(1, c.t / 0.6), fw = Math.max(0, (c.t - 0.45) / 0.55);
      P.pos.set(c.from.x + (c.to.x - c.from.x) * fw, c.from.y + (c.to.y - c.from.y) * up, c.from.z + (c.to.z - c.from.z) * fw);
      P.human.update(dt, 0, { raise: true });
      if (c.t >= 1) { P.climb = null; P.vel.set(0, 0, 0); P.onGround = true; }
    } else {
      // horizontal control
      const tx = ax.x * SPEED, tz = ax.y * SPEED;
      const k = Math.min(1, dt * (P.onGround ? 16 : 5));
      P.vel.x += (tx - P.vel.x) * k; P.vel.z += (tz - P.vel.z) * k;
      if (ax.mag > 0.1) P.face = lerpAngle(P.face, Math.atan2(ax.x, ax.y), 1 - Math.exp(-14 * dt));

      // jump
      P.coyote = P.onGround ? 0.1 : Math.max(0, P.coyote - dt);
      if (P.jumpBuf > 0 && P.coyote > 0) { P.vel.y = JUMP; P.onGround = false; P.coyote = 0; P.jumpBuf = 0; tone(300, 0.1, 'triangle', 0.08, 520); }
      P.vel.y = Math.max(-30, P.vel.y - GRAV * dt);

      const prevY = P.pos.y;
      P.pos.x += P.vel.x * dt;
      let hit = pushOut(P.pos, prevY);
      P.pos.z += P.vel.z * dt;
      hit = pushOut(P.pos, prevY) || hit;

      // grab a ledge: pressing into a wall you can reach, while in the air or pressing jump
      if (hit && ax.mag > 0.3) {
        const h = hit.s.y1 - prevY;
        const into = -(ax.x * hit.nx + ax.y * hit.nz) / (ax.mag || 1);
        if (into > 0.5 && h > 0.3 && h <= REACH && (!P.onGround || input.jump || P.jumpBuf > 0)) {
          const s = hit.s;
          const tx2 = Math.max(s.x0 + R, Math.min(P.pos.x - hit.nx * 0.6, s.x1 - R));
          const tz2 = Math.max(s.z0 + R, Math.min(P.pos.z - hit.nz * 0.6, s.z1 - R));
          if (s.x1 - s.x0 > 2 * R && s.z1 - s.z0 > 2 * R) {
            P.climb = { t: 0, from: P.pos.clone(), to: new V(tx2, s.y1, tz2) };
            P.face = Math.atan2(-hit.nx, -hit.nz);
            P.vel.set(0, 0, 0); P.jumpBuf = 0;
            tone(200, 0.12, 'triangle', 0.08, 300);
          }
        }
      }

      if (!P.climb) {
        P.pos.y += P.vel.y * dt;
        const gy = groundAt(P.pos.x, P.pos.z, prevY + STEP);
        if (P.vel.y <= 0 && P.pos.y <= gy + 0.001) {
          if (!P.onGround && P.vel.y < -12) { G.shake = 0.15; noise(0.06, 0.1); }
          P.pos.y = gy; P.vel.y = 0; P.onGround = true;
        } else P.onGround = P.vel.y <= 0 && P.pos.y - gy < 0.06;
      }
      P.root.rotation.y = P.face;
      const hs = Math.hypot(P.vel.x, P.vel.z);
      P.human.update(dt, P.onGround ? hs : 0, { air: !P.onGround });
    }
    P.root.rotation.y = P.face;

    // falling into the abyss
    if (P.pos.y < -9) return die('You fell into the darkness');

    // checkpoints (forward only)
    for (let i = G.cpIndex + 1; i < L.checkpoints.length; i++) {
      if (P.pos.z < L.checkpoints[i].z && P.onGround) { G.cpIndex = i; G.checkpoint.copy(L.checkpoints[i].pos); hooks.checkpoint && hooks.checkpoint(); }
    }

    // enemy waves
    const trig = (id, cond, fn) => { if (!G.triggers.has(id) && cond) { G.triggers.add(id); fn(); } };
    trig('bats1', P.pos.z < -14, () => { spawn('bat', -4, 3, -26); spawn('bat', 4, 3.4, -28); });
    trig('bats2', P.pos.z < -41, () => { spawn('bat', -3, 3, -54); spawn('bat', 3, 3.2, -55); });
    trig('scorp', P.pos.z < -60.5, () => { spawn('scorpion', -3, 0, -67.5); spawn('scorpion', 3, 0, -68); });

    // traps
    for (const sp of L.spikes) {
      if (sp.up && P.pos.x > sp.x0 && P.pos.x < sp.x1 && P.pos.z > sp.z0 && P.pos.z < sp.z1 && P.pos.y < 0.5) hurt(25, 0, 0), (P.vel.y = 6);
    }
    for (const b of L.blades) {
      const bp = new V(Math.sin(b.angle) * b.len, 5.4 - Math.cos(b.angle) * b.len, b.z);
      if (bp.distanceTo(new V(P.pos.x, P.pos.y + 1.0, P.pos.z)) < 1.15) hurt(34, Math.sign(b.vel || 1) * 6, 0);
    }
    if (L.boulder.active) {
      const bm = L.boulder.m;
      if (bm.position.z < -71.6) {
        bm.position.z += 6.3 * dt;
        bm.rotation.x += (6.3 * dt) / L.boulder.r;
        if (Math.random() < dt * 6) noise(0.15, 0.12);
        G.shake = Math.max(G.shake, 0.12);
      } else if (!L.boulder.crashed) { L.boulder.crashed = true; G.shake = 0.9; noise(0.6, 0.35); fx.burst(new V(0, 1, -71), '#9a7e5e', 30, 6, 0.25, 1); }
      if (bm.position.distanceTo(new V(P.pos.x, P.pos.y + 1, P.pos.z)) < L.boulder.r + 0.45) return die('Crushed by the boulder');
    }

    // pickups
    for (const g of L.gems) {
      if (!g.taken && g.m.position.distanceTo(new V(P.pos.x, P.pos.y + 0.8, P.pos.z)) < 1.0) {
        g.taken = true; g.m.visible = false; G.gems++;
        fx.burst(g.m.position, '#3ad1c8', 10, 3, 0.1, 0.5); tone(1320, 0.08, 'sine', 0.1, 1760);
        hooks.gem && hooks.gem();
      }
    }
    for (const k of L.keys) {
      if (!k.taken && k.m.position.distanceTo(new V(P.pos.x, P.pos.y + 0.8, P.pos.z)) < 1.1) {
        k.taken = true; k.m.visible = false; G.keys++;
        fx.burst(k.m.position, '#ffd04a', 16, 4, 0.12, 0.7); tone(880, 0.2, 'triangle', 0.14); tone(1320, 0.3, 'triangle', 0.14, null, 0.12);
        hooks.key && hooks.key(G.keys);
        if (G.keys >= 3 && !G.vault) { G.vault = true; L.doors.vault.opening = true; noise(1.5, 0.12); G.shake = 0.4; hooks.event && hooks.event('vault'); }
      }
    }

    // win: escaped with the idol
    if (G.idol && P.pos.z > -66 && !G.won) { G.won = true; G.mode = 'won'; hooks.win && hooks.win(); }

    G.prompt = nearestUse() === 'lever' ? 'Pull the lever' : nearestUse() === 'idol' ? 'Take the golden idol' : '';
    updateEnemies(dt);
  };

  function animateWorld(dt, t) {
    for (const d of Object.values(L.doors)) {
      if (d.opening && d.open < 4.8) {
        d.open = Math.min(4.8, d.open + dt * 2);
        const s = d.s, h = s.mesh.geometry.parameters.height;
        s.y0 = d.open; s.y1 = d.open + h;
        s.mesh.position.y = d.open + h / 2;
      }
    }
    for (const sp of L.spikes) {
      sp.up = Math.sin(t * 2.6 + sp.phase) > 0.15;
      sp.g.position.y += ((sp.up ? 0 : -0.75) - sp.g.position.y) * Math.min(1, dt * 18);
    }
    for (const b of L.blades) {
      const a = Math.sin(t * 1.7 + b.phase) * 1.0;
      b.vel = a - (b.angle ?? a); b.angle = a;
      b.pivot.rotation.z = a;
    }
    for (const g of L.gems) if (!g.taken) { g.m.rotation.y += dt * 2; g.m.position.y = g.base + Math.sin(t * 2 + g.m.position.z) * 0.12; }
    for (const k of L.keys) if (!k.taken) { k.m.rotation.y += dt * 2.5; k.m.position.y = k.base + Math.sin(t * 2.4) * 0.12; }
    if (!G.lever) L.lever.handle.rotation.x = 0.7; else L.lever.handle.rotation.x += (-0.7 - L.lever.handle.rotation.x) * Math.min(1, dt * 8);
    for (const tc of L.torches) {
      tc.light.intensity = 20 + Math.sin(t * 13 + tc.seed) * 3 + Math.random() * 2;
      tc.flame.scale.y = 1 + Math.sin(t * 17 + tc.seed) * 0.15;
    }
    if (L.idol.group.visible) L.idol.group.rotation.y += dt * 0.8;
  }

  G.objective = () => {
    if (G.won) return 'You escaped with the idol!';
    if (G.idol) return 'RUN! Escape the boulder - get back through the vault door';
    if (G.vault) return 'The vault is open. Take the golden idol';
    if (G.lever) return `Find the 3 golden keys (${G.keys}/3)`;
    return 'Climb the ledge and pull the lever to open the gate';
  };

  return G;
}
