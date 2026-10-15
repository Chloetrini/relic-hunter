# Relic Hunter

A 3D tomb-raiding adventure for [start.ng](https://start.ng). Climb ledges, dodge spikes and swinging blades, shoot bats and scorpions, find three keys, take the golden idol, then outrun the boulder.

Plain browser game: no backend, no accounts needed. Just open `index.html`.

## Play
| Action | Keyboard | Phone |
|---|---|---|
| Move | WASD / arrow keys | drag the left side |
| Jump / climb a ledge | Space (push into the ledge) | JUMP |
| Shoot (auto-aims) | J or K, or click | FIRE |
| Use (lever, idol) | E or F | USE |

## How it works
- Three rooms: the entrance hall (lever and gate), the trap corridor (spikes, blades, keys) and the idol vault.
- Collect 15 gems and 3 keys. The keys open the vault.
- Taking the idol wakes the boulder. Run back through the vault door to win.
- Checkpoints save your place. Your best time is kept in your browser.
- Your look (skin, hair, colour, outfit) is chosen in "Customize explorer" and shows on your explorer.

## Project layout
```
index.html        the built game: ONE self-contained file (this is what start.ng serves)
app.html          the page the build starts from
src/tomb/         game code (level, rules, explorer model, effects)
src/shared/       input, sound, customizer, user styles
tools/build.mjs   bundles everything into index.html
```

## Rebuild after changing code
```bash
npm install
npm run build      # writes index.html
```
Needs Node 18 or newer.

## Put it on start.ng
`index.html` must be at the top of the repo or upload folder. It makes no outside requests and has no secrets, so it passes the start.ng checks (static files only). Upload it as `relichunter/index.html` and it appears at `relichunter.start.ng`.

## Login and scores (later)
Sign-in and high scores will use the start.ng API. The only setting is `VITE_START_API_URL` (a public address, see `.env.example`). Never commit `.env` files.
