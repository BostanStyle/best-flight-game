// Skylark Valley's renderer. One job: turn the world and the aeroplane
// into one picture — sky, sun, mountains, clouds, the valley floor
// rushing past, the rings ahead and the Skylark herself in frame.
// Everything is drawn with canvas paths; there are no image files.

import { VIEW, RUNWAY, WORLD, PALETTE } from './config.js';
import { clamp, lerp } from './random.js';

// Project a world point into screen space, racer style. dir is the
// view direction along the course: +1 flying out, -1 flying home,
// in which case the world is mirrored front-to-back.
function projectPoint(px, py, pz, camX, camY, camZ, width, height, dir = 1) {
  const relX = dir * (px - camX);
  const relY = py - camY;
  const relZ = dir * (pz - camZ);
  if (relZ < 1) return null;
  const scale = VIEW.cameraDepth / relZ;
  return {
    x: width / 2 + scale * relX * (width / 2),
    y: height / 2 - scale * relY * (height / 2),
    scale,
  };
}

export class ValleyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = VIEW.width;
    this.height = VIEW.height;
    this.time = 0;
    // Which way the camera looks along the course: +1 out, -1 home.
    // Hysteresis keeps it from flipping while the pilot turns around.
    this.viewDir = 1;
  }

  render(state) {
    const { ctx, width, height } = this;
    const { world, plane, mission, rings, nextRing, mode } = state;
    this.time += 1 / 60;
    const camX = plane.x;
    const camY = plane.y + 2.2;
    const camZ = plane.s;
    const horizonShift = plane.displayPitch * 5.5;
    const along = Math.sin((plane.heading * Math.PI) / 180);
    if (along > 0.4) this.viewDir = 1;
    else if (along < -0.4) this.viewDir = -1;
    const viewDir = this.viewDir;
    const homeHeading = viewDir === 1 ? RUNWAY.heading : RUNWAY.heading + 180;
    const headingError = ((plane.heading - homeHeading + 540) % 360) - 180;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // The camera banks with the aeroplane: the horizon tilts, the
    // Skylark stays near level on the screen, as in a chase camera.
    ctx.translate(width / 2, height * 0.52);
    ctx.rotate((-plane.displayRoll * 0.62 * Math.PI) / 180);
    ctx.translate(-width / 2, -height * 0.52);

    this.drawSky(ctx, width, height, horizonShift, headingError, plane, viewDir);
    this.drawMountains(ctx, width, height, horizonShift, headingError);
    this.drawClouds(ctx, width, height, world, camX, camY, camZ, horizonShift, viewDir);
    this.drawTerrain(ctx, width, height, world, rings, camX, camY, camZ, horizonShift, plane, viewDir);
    this.drawRings(ctx, width, height, rings, nextRing, camX, camY, camZ, horizonShift, viewDir);
    this.drawPlaneShadow(ctx, width, height, world, plane, camX, camY, camZ, horizonShift, viewDir);
    ctx.restore();

    // The aeroplane herself: drawn after the world, level on the
    // screen, banked only a little — the camera does most of the tilt.
    this.drawPlane(ctx, width, height, plane, state);
  }

  drawSky(ctx, width, height, horizonShift, headingError, plane, viewDir) {
    const horizonY = height * 0.52 + horizonShift;
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = grad;
    // Cover the whole canvas: the rect must reach past the bottom edge
    // or the page background shows through below the terrain.
    ctx.fillRect(-width, -height, width * 3, height * 3);

    // Morning sun, dead ahead down the runway: the valley flies east.
    // On the way home it sits behind the pilot, so it stays out of view.
    if (viewDir !== 1) return;
    const sunX = width / 2 - headingError * 9;
    const sunY = horizonY - 86;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
    glow.addColorStop(0, PALETTE.sunCore);
    glow.addColorStop(0.25, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMountains(ctx, width, height, horizonShift, headingError) {
    const horizonY = height * 0.52 + horizonShift;
    const ridges = [
      { amp: 74, base: horizonY + 2, color: '#8fa8c4', drift: 0.4, phase: 0 },
      { amp: 46, base: horizonY + 2, color: '#6d8aa8', drift: 0.8, phase: 2.2 },
    ];
    for (const ridge of ridges) {
      ctx.fillStyle = ridge.color;
      ctx.beginPath();
      ctx.moveTo(-width, ridge.base);
      for (let x = -width; x <= width * 2; x += 70) {
        const t = (x + headingError * 120 * ridge.drift + ridge.phase * 300) / 640;
        const peak =
          Math.abs(Math.sin(t * 1.7)) * 0.45 +
          Math.abs(Math.sin(t * 3.1 + 1)) * 0.3 +
          Math.abs(Math.sin(t * 7.3 + 2)) * 0.25;
        ctx.lineTo(x, ridge.base - peak * ridge.amp);
      }
      ctx.lineTo(width * 2, ridge.base);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawClouds(ctx, width, height, world, camX, camY, camZ, horizonShift, viewDir) {
    ctx.fillStyle = '#ffffff';
    for (const cloud of world.clouds) {
      const dz = viewDir * (cloud.z - camZ);
      if (dz < 50 || dz > 9000) continue;
      const p = projectPoint(cloud.x, cloud.y, cloud.z, camX, camY, camZ, width, height, viewDir);
      if (!p) continue;
      const y = p.y + horizonShift;
      if (y > height * 0.62) continue;
      // Cloud size in metres, projected to pixels like everything else.
      const s = p.scale * cloud.scale * (width / 2);
      if (s < 2) continue;
      ctx.globalAlpha = 0.88 * cloud.shade;
      ctx.beginPath();
      ctx.ellipse(p.x, y, s * 1.9, s * 0.62, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - s * 1.1, y + s * 0.12, s * 1.1, s * 0.45, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + s * 1.1, y + s * 0.1, s * 1.2, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawTerrain(ctx, width, height, world, rings, camX, camY, camZ, horizonShift, plane, viewDir) {
    const base = Math.floor(camZ / VIEW.segmentLength);
    const horizonY = height * 0.52 + horizonShift;
    // The ground right under the camera: the nearest segment often sits
    // behind the camera, so its band is skipped and the bottom of the
    // screen would stay sky. Paint a band from a point just ahead of
    // the camera to the first segment, so the valley floor — or the
    // runway — always reaches the bottom of the picture.
    this.drawNearGround(ctx, width, height, world, base, camX, camY, camZ, horizonShift, viewDir);
    // Far to near: each segment paints its band of valley floor, then
    // anything standing on it, so nearer things cover farther ones.
    for (let n = VIEW.drawDistance - 1; n >= 0; n -= 1) {
      const i = viewDir === 1 ? base + n : base - n;
      if (i < 0 || i >= world.segments.length - 1) continue;
      const s1 = world.segments[i];
      const s2 = world.segments[viewDir === 1 ? i + 1 : i - 1];
      if (!s2) continue;
      const p1 = projectPoint(s1.cx, s1.floor, s1.cz, camX, camY, camZ, width, height, viewDir);
      const p2 = projectPoint(s2.cx, s2.floor, s2.cz, camX, camY, camZ, width, height, viewDir);
      if (!p1 || !p2) continue;
      const y1 = p1.y + horizonShift;
      const y2 = p2.y + horizonShift;
      if (y2 <= horizonY - 2 && y1 <= horizonY - 2) {
        // Entirely above the horizon: nothing of the ground shows.
        if (n > 4) continue;
      }
      if (y1 >= height + 40 && y2 >= height + 40) continue;
      // Grass band across the whole visible valley.
      const halfW1 = Math.max(width * 2, p1.scale * VIEW.viewHalfWidth * (width / 2));
      const halfW2 = Math.max(width * 2, p2.scale * VIEW.viewHalfWidth * (width / 2));
      const x1 = p1.x;
      const x2 = p2.x;
      ctx.fillStyle = this.groundColor(s1, i);
      ctx.beginPath();
      ctx.moveTo(x1 - halfW1, y1);
      ctx.lineTo(x2 - halfW2, y2);
      ctx.lineTo(x2 + halfW2, y2);
      ctx.lineTo(x1 + halfW1, y1);
      ctx.closePath();
      ctx.fill();
      // The river crosses the valley here: a band of water.
      const riverX = world.riverOffsetAt(i);
      if (riverX !== null) this.drawRiverBand(ctx, s1, s2, p1, p2, riverX, horizonShift, width, viewDir);
      // The runway strip, with its markings.
      if (s1.runway) this.drawRunway(ctx, s1, s2, p1, p2, horizonShift, width, i);
      // Trees and houses standing on this segment.
      this.drawDecorations(ctx, world, s1, camX, camY, camZ, horizonShift, width, height, viewDir);
    }
  }

  // The ground right under the camera, painted before the segment
  // bands: a quad from a point a few metres ahead of the camera to the
  // first segment ahead, so the valley floor reaches the screen bottom.
  drawNearGround(ctx, width, height, world, base, camX, camY, camZ, horizonShift, viewDir) {
    const nearSeg = world.segments[Math.max(0, Math.min(world.segments.length - 1, base))];
    const farIndex = viewDir === 1 ? base + 1 : base - 1;
    if (farIndex < 0 || farIndex >= world.segments.length) return;
    const farSeg = world.segments[farIndex];
    const groundBelow = world.groundHeightAt(camZ, camX);
    const pNear = projectPoint(camX, groundBelow, camZ + viewDir * 3, camX, camY, camZ, width, height, viewDir);
    const pFar = projectPoint(farSeg.cx, farSeg.floor, farSeg.cz, camX, camY, camZ, width, height, viewDir);
    if (!pNear || !pFar) return;
    const yNear = pNear.y + horizonShift;
    const yFar = pFar.y + horizonShift;
    const halfNear = pNear.scale * VIEW.viewHalfWidth * (width / 2);
    const halfFar = Math.max(width * 2, pFar.scale * VIEW.viewHalfWidth * (width / 2));
    ctx.fillStyle = this.groundColor(nearSeg, base);
    ctx.beginPath();
    ctx.moveTo(pNear.x - halfNear, yNear);
    ctx.lineTo(pFar.x - halfFar, yFar);
    ctx.lineTo(pFar.x + halfFar, yFar);
    ctx.lineTo(pNear.x + halfNear, yNear);
    ctx.closePath();
    ctx.fill();
    // The runway strip under the camera, if the camera sits on it: its
    // edges run from the bottom of the screen up to the first segment.
    if (nearSeg.runway) {
      const half = RUNWAY.width / 2;
      const offNear = (nearSeg.cx - camX) * pNear.scale * (width / 2);
      const wNear = half * pNear.scale * (width / 2);
      const wFar = half * pFar.scale * (width / 2);
      ctx.fillStyle = PALETTE.runway;
      ctx.beginPath();
      ctx.moveTo(pNear.x + offNear - wNear, yNear);
      ctx.lineTo(pFar.x - wFar, yFar);
      ctx.lineTo(pFar.x + wFar, yFar);
      ctx.lineTo(pNear.x + offNear + wNear, yNear);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.runwayMark;
      // The dash right under the camera projects enormous; cap it so
      // the centreline reads as a line, not a white wedge.
      const dashNear = Math.min(34, Math.max(1, 1.2 * pNear.scale * (width / 2)));
      const dashFar = Math.max(1, 1.2 * pFar.scale * (width / 2));
      ctx.beginPath();
      ctx.moveTo(pNear.x + offNear - dashNear / 2, yNear);
      ctx.lineTo(pFar.x - dashFar / 2, yFar);
      ctx.lineTo(pFar.x + dashFar / 2, yFar);
      ctx.lineTo(pNear.x + offNear + dashNear / 2, yNear);
      ctx.closePath();
      ctx.fill();
    }
  }

  groundColor(seg, index) {
    // Wide, gentle bands: farmland, not a barcode.
    const alt = index % 6 < 3;
    switch (seg.zone) {
      case 'field-gold': return alt ? PALETTE.fieldGold : '#bfa04a';
      case 'field-green': return alt ? PALETTE.fieldGreen : '#548636';
      case 'forest': return alt ? '#4a7d33' : '#43712e';
      case 'town': return alt ? '#9aa06b' : '#8f955f';
      case 'runway': return alt ? '#6f9a44' : '#678f3f';
      default: return alt ? '#82b152' : '#7aa84e';
    }
  }

  drawRiverBand(ctx, s1, s2, p1, p2, riverX, horizonShift, width, viewDir) {
    // The river's centreline sits riverX metres off the course centre;
    // its screen offset mirrors when the pilot flies home.
    const rx1 = p1.x + viewDir * riverX * p1.scale * (width / 2);
    const rx2 = p2.x + viewDir * riverX * p2.scale * (width / 2);
    const w1 = WORLD.riverWidth * p1.scale * (width / 2);
    const w2 = WORLD.riverWidth * p2.scale * (width / 2);
    ctx.fillStyle = PALETTE.river;
    ctx.beginPath();
    ctx.moveTo(rx1 - w1 / 2, p1.y + horizonShift);
    ctx.lineTo(rx2 - w2 / 2, p2.y + horizonShift);
    ctx.lineTo(rx2 + w2 / 2, p2.y + horizonShift);
    ctx.lineTo(rx1 + w1 / 2, p1.y + horizonShift);
    ctx.closePath();
    ctx.fill();
    // Sunlight glinting on the water.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = Math.max(1, w1 / 18);
    ctx.beginPath();
    ctx.moveTo(rx1, p1.y + horizonShift);
    ctx.lineTo(rx2, p2.y + horizonShift);
    ctx.stroke();
  }

  drawRunway(ctx, s1, s2, p1, p2, horizonShift, width, index) {
    const half = RUNWAY.width / 2;
    const x1l = p1.x - half * p1.scale * (width / 2);
    const x1r = p1.x + half * p1.scale * (width / 2);
    const x2l = p2.x - half * p2.scale * (width / 2);
    const x2r = p2.x + half * p2.scale * (width / 2);
    ctx.fillStyle = PALETTE.runway;
    ctx.beginPath();
    ctx.moveTo(x1l, p1.y + horizonShift);
    ctx.lineTo(x2l, p2.y + horizonShift);
    ctx.lineTo(x2r, p2.y + horizonShift);
    ctx.lineTo(x1r, p1.y + horizonShift);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes and the threshold bars at the near end.
    ctx.fillStyle = PALETTE.runwayMark;
    const dashW1 = Math.max(1, 1.2 * p1.scale * (width / 2));
    const dashW2 = Math.max(1, 1.2 * p2.scale * (width / 2));
    ctx.beginPath();
    ctx.moveTo(p1.x - dashW1 / 2, p1.y + horizonShift);
    ctx.lineTo(p2.x - dashW2 / 2, p2.y + horizonShift);
    ctx.lineTo(p2.x + dashW2 / 2, p2.y + horizonShift);
    ctx.lineTo(p1.x + dashW1 / 2, p1.y + horizonShift);
    ctx.closePath();
    ctx.fill();
    if (index === 0) {
      ctx.fillStyle = PALETTE.runwayMark;
      const barW = (RUNWAY.width * 0.7 * p1.scale * (width / 2)) / 2;
      ctx.fillRect(p1.x - barW, p1.y + horizonShift - 3, barW * 2, 4);
    }
  }

  drawDecorations(ctx, world, seg, camX, camY, camZ, horizonShift, width, height, viewDir) {
    for (const tree of seg.trees) {
      const gx = seg.cx + tree.x;
      const gy = world.groundHeightAt(seg.cz, gx);
      const p = projectPoint(gx, gy, seg.cz, camX, camY, camZ, width, height, viewDir);
      if (!p) continue;
      const y = p.y + horizonShift;
      if (y < 0 || y > height) continue;
      const s = Math.max(1.5, p.scale * tree.size * (width / 2) * 0.02);
      const shade = 0.75 + tree.shade * 0.45;
      ctx.fillStyle = `rgb(${Math.round(58 * shade)}, ${Math.round(110 * shade)}, ${Math.round(48 * shade)})`;
      ctx.beginPath();
      ctx.moveTo(p.x, y - s * 2.4);
      ctx.lineTo(p.x - s * 0.9, y - s * 0.4);
      ctx.lineTo(p.x + s * 0.9, y - s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(p.x - s * 0.08, y - s * 0.5, s * 0.16, s * 0.5);
    }
    for (const house of seg.houses) {
      const gx = seg.cx + house.x;
      const gy = world.groundHeightAt(seg.cz, gx);
      const p = projectPoint(gx, gy, seg.cz, camX, camY, camZ, width, height, viewDir);
      if (!p) continue;
      const y = p.y + horizonShift;
      if (y < 0 || y > height) continue;
      const s = p.scale * (width / 2) * 0.02;
      const w = Math.max(2, house.w * s);
      const h = Math.max(2, house.h * s);
      ctx.fillStyle = PALETTE.townWall;
      ctx.fillRect(p.x - w / 2, y - h, w, h);
      ctx.fillStyle = house.roof > 0.5 ? PALETTE.townRoof : '#7a5a8a';
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2 - w * 0.08, y - h);
      ctx.lineTo(p.x, y - h - h * 0.55);
      ctx.lineTo(p.x + w / 2 + w * 0.08, y - h);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawRings(ctx, width, height, rings, nextRing, camX, camY, camZ, horizonShift, viewDir) {
    // Far to near, so a nearer ring covers a farther one.
    const ordered = [...rings].sort((a, b) => viewDir * (b.segment - a.segment));
    const pulse = 0.75 + Math.sin(this.time * 3.2) * 0.25;
    for (const ring of ordered) {
      const dz = viewDir * (ring.segment * VIEW.segmentLength - camZ);
      if (dz < 8 || dz > VIEW.drawDistance * VIEW.segmentLength) continue;
      const p = projectPoint(ring.x, ring.y, ring.segment * VIEW.segmentLength, camX, camY, camZ, width, height, viewDir);
      if (!p) continue;
      const y = p.y + horizonShift;
      const r = ring.radius * p.scale * (width / 2);
      if (r < 2 || y < -80 || y > height + 80) continue;
      const isNext = nextRing && ring.id === nextRing.id;
      const color = ring.passed ? PALETTE.ringDone : isNext ? PALETTE.ringNext : PALETTE.ringLater;
      const alpha = ring.passed ? 0.55 : isNext ? 0.95 : 0.8;
      const lw = Math.max(2, r * 0.1 * (isNext ? pulse + 0.4 : 1));
      ctx.globalAlpha = alpha;
      if (isNext) {
        ctx.save();
        ctx.shadowColor = PALETTE.ringNext;
        ctx.shadowBlur = 26;
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(p.x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(p.x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Chevrons on the next ring, pointing the pilot through.
      if (isNext) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(p.x, y - r - 14);
        ctx.lineTo(p.x - 9, y - r - 30);
        ctx.lineTo(p.x + 9, y - r - 30);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  drawPlaneShadow(ctx, width, height, world, plane, camX, camY, camZ, horizonShift, viewDir) {
    if (!plane.airborne) return;
    const ground = world.groundHeightAt(plane.s, plane.x);
    const hag = plane.y - ground;
    if (hag > 260) return;
    const p = projectPoint(plane.x, ground + 0.6, plane.s + viewDir * 30, camX, camY, camZ, width, height, viewDir);
    if (!p) return;
    const alpha = clamp(0.34 - hag / 900, 0.04, 0.34);
    const rx = clamp(46 - hag * 0.06, 12, 46);
    ctx.fillStyle = `rgba(20, 26, 18, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + horizonShift, rx, rx * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlane(ctx, width, height, plane, state) {
    const cx = width / 2 + plane.displayRoll * -1.4;
    // On the title screen the aeroplane sits higher, clear of the FLY
    // button and the mission cards.
    const titleLift = state.mode === 'title' ? 34 : 0;
    const cy = height * 0.60 - plane.displayPitch * 1.6 - titleLift;
    const bank = (plane.displayRoll * 0.38 * Math.PI) / 180;
    const scale = plane.onGround ? 1.06 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bank);
    ctx.scale(scale, scale);
    this.paintSkylark(ctx, plane, state);
    ctx.restore();
  }

  // The Skylark herself, seen from behind and slightly above: cream
  // fuselage, red wingtips, blue cheatline, tail fin, nav lights.
  paintSkylark(ctx, plane, state) {
    // Wings: long, tapered, slightly swept, with red tips.
    const wingGrad = ctx.createLinearGradient(-150, 0, 150, 0);
    wingGrad.addColorStop(0, '#c8352c');
    wingGrad.addColorStop(0.14, '#f4ede0');
    wingGrad.addColorStop(0.5, '#fbf7ee');
    wingGrad.addColorStop(0.86, '#f4ede0');
    wingGrad.addColorStop(1, '#c8352c');
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(-150, 6);
    ctx.quadraticCurveTo(-120, -16, -58, -12);
    ctx.lineTo(58, -12);
    ctx.quadraticCurveTo(120, -16, 150, 6);
    ctx.quadraticCurveTo(120, 16, 60, 14);
    ctx.lineTo(-60, 14);
    ctx.quadraticCurveTo(-120, 16, -150, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 40, 30, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Fuselage: receding toward the nose, cream with a blue cheatline.
    const bodyGrad = ctx.createLinearGradient(0, -64, 0, 34);
    bodyGrad.addColorStop(0, '#e8ddc8');
    bodyGrad.addColorStop(0.45, '#fbf7ee');
    bodyGrad.addColorStop(1, '#d8cbb2');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-26, 30);
    ctx.quadraticCurveTo(-30, -18, -16, -62);
    ctx.quadraticCurveTo(0, -72, 16, -62);
    ctx.quadraticCurveTo(30, -18, 26, 30);
    ctx.quadraticCurveTo(0, 40, -26, 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 40, 30, 0.3)';
    ctx.stroke();
    // Blue cheatline down the fuselage.
    ctx.fillStyle = '#2e6fb0';
    ctx.beginPath();
    ctx.moveTo(-24, 18);
    ctx.quadraticCurveTo(-25, -14, -15, -52);
    ctx.lineTo(-9, -52);
    ctx.quadraticCurveTo(-17, -12, -16, 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(24, 18);
    ctx.quadraticCurveTo(25, -14, 15, -52);
    ctx.lineTo(9, -52);
    ctx.quadraticCurveTo(17, -12, 16, 18);
    ctx.closePath();
    ctx.fill();
    // Tail fin and horizontal stabiliser.
    ctx.fillStyle = '#c8352c';
    ctx.beginPath();
    ctx.moveTo(-14, 30);
    ctx.lineTo(-12, -2);
    ctx.lineTo(0, -26);
    ctx.lineTo(12, -2);
    ctx.lineTo(14, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4ede0';
    ctx.beginPath();
    ctx.moveTo(-52, 26);
    ctx.lineTo(-14, 18);
    ctx.lineTo(14, 18);
    ctx.lineTo(52, 26);
    ctx.lineTo(46, 34);
    ctx.lineTo(-46, 34);
    ctx.closePath();
    ctx.fill();
    // Cabin windows catching the morning sun.
    ctx.fillStyle = 'rgba(70, 130, 180, 0.9)';
    ctx.beginPath();
    ctx.ellipse(-8, -44, 6, 9, -0.2, 0, Math.PI * 2);
    ctx.ellipse(8, -44, 6, 9, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Registration on the fin, and the name on the tail.
    ctx.fillStyle = '#fbf7ee';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SK', 0, 8);
    // Navigation lights: red left, green right, white strobe blinking.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-150, 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#35e05a';
    ctx.beginPath();
    ctx.arc(150, 6, 4, 0, Math.PI * 2);
    ctx.fill();
    const strobe = Math.sin(this.time * 6) > 0.6;
    if (strobe) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 34, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Exhaust shimmer when the throttle is open.
    if (plane.throttle > 0.4 && plane.airborne) {
      const a = (plane.throttle - 0.4) * 0.5;
      ctx.fillStyle = `rgba(255, 220, 160, ${a * (0.5 + Math.sin(this.time * 31) * 0.3)})`;
      ctx.beginPath();
      ctx.ellipse(-20, 26, 5, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(20, 26, 5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    void state;
  }
}
