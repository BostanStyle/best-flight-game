// Deterministic screenshot states for Skylark Valley. One job: put
// the game into a photogenic, repeatable moment for each shot name, so
// the screenshots the maker takes are real renders of the game itself.
// The state is a valid flight state — the renderer draws the world
// from it exactly as it would mid-game — and the frame then freezes.
// ?shot=start  — on the runway at dawn, instruments lit, ready to go
// ?shot=play   — mid-flight, threading a ring over the river valley
// ?shot=land   — on final approach to the runway, gear down, flaps out
// ?shot=win    — landed after a full ring run, score panel up
// ?seed=N pins the valley; without it the valley uses seed 7.

import { MODES } from './missions.js';

function settleAttitude(plane) {
  plane.displayRoll = plane.roll;
  plane.displayPitch = plane.pitch;
}

export function applyShot(game, name) {
  const { plane, world, director } = game;
  game.shotFrozen = true;
  if (name === 'start') {
    // Dawn on the runway: engine idling, throttle cracked, the valley
    // and the sun ahead, panel glowing.
    plane.throttle = 0.18;
    plane.y = world.groundHeightAt(plane.s, plane.x) + 1.2;
    settleAttitude(plane);
    game.mode = MODES.TITLE;
    return true;
  }
  if (name === 'play') {
    // Two rings in, third dead ahead: the river below, the town ahead,
    // speed on, the next ring glowing gold.
    const ring = director.rings[2];
    director.rings[0].passed = true;
    director.rings[1].passed = true;
    director.score = 225;
    plane.s = ring.segment * 100 - 850;
    plane.x = ring.x - 60;
    plane.y = ring.y + 6;
    plane.speed = 78;
    plane.throttle = 0.78;
    plane.heading = 90;
    plane.pitch = 1;
    plane.roll = 6;
    plane.airborne = true;
    plane.onGround = false;
    plane.fuel = 71;
    director.elapsed = 96;
    settleAttitude(plane);
    game.mode = MODES.FLYING;
    return true;
  }
  if (name === 'land') {
    // On final for the runway: all rings flown, gear down, flaps out,
    // the strip filling the windscreen, low sun behind the pilot.
    director.rings.forEach((r) => {
      r.passed = true;
    });
    director.score = 800;
    plane.s = 900;
    plane.x = world.segments[9].cx;
    plane.y = world.groundHeightAt(plane.s, plane.x) + 30;
    plane.speed = 48;
    plane.throttle = 0.42;
    plane.heading = 270;
    plane.pitch = -4;
    plane.roll = 0;
    plane.flaps = true;
    plane.gearDown = true;
    plane.airborne = true;
    plane.onGround = false;
    plane.fuel = 34;
    director.elapsed = 248;
    settleAttitude(plane);
    game.mode = MODES.FLYING;
    director.toast('ALL RINGS — BRING HER HOME TO RUNWAY 09', '#ffd23e');
    return true;
  }
  if (name === 'win') {
    // The sortie complete: all rings, a greased landing, the score
    // panel telling the story.
    director.rings.forEach((r) => {
      r.passed = true;
    });
    plane.s = 450;
    plane.x = world.segments[4].cx;
    plane.y = world.groundHeightAt(plane.s, plane.x) + 1.2;
    plane.speed = 0;
    plane.throttle = 0;
    plane.heading = 90;
    plane.pitch = 0;
    plane.roll = 0;
    plane.airborne = false;
    plane.onGround = true;
    plane.fuel = 28;
    director.elapsed = 262;
    director.onLanded(plane, { verticalSpeed: -1.2 });
    director.score += 800;
    settleAttitude(plane);
    game.mode = MODES.COMPLETE;
    director.finish();
    return true;
  }
  return false;
}
