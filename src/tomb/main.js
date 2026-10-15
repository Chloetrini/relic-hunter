import * as THREE from 'three';
import { dropSession, getLeaderboard, loadUser, readLocal, saveLocalUser, signInUrl, startngHome, submitRun } from '../shared/user.js';
import { $, createInput, unlockAudio, tone, createStage } from '../shared/engine.js';
import { createFx } from './fx.js';
import { buildLevel } from './level.js';
import { createGame } from './game.js';
import { mountCustomizer } from './customizer.js';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

async function main() {
  const user = await loadUser();
  const { renderer, scene, camera } = createStage({ fog: '#120c08', near: 16, far: 58, fov: 55 });
  scene.add(new THREE.HemisphereLight('#ffdcb0', '#1a120c', 0.75));
  const sun = new THREE.DirectionalLight('#ffcf9a', 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const fx = createFx(scene);
  const level = buildLevel(scene);

  // ---- UI helpers
  function note(text, teal) {
    const el = document.createElement('div');
    el.className = 'rh-note' + (teal ? ' teal' : '');
    el.textContent = text;
    $('rhNotes').appendChild(el);
    setTimeout(() => el.remove(), 2900);
  }
  let cineT = 0;
  function cinematic(text, ms = 2400) {
    $('rhCine').textContent = text;
    $('rhLetterbox').classList.add('on');
    clearTimeout(cineT);
    cineT = setTimeout(() => $('rhLetterbox').classList.remove('on'), ms);
  }
  let hurtT = 0;

  const hooks = {
    gem: () => note('+1 Gem', true),
    key: (n) => note(`Golden key found  ${n} / 3`),
    checkpoint: () => note('Checkpoint reached'),
    hurt: () => { $('rhHurt').classList.add('on'); clearTimeout(hurtT); hurtT = setTimeout(() => $('rhHurt').classList.remove('on'), 120); },
    dead: (reason) => { $('rhFadeText').textContent = reason; setTimeout(() => $('rhFade').classList.add('on'), 400); },
    respawn: () => { $('rhFade').classList.remove('on'); note('Back at the last checkpoint'); },
    event: (e) => {
      if (e === 'gate') cinematic('The gate rumbles open');
      if (e === 'vault') cinematic('The vault door opens');
      if (e === 'idol') cinematic('The temple awakens. Run!', 2600);
    },
    win: () => setTimeout(showEnd, 1400),
  };
  const G = createGame({ scene, level, fx, hooks });
  G.setupPlayer(user.style);

  const input = createInput({ jump: ['Space'], shoot: ['KeyJ', 'KeyK'], use: ['KeyE', 'KeyF'] });
  input.bindButton($('tJump'), 'jump');
  input.bindButton($('tShoot'), 'shoot');
  input.bindButton($('tUse'), 'use');
  renderer.domElement.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) G.shoot(); });

  // ---- opening screen: your name (or your start.ng account), then the menu
  await new Promise((resolve) => {
    const signedIn = user.source === 'startng';
    const nameEl = $('gateName');
    if (signedIn) {
      $('gateLabel').textContent = 'Signed in with start.ng';
      $('gateWelcome').hidden = false;
      $('gateWelcome').textContent = `Welcome back, ${user.name}`;
      nameEl.hidden = true;
      $('gateNote').textContent = 'Your start.ng character and name come with you into the temple.';
    } else {
      nameEl.value = user.name === 'Explorer' ? '' : user.name;
      $('gateNote').textContent = 'Your name appears on the menu and on the end screen when you escape with the idol.';
      if (signInUrl()) {
        $('gateSignin').hidden = false;
        $('gateSignin').href = signInUrl();
      }
      if (signInUrl()) {
        const a = document.createElement('a');
        a.href = signInUrl();
        a.textContent = 'Sign in with start.ng';
        $('gateNote').append(' ', a, ' to bring your own character.');
      }
      setTimeout(() => nameEl.focus(), 50);
    }
    const done = () => {
      unlockAudio();
      tone(147, 0.9, 'sine', 0.08, 196);
      $('rh-gate').hidden = true;
      $('rh-title').hidden = false;
      resolve();
    };
    $('gateEnter').addEventListener('click', () => {
      if (!signedIn) {
        const name = nameEl.value.trim().slice(0, 24);
        if (!name) {
          nameEl.classList.remove('shake');
          void nameEl.offsetWidth; // restart the shake
          nameEl.classList.add('shake');
          nameEl.focus();
          return;
        }
        user.name = name;
        saveLocalUser(user);
      }
      done();
    });
    $('gateGuest').addEventListener('click', () => {
      dropSession();
      Object.assign(user, readLocal(), { name: 'Guest', source: 'local' });
      G.setupPlayer(user.style);
      done();
    });
    nameEl.addEventListener('animationend', () => nameEl.classList.remove('shake'));
    nameEl.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing here shouldn't move the explorer
      if (e.key === 'Enter') $('gateEnter').click();
    });
  });

  // ---- title screen
  const playingAs = () => { $('rhPlayer').textContent = user.source === 'startng' ? `Playing as ${user.name} · start.ng` : `Playing as ${user.name}`; };
  playingAs();
  const custom = mountCustomizer($('custom'), user, playingAs);
  $('rhCustom').addEventListener('click', () => { $('rhDrawer').hidden = false; custom.setHidden(false); });
  $('rhClose').addEventListener('click', () => { $('rhDrawer').hidden = true; custom.setHidden(true); G.setupPlayer(user.style); });
  $('rhHow').addEventListener('click', () => { $('rhHowto').hidden = !$('rhHowto').hidden; });
  $('rhBoardBtn').addEventListener('click', async () => {
    const panel = $('rhBoard');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) await showBoard($('rhBoardList'), $('rhBoardNote'));
  });

  // ---- shared start.ng leaderboard (scores live in start.ng's database, through its API)
  async function showBoard(listEl, noteEl) {
    listEl.innerHTML = '';
    if (!startngHome()) {
      if (noteEl) noteEl.textContent = 'The leaderboard is on relic-hunter.start.ng.';
      return false;
    }
    if (noteEl) noteEl.textContent = 'Loading...';
    const entries = await getLeaderboard(10);
    if (!entries) { if (noteEl) noteEl.textContent = "Couldn't load the leaderboard."; return false; }
    if (noteEl) noteEl.textContent = entries.length ? '' : 'No scores yet. Be the first to escape with the idol.';
    for (const e of entries) {
      const li = document.createElement('li');
      if (user.source === 'startng' && e.player_id === user.id) li.className = 'me';
      const rk = Object.assign(document.createElement('span'), { className: 'rk', textContent: `#${e.rank}` });
      const dot = Object.assign(document.createElement('span'), { className: 'dot' });
      if (e.color) dot.style.background = e.color;
      const nm = Object.assign(document.createElement('span'), { className: 'nm', textContent: e.name });
      const gems = Object.assign(document.createElement('span'), { className: 'st', textContent: `${e.stats?.gems ?? '–'} gems` });
      const time = Object.assign(document.createElement('span'), { className: 'st', textContent: e.stats?.time == null ? '–' : fmt(e.stats.time) });
      li.append(rk, dot, nm, gems, time);
      listEl.appendChild(li);
    }
    return entries.length > 0;
  }

  // This game's leaderboard (startng.json): most gems wins, then the fastest time.
  $('rhStart').addEventListener('click', () => {
    unlockAudio();
    custom.setHidden(true);
    G.setupPlayer(user.style);
    $('rh-title').hidden = true;
    $('rh-hud').hidden = false;
    G.start();
    cinematic('The Lost Temple', 2600);
    tone(196, 1.2, 'sine', 0.12, 294);
  });
  $('rhAgain').addEventListener('click', () => location.reload());

  // Signed-in players: save the run to the shared leaderboard, then show it. Others: it stays here.
  async function shareRun(stats) {
    const note = $('esScoreNote');
    note.textContent = '';
    if (user.source !== 'startng') {
      if (signInUrl()) {
        const a = Object.assign(document.createElement('a'), { href: signInUrl(), textContent: 'Sign in with start.ng' });
        note.append(a, ' to put your run on the leaderboard.');
      }
      return;
    }
    note.textContent = 'Saving your run...';
    const res = await submitRun(stats);
    if (!res.ok) {
      note.textContent = res.error || "Couldn't save your run.";
      if (res.signIn && signInUrl()) note.append(' ', Object.assign(document.createElement('a'), { href: signInUrl(), textContent: 'Sign in again' }));
      return;
    }
    note.textContent = res.improved
      ? `New best! You're #${res.rank} on start.ng.`
      : `#${res.rank} on start.ng · your best: ${res.stats.gems} gems in ${fmt(res.stats.time)}.`;
    $('esBoard').hidden = !(await showBoard($('esBoardList'), null));
  }

  function showEnd() {
    $('rh-hud').hidden = true;
    const best = Number(store.get('relichunter.best') || 0);
    const isBest = !best || G.time < best;
    if (isBest) store.set('relichunter.best', String(G.time));
    const stars = 1 + (G.gems >= 10 ? 1 : 0) + (G.deaths <= 2 ? 1 : 0);
    $('esEyebrow').textContent = `Expedition complete · ${user.name}`;
    shareRun({ gems: G.gems, time: Math.round(G.time) });
    $('esTime').textContent = fmt(G.time);
    $('esGems').textContent = `${G.gems} / ${level.totalGems}`;
    $('esDeaths').textContent = String(G.deaths);
    $('esBest').textContent = isBest ? `${fmt(G.time)}  (new best)` : fmt(best);
    $('esStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('rh-end').hidden = false;
    tone(392, 0.5, 'triangle', 0.15); tone(523, 0.6, 'triangle', 0.15, null, 0.25); tone(784, 0.9, 'triangle', 0.15, null, 0.5);
  }

  // ---- loop
  const camBase = new THREE.Vector3(0, 6, 12);
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let hudT = 0, lastObj = '';
  function updateHud() {
    const obj = G.objective();
    if (obj !== lastObj) { lastObj = obj; const el = $('rhObj'); el.textContent = obj; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    $('rhHp').style.width = `${Math.max(0, G.hp)}%`;
    $('rhGems').textContent = G.gems;
    [...$('rhKeys').children].forEach((k, i) => k.classList.toggle('on', i < G.keys));
    $('rhTime').textContent = fmt(G.time);
    $('rhPrompt').hidden = !G.prompt;
    $('rhPromptText').textContent = G.prompt;
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (G.mode === 'play') {
      if (input.pressed('use')) G.use();
      if (input.pressed('shoot') || input.held('shoot')) G.shoot();
    }
    const jump = G.mode === 'play' && input.pressed('jump');
    if (G.mode !== 'play') input.clearEdges();
    G.update(dt, { axis: input.axis(), jump });

    const p = G.player.pos;
    if (G.mode === 'idle') {
      tmp.set(Math.sin(t * 0.15) * 1.8, 3.6, 2.5);
      look.set(Math.sin(t * 0.1) * 2, 1.6, -20);
    } else {
      tmp.set(p.x * 0.6, p.y + 3.3, Math.min(p.z + 6.2, 4));   // never behind the entrance wall
      look.set(p.x * 0.85, p.y + 0.75, p.z - 4.5);
    }
    camBase.lerp(tmp, 1 - Math.exp(-(G.mode === 'idle' ? 1.5 : 6) * dt));
    const k = G.shake;
    camera.position.set(camBase.x + (Math.random() - 0.5) * k, camBase.y + (Math.random() - 0.5) * k, camBase.z + (Math.random() - 0.5) * k);
    camera.lookAt(look);
    sun.target.position.set(p.x, 0, p.z - 4);
    sun.position.set(p.x + 6, 18, p.z + 6);

    hudT += dt;
    if (hudT > 0.1 && G.mode !== 'idle') { hudT = 0; updateHud(); }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  if (location.search.includes('debug')) window.__relic = { G, level, input };
}

main();
