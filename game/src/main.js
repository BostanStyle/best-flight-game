// Skylark Valley — the game itself. One job: own the loop and the
// screens (title, flying, paused, landed, crashed, complete) and hand
// the flying, the drawing and the sound to the modules that do them.

import { VIEW, MISSIONS } from './config.js';
import { ValleyWorld, missionById } from './world.js';
import { freshPlane, stepFlight } from './physics.js';
import { ValleyRenderer } from './render.js';
import { Cockpit } from './instruments.js';
import { ValleyAudio } from './audio.js';
import { PilotInput } from './input.js';
import { MissionDirector, MODES } from './missions.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7) || 7;

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const ctx = canvas.getContext('2d');

const renderer = new ValleyRenderer(canvas);
const cockpit = new Cockpit();
const audio = new ValleyAudio();
const input = new PilotInput(canvas);

const game = {
  world: new ValleyWorld(seed),
  plane: null,
  director: null,
  mission: missionById(params.get('mission') || 'ring-run'),
  mode: MODES.TITLE,
  selectedMission: 0,
  mouseSteer: false,
  shotFrozen: false,
  landingReport: null,
  crashReport: null,
  showHelp: false,
};

function startMission(index) {
  game.selectedMission = index;
  game.mission = MISSIONS[index];
  game.world = new ValleyWorld(seed);
  game.plane = freshPlane(game.world);
  game.director = new MissionDirector(game.world, game.mission);
  game.mode = MODES.FLYING;
  game.landingReport = null;
  game.crashReport = null;
  game.director.toast(game.mission.name.toUpperCase() + ' — THROTTLE UP, ROTATE AT 70 KT', '#ffd23e');
  audio.ensure();
}

game.plane = freshPlane(game.world);
game.director = new MissionDirector(game.world, game.mission);

// A screenshot state freezes the frame: the picture is the render.
const shot = params.get('shot');
if (shot) {
  applyShot(game, shot);
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.poll();
  handleKeys();
  handleClicks();
  if (game.mode === MODES.FLYING && !game.shotFrozen) {
    const { events } = stepFlight(game.plane, input, game.world, dt);
    game.director.update(game.plane, dt, audio);
    for (const e of events) handleEvent(e);
  }
  if (game.mode === MODES.FLYING) audio.update(game.plane);
  const state = {
    world: game.world,
    plane: game.plane,
    mission: game.mission,
    rings: game.director.rings,
    nextRing: game.director.nextRing,
    score: game.director.score,
    elapsed: game.director.elapsed,
    messages: game.director.messages,
    guidance: game.mode === MODES.FLYING ? game.director.guidance(game.plane) : null,
    mode: game.mode,
  };
  renderer.render(state);
  cockpit.draw(ctx, VIEW.width, VIEW.height, state, now / 1000);
  if (game.mode === MODES.TITLE) drawTitle(ctx);
  if (game.mode === MODES.PAUSED) drawPaused(ctx);
  if (game.mode === MODES.LANDED || game.mode === MODES.COMPLETE) drawEndScreen(ctx, true);
  if (game.mode === MODES.CRASHED) drawEndScreen(ctx, false);
  if (game.showHelp) drawHelp(ctx);
  input.endFrame();
  requestAnimationFrame(frame);
}

function handleEvent(e) {
  if (e.type === 'takeoff') {
    game.director.toast('AIRBORNE — GEAR UP WHEN YOU ARE READY', '#7ed957');
    audio.blip(880, 0.25, 'sine', 0.12);
  }
  if (e.type === 'landed') {
    const report = game.director.onLanded(game.plane, e);
    game.landingReport = report;
    audio.thud();
    game.mode = report.complete ? MODES.COMPLETE : MODES.LANDED;
    if (report.complete) {
      audio.fanfare();
      game.director.finish();
    }
  }
  if (e.type === 'crash') {
    game.director.onCrash(e.reason);
    game.crashReport = e.reason;
    audio.crash();
    game.mode = MODES.CRASHED;
  }
}

