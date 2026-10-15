// Who is playing, and how they look.
//
// On <game>.start.ng the game asks start.ng who is signed in, the way start.ng shares
// the player with games: it loads start.ng/connect in a hidden iframe and posts
// { type: 'startng:whoami', requestId }. start.ng answers { type: 'startng:user', requestId,
// user: { id, name, style } | null }. Games never see the email or token.
// Anywhere else (or if nobody is signed in) the player's own saved look is used.
//
// Returns { name, style, source: 'startng' | 'local' }.

import { cleanStyle, DEFAULT_STYLE } from '../tomb/character.js';

const KEY = 'relichunter.player';
const TIMEOUT_MS = 3000;

/** start.ng's address for this game, or null when not running on start.ng. */
export function startngHome() {
  const { protocol, hostname, port } = location;
  if (hostname.endsWith('.start.ng')) return 'https://start.ng';
  // local testing: game on <name>.start.localhost, start.ng app on localhost:5173
  if (hostname.endsWith('.start.localhost')) return `${protocol}//localhost:5173`;
  void port;
  return null;
}

/** Link that sends the player to sign in on start.ng and back here afterwards. */
export function signInUrl() {
  const home = startngHome();
  return home ? `${home}/?return_to=${encodeURIComponent(location.href)}` : null;
}

function askStartng(home) {
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const frame = document.createElement('iframe');
    frame.src = `${home}/connect`;
    frame.title = 'start.ng';
    frame.style.display = 'none';
    const done = (user) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      frame.remove();
      resolve(user);
    };
    const onMessage = (e) => {
      if (e.origin !== new URL(home).origin) return;
      if (e.data?.type !== 'startng:user' || e.data.requestId !== requestId) return;
      done(e.data.user || null);
    };
    const timer = setTimeout(() => done(null), TIMEOUT_MS);
    window.addEventListener('message', onMessage);
    frame.addEventListener('load', () => frame.contentWindow.postMessage({ type: 'startng:whoami', requestId }, home));
    document.body.appendChild(frame);
  });
}

function readLocal() {
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
  const home = startngHome();
  if (home) {
    const u = await askStartng(home);
    if (u && u.style) return { name: String(u.name || 'Player').slice(0, 24), style: cleanStyle(u.style), source: 'startng' };
  }
  return readLocal();
}
