// Skylark Valley's world: the course, the terrain under it, and the
// things standing on it. One job: answer "what is here?" for any point
// along the valley, so the renderer and the flight model agree.

import { VIEW, WORLD, RUNWAY, MISSIONS } from './config.js';
import { mulberry32, makeFractalNoise, clamp } from './random.js';

// A course segment: one slice of the valley, 100 m long.
function makeSegment(index) {
  return {
    index,
    // Centreline of the course in world metres; integrated from curvature.
    cx: 0,
    cz: index * VIEW.segmentLength,
    // Height of the valley floor at the centreline.
    floor: 0,
    // Gentle heading change through this segment, in degrees.
    curve: 0,
    // What the ground looks like here: grass, field, forest, town, river.
    zone: 'grass',
    // Decorations standing on this segment, placed at build time.
    trees: [],
    houses: [],
    // Which ring (if any) stands on this segment, set by the mission.
    ring: null,
    // True on the runway strip.
    runway: false,
  };
}

export class ValleyWorld {
  constructor(seed = 7) {
    this.seed = seed;
    this.rand = mulberry32(seed * 7919 + 13);
    this.hills = makeFractalNoise(seed + 5);
    this.segments = [];
    this.clouds = [];
    this.buildCourse();
    this.buildDecorations();
    this.buildClouds();
  }

  buildCourse() {
    const { totalSegments } = WORLD;
    let heading = 0; // degrees, 0 = due east along the valley
    let cx = 0;
    for (let i = 0; i < totalSegments; i += 1) {
      const seg = makeSegment(i);
      // The runway is dead straight; past it the valley wanders in
      // long easy S-curves, never a hairpin.
      const wander = i < RUNWAY.lengthSegments ? 0 : this.hills(i * 0.11) * 1.9;
      seg.curve = wander;
      heading += seg.curve;
      heading = clamp(heading, -26, 26);
      const rad = (heading * Math.PI) / 180;
      cx += Math.sin(rad) * VIEW.segmentLength;
      seg.cx = cx;
      seg.cz = i * VIEW.segmentLength;
      // Valley floor: rolling, between 0 and 26 m, flattening at the runway.
      seg.floor = i < RUNWAY.lengthSegments ? 0 : 6 + this.hills(i * 0.35) * 9 + 9;
      seg.runway = i >= RUNWAY.firstSegment && i < RUNWAY.lengthSegments;
      seg.zone = this.zoneFor(i);
      this.segments.push(seg);
    }
    // The course doubles back: after the last ring the valley bends home
    // so the return leg is the same strip flown the other way in spirit —
    // the runway waits at segment 0 and the pilot turns for final.
    this.totalLength = totalSegments * VIEW.segmentLength;
  }

  zoneFor(i) {
    if (i < RUNWAY.lengthSegments) return 'runway';
    if (i >= 128 && i < 150) return 'town';
    if (i >= 200 && i < 214) return 'forest';
    if (i >= 236 && i < 250) return 'town';
    const n = this.hills(i * 0.9 + 40);
    if (n > 0.42) return 'field-gold';
    if (n > 0.18) return 'field-green';
    if (n < -0.45) return 'forest';
    return 'grass';
  }

  buildDecorations() {
    for (const seg of this.segments) {
      if (seg.runway) continue;
      // Trees: scattered copses, denser in forest zones.
      const density = seg.zone === 'forest' ? 7 : seg.zone === 'town' ? 1 : 3;
      for (let k = 0; k < density; k += 1) {
        if (this.rand() < 0.55) {
          const side = this.rand() < 0.5 ? -1 : 1;
          const lateral = side * (90 + this.rand() * 420);
          seg.trees.push({
            x: lateral,
            size: 9 + this.rand() * 14,
            shade: this.rand(),
          });
        }
      }
      // Houses: a little town straddles the course in two places.
      if (seg.zone === 'town') {
        for (let k = 0; k < 3; k += 1) {
          if (this.rand() < 0.6) {
            const side = this.rand() < 0.5 ? -1 : 1;
            seg.houses.push({
              x: side * (70 + this.rand() * 160),
              w: 14 + this.rand() * 10,
              h: 10 + this.rand() * 9,
              roof: this.rand(),
            });
          }
        }
      }
    }
  }

  buildClouds() {
    for (let i = 0; i < 26; i += 1) {
      this.clouds.push({
        x: (this.rand() - 0.5) * 5200,
        y: 260 + this.rand() * 260,
        z: this.rand() * this.totalLength,
        scale: 60 + this.rand() * 130,
        shade: 0.82 + this.rand() * 0.18,
      });
    }
  }

  segmentAt(distance) {
    const i = Math.floor(distance / VIEW.segmentLength);
    if (i < 0) return this.segments[0];
    if (i >= this.segments.length) return this.segments[this.segments.length - 1];
    return this.segments[i];
  }

  // Height of the ground at a world position: valley floor plus the
  // walls that rise as you leave the centreline, plus small bumps.
  groundHeightAt(distance, lateralX) {
    const seg = this.segmentAt(distance);
    const rel = lateralX - seg.cx;
    const abs = Math.abs(rel);
    let h = seg.floor;
    if (abs > WORLD.wallStart) {
      const t = (abs - WORLD.wallStart) / 420;
      h += Math.min(WORLD.maxWallHeight, t * t * WORLD.wallSteepness * 420 * 420);
      h += this.hills(distance * 0.05 + rel * 0.02) * 22 * t;
    }
    h += this.hills(distance * 0.3 + rel * 0.05) * 1.6;
    return h;
  }

  // The river runs beside the course and crosses it once; a low pass
  // over water is the prettiest line in the valley.
  riverOffsetAt(segmentIndex) {
    const d = segmentIndex - WORLD.riverAtSegment;
    if (d < -30 || d > 260) return null;
    return 150 + d * 1.1;
  }

  // Place a mission's rings onto the course. Returns the ring objects
  // the flight model and renderer share.
  loadMission(mission) {
    for (const seg of this.segments) seg.ring = null;
    const rings = mission.rings.map((def, i) => {
      const seg = this.segments[def.segment];
      const ring = {
        id: i,
        segment: def.segment,
        x: seg.cx + def.x,
        // Height above the valley floor at that segment.
        y: seg.floor + def.height,
        radius: def.radius,
        passed: false,
        centre: false,
      };
      seg.ring = ring;
      return ring;
    });
    return rings;
  }
}

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