function handleKeys() {
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (game.mode === MODES.FLYING) game.mode = MODES.PAUSED;
    else if (game.mode === MODES.PAUSED) game.mode = MODES.FLYING;
  }
  if (input.wasPressed('KeyM')) {
    audio.ensure();
    const muted = audio.toggleMute();
    game.director.toast(muted ? 'SOUND OFF' : 'SOUND ON', '#9fb4c4');
  }
  if (input.wasPressed('KeyF') && game.mode === MODES.FLYING) {
    game.plane.flaps = !game.plane.flaps;
    game.director.toast(game.plane.flaps ? 'FLAPS DOWN' : 'FLAPS UP', '#9fb4c4');
  }
  if (input.wasPressed('KeyG') && game.mode === MODES.FLYING) {
    game.plane.gearDown = !game.plane.gearDown;
    game.director.toast(game.plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', '#9fb4c4');
  }
  if (input.wasPressed('KeyR') && game.mode !== MODES.TITLE) {
    startMission(game.selectedMission);
  }
  if (input.wasPressed('Enter') || input.wasPressed('Space')) {
    if (game.mode === MODES.TITLE) startMission(game.selectedMission);
    else if (game.mode === MODES.LANDED || game.mode === MODES.COMPLETE || game.mode === MODES.CRASHED) {
      game.mode = MODES.TITLE;
      game.plane = freshPlane(game.world);
      game.director = new MissionDirector(game.world, game.mission);
    }
  }
  if (input.wasPressed('KeyH')) game.showHelp = !game.showHelp;
  if (input.wasPressed('ArrowUp') && game.mode === MODES.TITLE) {
    game.selectedMission = (game.selectedMission + MISSIONS.length - 1) % MISSIONS.length;
    game.mission = MISSIONS[game.selectedMission];
  }
  if (input.wasPressed('ArrowDown') && game.mode === MODES.TITLE) {
    game.selectedMission = (game.selectedMission + 1) % MISSIONS.length;
    game.mission = MISSIONS[game.selectedMission];
  }
  // Mouse steering: moving the pointer steers once the pilot opts in.
  if (input.wasPressed('KeyX')) {
    game.mouseSteer = !game.mouseSteer;
    input.mouseSteer = game.mouseSteer;
    game.director.toast(game.mouseSteer ? 'MOUSE STEERING ON' : 'MOUSE STEERING OFF', '#9fb4c4');
  }
}

