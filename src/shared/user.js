// Who is playing, how they look, and the shared leaderboard: through the start.ng API.
//
// Sign-in uses a start.ng game session: "Sign in with start.ng" opens start.ng/?return_to=<this game>,
// and start.ng sends the player back with #startng_session=... (a key that only works for this game,
// for a couple of hours, and is never their sign-in). The game sends it as "Authorization: Bearer ...".
// Without a session (not signed in, or not on start.ng) the player's own saved look is used.
//
// Returns { id?, name, style, source: 'startng' | 'local' }.
// Leaderboard: this game's startng.json lists its stats (gems, then time). A signed-in player's run
// goes to start.ng's database; a personal best time stays in this browser.

import { cleanStyle, DEFAULT_STYLE } from '../tomb/character.js';

const KEY = 'relichunter.player';
const SESSION = 'relichunter.startng_session';
const GAME = location.hostname.split('.')[0]; // relic-hunter on relic-hunter.start.ng

/** start.ng and its API for this game, or null when not running on start.ng. */
function addresses() {
  const { hostname } = location;
  if (hostname.endsWith('.start.ng')) return { home: 'https://start.ng', api: 'https://api.start.ng' };
  // local testing: game on <name>.start.localhost, start.ng on localhost:5173, API on localhost:8000
  if (hostname.endsWith('.start.localhost')) return { home: 'http://localhost:5173', api: 'http://localhost:8000' };
  return null;
}

export function startngHome() {
  return addresses()?.home ?? null;
}

/** "Sign in with start.ng": signs in on start.ng, then comes back here with a game session. */
export function signInUrl() {
  const a = addresses();
  return a ? `${a.home}/?return_to=${encodeURIComponent(location.origin + location.pathname + location.search)}` : null;
}

// Pick up a session start.ng just handed over, keep it for this tab, and clean the address bar.
(function takeSession() {
  const params = new URLSearchParams(location.hash.slice(1));
  const session = params.get('startng_session');
  if (!session) return;
  try { sessionStorage.setItem(SESSION, session); } catch { /* storage blocked */ }
  history.replaceState(null, '', location.pathname + location.search);
})();

function session() {
  try { return sessionStorage.getItem(SESSION); } catch { return null; }
}

/** Forget the session (playing as guest, or it expired). */
export function dropSession() {
  try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
}

async function api(path, options = {}) {
  const a = addresses();
  if (!a) return null;
  const headers = { ...(options.headers || {}) };
  if (options.auth) {
    if (!session()) return { status: 401, data: null };
    headers.Authorization = `Bearer ${session()}`;
  }
  if (options.body) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${a.api}/games/${GAME}${path}`, { method: options.method || 'GET', headers, body: options.body && JSON.stringify(options.body) });
    if (res.status === 401) dropSession();
    return { status: res.status, data: await res.json().catch(() => null) };
  } catch {
    return null; // start.ng can't be reached
  }
}

/**
 * Save a run to the shared leaderboard: { gems, time } (time in whole seconds).
 * Returns { ok: true, best, improved, rank, stats } or { ok: false, error, signIn? }.
 */
export async function submitRun(stats) {
  const res = await api('/scores', { method: 'POST', auth: true, body: { stats } });
  if (!res) return { ok: false, error: "Couldn't reach start.ng" };
  if (res.status === 401) return { ok: false, signIn: true, error: 'Sign in with start.ng to save your run' };
  if (res.status !== 200) return { ok: false, error: res.data?.detail || "Couldn't save your run" };
  return { ok: true, ...res.data };
}

/** The shared leaderboard: [{ rank, player_id, name, color, stats: { gems, time } }], or null. */
export async function getLeaderboard(limit = 10) {
  const res = await api(`/leaderboard?limit=${limit}`);
  return res && res.status === 200 ? res.data : null;
}

export function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.style) return { name: String(raw.name || 'Explorer').slice(0, 24), style: cleanStyle(raw.style), source: 'local' };
  } catch { /* storage blocked or bad data */ }
  return { name: 'Explorer', style: { ...DEFAULT_STYLE }, source: 'local' };
}

export function saveLocalUser(user) {
  if (user.source !== 'local') return; // a start.ng character is changed on start.ng
  try { localStorage.setItem(KEY, JSON.stringify({ name: user.name, style: user.style })); } catch { /* ignore */ }
}

export async function loadUser() {
  if (session()) {
    const res = await api('/player', { auth: true });
    const u = res && res.status === 200 ? res.data : null;
    if (u) return { id: u.id, name: String(u.name || 'Player').slice(0, 24), style: cleanStyle(u.style || {}), source: 'startng' };
  }
  return readLocal();
}
