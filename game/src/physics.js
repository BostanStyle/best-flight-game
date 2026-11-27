// Skylark Valley's flight model. One job: turn stick, throttle and
// time into a believable aeroplane — lift, bank, turn, stall, flare —
// and report what the ground and the rings did about it.

import { PLANE, RUNWAY, VIEW } from './config.js';
import { clamp, wrapAngle, angleDelta } from './random.js';

// The aeroplane's whole state, in world units.
export function freshPlane(world) {
  return {
    // Distance along the course, metres.
    s: 4,
    // Lateral world position, metres (course centreline is seg.cx).
    x: world.segments[0].cx,
    // Altitude above sea level; the valley floor is ~0-24 m.
    y: 1.2,
    heading: RUNWAY.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    flaps: false,
    gearDown: true,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    airborne: false,
    verticalSpeed: 0,
    onGround: true,
    engineOut: false,
    // Smoothed values the camera and instruments read.
    displayRoll: 0,
    displayPitch: 0,
  };
}

export function stepFlight(plane, input, world, dt) {
  const seg = world.segmentAt(plane.s);
  const ground = world.groundHeightAt(plane.s, plane.x);
  const heightAboveGround = plane.y - ground;
  const onRunway = seg.runway && Math.abs(plane.x - seg.cx) < RUNWAY.width / 2;

  // --- Throttle and fuel -------------------------------------------------
  plane.throttle = clamp(plane.throttle + input.throttleDelta * dt * 1.4, 0, 1);
  const burn =
    plane.throttle <= 0.02
      ? 0.02
      : PLANE.fuelBurnCruise + (PLANE.fuelBurnFull - PLANE.fuelBurnCruise) * plane.throttle;
  if (!plane.onGround || plane.speed > 5) plane.fuel = Math.max(0, plane.fuel - burn * dt);
  plane.engineOut = plane.fuel <= 0;

  // --- Speed --------------------------------------------------------------
  const drag = 0.0016 * plane.speed * plane.speed;
  const gearDrag = plane.gearDown && plane.airborne ? PLANE.gearDrag * plane.speed : 0;
  const flapDrag = plane.flaps ? PLANE.flapDrag * plane.speed : 0;
  const thrust = plane.engineOut ? 0 : plane.throttle * 16;
  const slopeDrag = plane.airborne ? Math.sin((plane.pitch * Math.PI) / 180) * 9.8 * 0.9 : 0;
  let accel = thrust - drag - gearDrag - flapDrag - slopeDrag;
  if (plane.onGround) {
    // Rolling resistance, then the wing starts to carry the weight.
    accel -= 1.1;
    if (plane.speed > PLANE.takeoffSpeed * 0.6) accel += 0.8;
  }
  plane.speed = Math.max(0, plane.speed + accel * dt);
  if (plane.speed > PLANE.maxSpeed) plane.speed = PLANE.maxSpeed;

  // --- Attitude -----------------------------------------------------------
  const stalled = plane.airborne && plane.speed < PLANE.stallSpeed;
  const rollTarget = clamp(input.roll * PLANE.maxBank, -PLANE.maxBank, PLANE.maxBank);
  const rollRate = plane.onGround ? 0 : PLANE.rollRate;
  plane.roll += clamp(rollTarget - plane.roll, -rollRate * dt, rollRate * dt);
  // On the runway the pilot can rotate once the wing has speed: pull
  // back past two-thirds of takeoff speed and the nose comes up.
  const pitchTarget = stalled
    ? -14 // A stalled wing drops the nose whatever the stick says.
    : plane.onGround
      ? plane.speed > PLANE.takeoffSpeed * 0.7 && input.pitch > 0
        ? input.pitch * 12
        : 0
      : clamp(input.pitch * PLANE.maxPitchUp, PLANE.maxPitchDown, PLANE.maxPitchUp);
  plane.pitch += clamp(pitchTarget - plane.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);

  // --- Turning ------------------------------------------------------------
  if (plane.airborne && plane.speed > 8) {
    const turnRate = ((9.8 * Math.tan((plane.roll * Math.PI) / 180)) / Math.max(plane.speed, 12)) * PLANE.turnFactor;
    plane.heading = wrapAngle(plane.heading + (turnRate * 180) / Math.PI * dt);
  }

  // --- Lift, climb and sink ----------------------------------------------
  const liftFactor = plane.flaps ? PLANE.flapLift : 1;
  const speedRatio = clamp(plane.speed / PLANE.cruiseSpeed, 0, 1.35);
  let climb = 0;
  if (plane.airborne) {
    climb = Math.sin((plane.pitch * Math.PI) / 180) * plane.speed * liftFactor;
    // A slow wing cannot hold altitude: sink grows under the stall.
    if (plane.speed < PLANE.stallSpeed) {
      climb -= (PLANE.stallSpeed - plane.speed) * 0.9;
    }
    // Level flight at cruise: the wing holds what the throttle gives.
    climb += (plane.throttle - 0.55) * 2.2 * speedRatio;
    climb = clamp(climb, -18, PLANE.climbRate);
  }
  plane.verticalSpeed = plane.airborne ? climb : 0;
  plane.y += climb * dt;

  // --- Moving along the course -------------------------------------------
  // Heading 90 is due east, down the course: along = sin, across = cos.
  const headingRad = (plane.heading * Math.PI) / 180;
  const along = Math.sin(headingRad);
  const across = Math.cos(headingRad);
  plane.s += plane.speed * along * dt;
  plane.x += plane.speed * across * dt;
  // The valley bends under the aeroplane: drifting off the centreline
  // is fine, the walls are the limit, not an invisible rail.
  const segNow = world.segmentAt(plane.s);
  const wallLimit = segNow.cx + 780;
  const wallLimitLow = segNow.cx - 780;
  if (plane.x > wallLimit) plane.x = wallLimit;
  if (plane.x < wallLimitLow) plane.x = wallLimitLow;

  // --- Takeoff and touchdown ----------------------------------------------
  const groundNow = world.groundHeightAt(plane.s, plane.x);
  const hag = plane.y - groundNow;
  const events = [];
  if (!plane.airborne) {
    if (plane.speed >= PLANE.takeoffSpeed && plane.pitch > 2) {
      plane.airborne = true;
      plane.onGround = false;
      events.push({ type: 'takeoff' });
    } else {
      // Rolling along the ground: stay planted on it.
      plane.y = groundNow + 1.2;
    }
  }
  if (plane.airborne && hag <= 1.2) {
    // Either runway direction counts: 09 out, 27 back home.
    const aligned =
      Math.abs(angleDelta(plane.heading, RUNWAY.heading)) < 14 ||
      Math.abs(angleDelta(plane.heading, RUNWAY.heading + 180)) < 14;
    const onStrip = segNow.runway && Math.abs(plane.x - segNow.cx) < RUNWAY.width / 2;
    const gentle = plane.verticalSpeed > -PLANE.crashVerticalSpeed;
    if (onStrip && gentle && aligned && plane.gearDown) {
      // Touchdown: a landing, scored by how gently it happened.
      plane.airborne = false;
      plane.onGround = true;
      plane.y = groundNow + 1.2;
      plane.pitch = 0;
      events.push({ type: 'landed', verticalSpeed: plane.verticalSpeed, aligned, onStrip });
    } else if (onStrip && gentle && aligned && !plane.gearDown) {
      events.push({ type: 'crash', reason: 'belly landing — the gear was up' });
    } else if (hag <= 0.4) {
      events.push({ type: 'crash', reason: gentle ? 'ran off the runway' : 'hit the ground hard' });
    } else {
      // Skimming the grass: drag the wheels through it, lose speed.
      plane.speed *= 1 - 0.6 * dt;
      plane.y = groundNow + 1.2;
    }
  }
  // Into a valley wall: the ground check above already covers the rise,
  // but a steep wall at speed is a crash, not a landing.
  if (plane.airborne && hag <= 0.4 && plane.verticalSpeed < -PLANE.crashVerticalSpeed) {
    events.push({ type: 'crash', reason: 'flew into the hillside' });
  }
  // The valley ends; the pilot turns for home before the last ridge.
  if (plane.s >= world.totalLength - 100) plane.s = world.totalLength - 100;
  if (plane.s < 0) plane.s = 0;

  // Smooth the displayed attitude so the picture never jitters.
  plane.displayRoll += (plane.roll - plane.displayRoll) * Math.min(1, dt * 10);
  plane.displayPitch += (plane.pitch - plane.displayPitch) * Math.min(1, dt * 10);

  return { events, ground, heightAboveGround: hag, onRunway };
}

// How far the next ring is, and which way to look for it — the HUD's
// guidance arrow reads this every frame. Left/right is measured in the
// pilot's own frame: forward is (sin hdg, cos hdg) in (s, x) space,
// so right is (cos hdg, -sin hdg).
export function guidanceTo(plane, ring) {
  if (!ring) return null;
  const ds = ring.segment * VIEW.segmentLength - plane.s;
  const dx = ring.x - plane.x;
  const up = ring.y - plane.y;
  const headingRad = (plane.heading * Math.PI) / 180;
  const along = ds * Math.sin(headingRad) + dx * Math.cos(headingRad);
  const right = ds * Math.cos(headingRad) - dx * Math.sin(headingRad);
  const dist = Math.hypot(ds, dx, up);
  return {
    dist,
    leftRight: clamp(right / 240, -1, 1),
    upDown: clamp(up / 120, -1, 1),
    ahead: along > -30,
  };
}