function handleClicks() {
  if (input.clicks.length === 0) return;
  audio.ensure();
  if (game.mode === MODES.TITLE) {
    // Mission cards down the left, then the big FLY button.
    for (let i = 0; i < MISSIONS.length; i += 1) {
      if (input.clickedIn(0.04, 0.30 + i * 0.13, 0.36, 0.41 + i * 0.13)) {
        game.selectedMission = i;
        game.mission = MISSIONS[i];
        game.director = new MissionDirector(game.world, game.mission);
        return;
      }
    }
    if (input.clickedIn(0.38, 0.68, 0.62, 0.76)) startMission(game.selectedMission);
    return;
  }
  if (game.mode === MODES.LANDED || game.mode === MODES.COMPLETE || game.mode === MODES.CRASHED) {
    if (input.clickedIn(0.38, 0.80, 0.62, 0.88)) {
      game.mode = MODES.TITLE;
      game.plane = freshPlane(game.world);
      game.director = new MissionDirector(game.world, game.mission);
    }
    return;
  }
  if (game.mode === MODES.PAUSED) {
    if (input.clickedIn(0.38, 0.56, 0.62, 0.64)) game.mode = MODES.FLYING;
    return;
  }
  // In flight, clicks on the panel edges toggle sound and pause.
  if (input.clickedIn(0.92, 0.86, 0.99, 0.98)) {
    const muted = audio.toggleMute();
    game.director.toast(muted ? 'SOUND OFF' : 'SOUND ON', '#9fb4c4');
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12, 15, 20, 0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawTitle(ctx) {
  const w = VIEW.width;
  const h = VIEW.height;
  ctx.fillStyle = 'rgba(10, 18, 30, 0.42)';
  ctx.fillRect(0, 0, w, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;
  ctx.fillText('SKYLARK VALLEY', w / 2, 84);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#eaf2f8';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('A little aeroplane, a long valley, and rings to thread.', w / 2, 122);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#c8d6e2';
  ctx.fillText('Take off from runway 09, fly the rings, land her home. Watch the fuel.', w / 2, 152);
  // Mission cards down the left, clear of the aeroplane in the middle.
  for (let i = 0; i < MISSIONS.length; i += 1) {
    const m = MISSIONS[i];
    const y = h * (0.30 + i * 0.13);
    const selected = i === game.selectedMission;
    ctx.fillStyle = selected ? 'rgba(255, 210, 62, 0.16)' : 'rgba(12, 15, 20, 0.72)';
    ctx.beginPath();
    ctx.roundRect(w * 0.04, y, w * 0.32, h * 0.11, 10);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd23e' : 'rgba(200, 210, 220, 0.4)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = selected ? '#ffd23e' : '#eaf2f8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText((i + 1) + '. ' + m.name, w * 0.06, y + 28);
    ctx.fillStyle = '#c8d6e2';
    ctx.font = '13px sans-serif';
    ctx.fillText(m.tagline, w * 0.06, y + 50);
    ctx.fillStyle = '#9fb4c4';
    ctx.font = '12px sans-serif';
    ctx.fillText('Par ' + Math.floor(m.parSeconds / 60) + ':' + String(m.parSeconds % 60).padStart(2, '0'), w * 0.06, y + 68);
    const best = Number(window.localStorage.getItem('skylark-best-' + m.id) || 0);
    if (best > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7ed957';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('BEST ' + best, w * 0.34, y + 28);
    }
  }
  // The big FLY button, above the instrument panel.
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.roundRect(w * 0.38, h * 0.68, w * 0.24, h * 0.08, 12);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FLY  ▸', w / 2, h * 0.68 + 38);
  ctx.fillStyle = '#c8d6e2';
  ctx.font = '13px sans-serif';
  ctx.fillText('Arrows / WASD fly · Shift / Ctrl throttle · F flaps · G gear · X mouse steering · P pause · H help', w / 2, h * 0.785);
}

function drawPaused(ctx) {
  const w = VIEW.width;
  const h = VIEW.height;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.6)';
  ctx.fillRect(0, 0, w, h);
  panel(ctx, w * 0.32, h * 0.30, w * 0.36, h * 0.34);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('PAUSED', w / 2, h * 0.30 + 52);
  ctx.fillStyle = '#eaf2f8';
  ctx.font = '15px sans-serif';
  ctx.fillText('The valley waits. The fuel does not burn while paused.', w / 2, h * 0.30 + 88);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.roundRect(w * 0.38, h * 0.56, w * 0.24, h * 0.08, 12);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('RESUME', w / 2, h * 0.56 + 36);
}

function drawEndScreen(ctx, landed) {
  const w = VIEW.width;
  const h = VIEW.height;
  const d = game.director;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  ctx.fillRect(0, 0, w, h * 0.62);
  panel(ctx, w * 0.28, h * 0.10, w * 0.44, h * 0.52);
  ctx.textAlign = 'center';
  if (landed) {
    ctx.fillStyle = '#7ed957';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillText(d.landingReport && d.landingReport.complete ? 'SORTIE COMPLETE' : 'LANDED', w / 2, h * 0.10 + 54);
    ctx.fillStyle = '#eaf2f8';
    ctx.font = '16px sans-serif';
    ctx.fillText(
      d.landingReport && d.landingReport.complete
        ? 'Every ring flown, and home in one piece.'
        : 'Down safe — but rings remain. Fly again for the full sortie.',
      w / 2,
      h * 0.10 + 84,
    );
  } else {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillText('CRASHED', w / 2, h * 0.10 + 54);
    ctx.fillStyle = '#eaf2f8';
    ctx.font = '16px sans-serif';
    ctx.fillText(game.crashReport || 'The valley wins this round.', w / 2, h * 0.10 + 84);
  }
  const rows = [];
  rows.push(['SCORE', String(d.score)]);
  rows.push(['RINGS', d.ringsDone + ' / ' + d.rings.length]);
  const mins = Math.floor(d.elapsed / 60);
  const secs = Math.floor(d.elapsed % 60);
  rows.push(['TIME', mins + ':' + String(secs).padStart(2, '0')]);
  if (d.landingReport) {
    rows.push(['LANDING', '+' + d.landingReport.gained]);
  }
  rows.push(['BEST', String(d.bestScore)]);
  ctx.font = 'bold 17px monospace';
  let y = h * 0.10 + 122;
  for (const [label, value] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fb4c4';
    ctx.fillText(label, w * 0.33, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#eaf2f8';
    ctx.fillText(value, w * 0.67, y);
    y += 30;
  }
  if (d.score >= d.bestScore && d.score > 0) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ NEW BEST SCORE ★', w / 2, y + 6);
  }
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.roundRect(w * 0.38, h * 0.80, w * 0.24, h * 0.08, 12);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FLY AGAIN', w / 2, h * 0.80 + 36);
}

function drawHelp(ctx) {
  const w = VIEW.width;
  const h = VIEW.height;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.75)';
  ctx.fillRect(0, 0, w, h);
  panel(ctx, w * 0.24, h * 0.16, w * 0.52, h * 0.62);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('How to fly', w * 0.28, h * 0.16 + 44);
  const lines = [
    ['↑ / ↓ or W / S', 'Pitch the nose up and down'],
    ['← / → or A / D', 'Bank left and right — bank turns the aeroplane'],
    ['Shift / Ctrl', 'Throttle up and down (mouse wheel works too)'],
    ['Mouse (X)', 'Steer with the pointer, like a sidestick'],
    ['F', 'Flaps: more lift, more drag — for slow flight and landing'],
    ['G', 'Landing gear: down to land, up to go faster'],
    ['Space / Enter', 'Start, and fly again after landing'],
    ['P', 'Pause   ·   M mute   ·   R restart   ·   H this help'],
    ['', ''],
    ['The sortie', 'Thread every ring, then land on runway 09.'],
    ['', 'Mind the fuel gauge, the stall lamp, and the hills.'],
    ['', 'A gentle touchdown on the strip scores best.'],
  ];
  ctx.font = '15px sans-serif';
  let y = h * 0.16 + 84;
  for (const [key, text] of lines) {
    ctx.fillStyle = '#ffd23e';
    ctx.fillText(key, w * 0.28, y);
    ctx.fillStyle = '#eaf2f8';
    ctx.fillText(text, w * 0.46, y);
    y += 28;
  }
  ctx.fillStyle = '#9fb4c4';
  ctx.font = '13px sans-serif';
  ctx.fillText('Press H to close.', w * 0.28, h * 0.16 + 44 + 13 * 28 + 10);
}

requestAnimationFrame(frame);
