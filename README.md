# Skylark Valley — a flight game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/BostanStyle/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/BostanStyle/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete, original flight game built for make.fun's “Make the best
flight game” bounty — a $500 USDC prize pool shared by the 50 best
entries. You fly a little bush plane, the Skylark, over a green valley
at dawn: take off from runway 09, thread the glowing rings, watch the
fuel, and bring her home for a gentle landing.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step,
no network requests: `game/` is plain static files, and every sound is
synthesised live with WebAudio.

## How to fly

- **↑ / ↓ or W / S** — pitch the nose up and down
- **← / → or A / D** — bank left and right; bank turns the aeroplane
- **Shift / Ctrl** (or the mouse wheel) — throttle up and down
- **Mouse (X)** — steer with the pointer, like a sidestick
- **F** — flaps: more lift, more drag, for slow flight and landing
- **G** — landing gear: down to land, up to go faster
- **P** — pause · **M** — mute · **R** — restart · **H** — help

## The sorties

Three missions over the same valley, picked on the title screen:

1. **Valley Ring Run** — thread 8 rings over the valley, then land.
2. **River Low Pass** — stay low over the river and slip 6 low gates.
3. **Dawn Time Trial** — 10 rings, full throttle, beat the clock.

Rings score 100 points (125 dead centre); a gentle touchdown on the
strip scores up to 500 more, plus leftover-fuel and time bonuses. Fuel
burns with the throttle, the wing stalls below 58 knots, and a hard
landing or a hillside ends the sortie. Best scores are remembered in
your browser.

## The game

- `game/index.html` — the page; `game/src/` holds the game, one job
  per file: `config.js` (tuning), `world.js` (the valley),
  `physics.js` (the flight model), `render.js` (the pseudo-3D view),
  `instruments.js` (the lit panel and HUD), `audio.js` (synth sound),
  `input.js` (keyboard and mouse), `missions.js` (rules and scoring),
  `shots.js` (deterministic screenshot states) and `main.js` (the loop).
- `screenshots/` — four real renders of the game running in a browser:
  the title screen on the runway, mid-flight through a ring, final
  approach, and a completed sortie.
- `main.ts` — the entry program: it copies `game/` and `screenshots/`
  to `/output` and writes `/output/dossier.json`.

## Run the entry program

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/game/`, `out/screenshots/` and `out/dossier.json`,
byte-for-byte the same on every run, with no network.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
