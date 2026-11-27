// Skylark Valley's missions: what counts as progress, what counts
// as a landing, and what the scoreboard says at the end. One job:
// the rules of the game, kept apart from the flying and the drawing.

import { SCORING, PLANE } from './config.js';
import { guidanceTo } from './physics.js';

export const MODES = {
  TITLE: 'title',
  FLYING: 'flying',
  PAUSED: 'paused',
  LANDED: 'landed',
  CRASHED: 'crashed',
  COMPLETE: 'complete',
};

export class MissionDirector {
  constructor(world, mission) {
    this.world = world;
    this.mission = mission;
    this.rings = world.loadMission(mission);
    this.score = 0;
    this.elapsed = 0;
    this.landed = false;
    this.landingReport = null;
    this.crashReason = '';
    this.landingQuality = 0;
    this.messages = [];
    this.bestScore = 0;
    try {
      this.bestScore = Number(window.localStorage.getItem('skylark-best-' + mission.id) || 0);
    } catch {
      this.bestScore = 0;
    }
  }

  get nextRing() {
    return this.rings.find((r) => !r.passed) || null;
  }

  get ringsDone() {
    return this.rings.filter((r) => r.passed).length;
  }

  get allRingsDone() {
    return this.rings.every((r) => r.passed);
  }

  toast(text, color = '#ffffff') {
    this.messages.push({ text, color, at: performance.now() / 1000 });
    if (this.messages.length > 4) this.messages.shift();
  }

  // Called every frame while flying: ring checks, timers, fuel warnings.
  update(plane, dt, audio) {
    this.elapsed += dt;
    const ring = this.nextRing;
    if (ring) {
      const dx = ring.x - plane.x;
      const dy = ring.y - plane.y;
      const dz = ring.segment * 100 - plane.s;
      const dist = Math.hypot(dx, dy, dz);
      // Threading the ring: close in all three axes as it passes.
      if (Math.abs(dz) < 14 && Math.hypot(dx, dy) < ring.radius) {
        ring.passed = true;
        const centred = Math.hypot(dx, dy) < ring.radius * 0.45;
        ring.centre = centred;
        const pts = SCORING.ringPoints + (centred ? SCORING.ringCentreBonus : 0);
        this.score += pts;
        audio.chime();
        this.toast(
          centred ? `RING ${ring.id + 1} — DEAD CENTRE! +${pts}` : `RING ${ring.id + 1} / ${this.rings.length}  +${pts}`,
          centred ? '#ffd23e' : '#7ed957',
        );
        if (this.allRingsDone) {
          this.toast('ALL RINGS — BRING HER HOME TO RUNWAY 09', '#ffd23e');
        }
      } else if (dz < -40 && !ring.passed && !ring.missed) {
        // Flew past it: the ring stays open behind, no penalty, but the
        // pilot has to turn around for it.
        this.toast(`MISSED RING ${ring.id + 1} — TURN BACK FOR IT`, '#ff9a5a');
        ring.missed = true;
      }
    }
    if (plane.fuel < 20 && !this.warnedFuel) {
      this.warnedFuel = true;
      this.toast('FUEL LOW — HEAD FOR THE RUNWAY', '#ff5a4e');
    }
    if (plane.engineOut && !this.warnedEngine) {
      this.warnedEngine = true;
      this.toast('ENGINE OUT — GLIDE HER IN', '#ff5a4e');
    }
  }

  guidance(plane) {
    return guidanceTo(plane, this.nextRing);
  }

  // A touchdown happened: score it, and decide whether the sortie ends.
  onLanded(plane, event) {
    const vs = Math.abs(event.verticalSpeed || 0);
    const smooth = Math.max(0, 1 - vs / 6);
    this.landingQuality = smooth;
    const base = this.allRingsDone ? SCORING.landingBase : 60;
    const bonus = Math.round(SCORING.landingSmoothBonus * smooth);
    const fuelBonus = Math.round(plane.fuel * SCORING.fuelBonusPerUnit);
    const timeBonus = this.allRingsDone
      ? Math.max(0, Math.round((this.mission.parSeconds - this.elapsed) * SCORING.timeBonusPerSecond))
      : 0;
    const gained = base + bonus + fuelBonus + timeBonus;
    this.score += gained;
    this.landed = true;
    const verdict =
      vs < 1.5 ? 'A GREASED LANDING' : vs < 3.5 ? 'A FIRM BUT FAIR LANDING' : 'A HARD LANDING — SHE HELD TOGETHER';
    this.toast(verdict + `  +${gained}`, '#7ed957');
    this.landingReport = {
      base,
      bonus,
      fuelBonus,
      timeBonus,
      gained,
      complete: this.allRingsDone,
    };
    return this.landingReport;
  }

  onCrash(reason) {
    this.crashReason = reason;
    this.toast('CRASHED — ' + reason.toUpperCase(), '#ff5a4e');
  }

  finish() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        window.localStorage.setItem('skylark-best-' + this.mission.id, String(this.score));
      } catch {
        // Private browsing or a hosted page without storage: the score
        // still shows, it just is not remembered.
      }
      return true;
    }
    return false;
  }
}
