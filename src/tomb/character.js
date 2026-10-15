// The player's look. Same fields and values as a start.ng character, so a player's
// start.ng character works here unchanged:
// { body, primaryColor, secondaryColor, skinColor, hairColor, hair, hat, accessory }

export const SKINS = ['#5c3a21', '#8d5524', '#a0662f', '#c68642', '#e0ac69', '#f1c27d'];
export const HAIR_COLORS = ['#17120f', '#4a2c1a', '#8b5a2b', '#d9a441', '#b8b8b8', '#c0392b'];
export const TOPS = ['#ff6b6b', '#1dd1a1', '#a55eea', '#4b7bec', '#f7b731', '#fd9644', '#eb3b5a', '#292a23'];
export const BOTTOMS = ['#2b2f4a', '#222f3e', '#3d3d3d', '#4b6584', '#5f3dc4', '#0c6e5a'];
export const HATS = ['none', 'cap', 'beanie', 'tophat', 'crown'];

// Each body has its own hair and extras.
export const SECTIONS = {
  female: { hair: ['braids', 'bun', 'ponytail', 'afro', 'short'], accessory: ['none', 'earrings', 'glasses', 'scarf', 'backpack'] },
  male: { hair: ['short', 'afro', 'dreads', 'bald'], accessory: ['none', 'beard', 'glasses', 'scarf', 'backpack'] },
};
const ALL_HAIR = ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'];
const ALL_ACCESSORIES = ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'];

export const DEFAULT_STYLE = {
  body: 'female',
  primaryColor: '#4b7bec',
  secondaryColor: '#3d3d3d',
  skinColor: '#8d5524',
  hairColor: '#17120f',
  hair: 'braids',
  hat: 'none',
  accessory: 'none',
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Accepts anything (start.ng reply, saved data) and returns a safe, complete style. */
export function cleanStyle(s = {}) {
  const d = DEFAULT_STYLE;
  const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
  return {
    body: pick(s.body, ['female', 'male'], d.body),
    primaryColor: HEX.test(s.primaryColor) ? s.primaryColor : d.primaryColor,
    secondaryColor: HEX.test(s.secondaryColor) ? s.secondaryColor : d.secondaryColor,
    skinColor: HEX.test(s.skinColor) ? s.skinColor : d.skinColor,
    hairColor: HEX.test(s.hairColor) ? s.hairColor : d.hairColor,
    hair: pick(s.hair, ALL_HAIR, d.hair),
    hat: pick(s.hat, HATS, d.hat),
    accessory: pick(s.accessory, ALL_ACCESSORIES, d.accessory),
  };
}

/** Switch body, keeping colours and swapping hair/extras the other body doesn't have. */
export function withBody(s, body) {
  const sec = SECTIONS[body];
  return {
    ...s,
    body,
    hair: sec.hair.includes(s.hair) ? s.hair : sec.hair[0],
    accessory: sec.accessory.includes(s.accessory) ? s.accessory : 'none',
  };
}
