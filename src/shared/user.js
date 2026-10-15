// All login + character code lives here. When start.ng accounts exist,
// replace the body of loadUser() with the real call; the games only ever use
// the { name, style, source } object it returns.
//
// style = { skin: '#rrggbb', hair: 'afro'|'braids'|'puffs'|'short'|'wrap', hairColor: '#rrggbb', outfit: '#rrggbb' }

export const SKINS = ['#f1c9a5', '#d9a066', '#b57a4a', '#8d5a36', '#6b4226', '#43291a'];
export const HAIRS = ['afro', 'braids', 'puffs', 'short', 'wrap'];
export const HAIR_COLORS = ['#17120f', '#3b2417', '#7a4a21', '#b8b0a2'];
export const OUTFITS = ['#e4572e', '#2e86ab', '#f6c945', '#58a65c', '#a459d1', '#f08cae'];

const KEY = 'nightgames.user';
const DEFAULT_USER = {
  name: 'Guest',
  style: { skin: SKINS[3], hair: 'braids', hairColor: HAIR_COLORS[0], outfit: OUTFITS[1] },
  source: 'local',
};

const HEX = /^#[0-9a-f]{6}$/i;

export function cleanStyle(s = {}) {
  const d = DEFAULT_USER.style;
  return {
    skin: HEX.test(s.skin) ? s.skin : d.skin,
    hair: HAIRS.includes(s.hair) ? s.hair : d.hair,
    hairColor: HEX.test(s.hairColor) ? s.hairColor : d.hairColor,
    outfit: HEX.test(s.outfit) ? s.outfit : d.outfit,
  };
}

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.style) {
      return { name: String(raw.name || DEFAULT_USER.name).slice(0, 14), style: cleanStyle(raw.style), source: 'local' };
    }
  } catch { /* storage blocked or bad data */ }
  return { ...DEFAULT_USER, style: { ...DEFAULT_USER.style } };
}

export function saveLocalUser(user) {
  try { localStorage.setItem(KEY, JSON.stringify({ name: user.name, style: user.style })); } catch { /* ignore */ }
}

// The token comes from the start.ng login at runtime (never hard-coded).
function findToken() {
  const fromUrl = new URLSearchParams(location.search).get('token');
  if (fromUrl) return fromUrl;
  try { return localStorage.getItem('startng.token'); } catch { return null; }
}

export async function loadUser() {
  const base = import.meta.env && import.meta.env.VITE_START_API_URL;
  const token = findToken();
  if (base && token) {
    try {
      // TODO(start.ng): confirm the real path + response shape with Mark.
      const res = await fetch(`${base.replace(/\/$/, '')}/me/character`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return { name: String(data.name || 'Player').slice(0, 14), style: cleanStyle(data.style || data), source: 'startng' };
      }
    } catch { /* fall through to local */ }
  }
  return readLocal();
}
