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
- **Shared start.ng leaderboard:** `startng.json` declares it (most **gems**, then fastest **time**). "Sign in with start.ng" goes to start.ng and comes back with a game session; your run is then sent to the start.ng API (`POST /games/relic-hunter/scores`) and every player sees the same top 10, on the end screen, under "Leaderboard" in the menu, and on start.ng.
- **Your start.ng character plays the game.** On `relichunter.start.ng`, the game asks start.ng who is signed in (through start.ng's `/connect`) and uses that player's character and name. Games never see the email or token.
- Not signed in? "Customize explorer" has the same options as start.ng (female or male, skin, hair, hair colour, top, bottoms, hat, extra), saved in your browser.
- The explorer is the same smooth 3D model as the start.ng character creator, with running, jumping, climbing and two pistols.

## Project layout
```
index.html        the built game: ONE self-contained file (this is what start.ng serves)
app.html          the page the build starts from
src/tomb/         game code (level, rules, character model and creator, effects)
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
`index.html` must be at the top of the repo or upload folder. It has no secrets and needs no server (static files only), so it passes the start.ng checks. The only outside request is to start.ng itself, to find out who is signed in. Upload it as `relichunter/index.html` and it appears at `relichunter.start.ng`.

## Sign-in
Nothing to set up: the game finds start.ng from its own address (`*.start.ng` → `https://start.ng`; for local testing, `*.start.localhost` → `http://localhost:5173`). Never commit `.env` files.
