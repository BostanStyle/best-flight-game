// Skylark Valley's cockpit: the lit instrument panel and the HUD.
// One job: everything the pilot reads — altitude, speed, heading,
// fuel, attitude — drawn as instruments that look flown, not pasted.

import { PALETTE, PLANE } from './config.js';
import { clamp, wrapAngle } from './random.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lamp(ctx, x, y, color, on) {
  ctx.save();
  if (on) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = on ? color : '#2c313c';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#10131a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.stroke();
}

function dialFace(ctx, x, y, r, label) {
  const glow = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  glow.addColorStop(0, '#3a2f1a');
  glow.addColorStop(0.7, '#241f16');
  glow.addColorStop(1, '#12100c');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c8b98a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.lampAmber;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r - 8);
}

function needle(ctx, x, y, r, angleRad, color, width) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.25);
  ctx.lineTo(0, -r * 0.85);
  ctx.stroke();
  ctx.restore();
}

export class Cockpit {
  constructor() {
    this.flashUntil = 0;
  }

  draw(ctx, width, height, state, now) {
    const { plane, mission, rings, nextRing, score, messages } = state;
    const panelY = height - 148;
    this.drawPanelShell(ctx, width, height, panelY);
    this.drawAttitude(ctx, 108, panelY + 74, 56, plane);
    this.drawAltimeter(ctx, 232, panelY + 74, 52, plane);
    this.drawAirspeed(ctx, 348, panelY + 74, 52, plane);
    this.drawCompassTape(ctx, width / 2, panelY + 26, plane);
    this.drawThrottleFuel(ctx, width - 400, panelY, plane);
    this.drawStatusLamps(ctx, width - 120, panelY + 40, plane, state);
    this.drawHudTop(ctx, width, state);
    this.drawGuidance(ctx, width, height, state);
    this.drawMessages(ctx, width, height, messages, now, state.mode);
    void mission;
    void rings;
    void nextRing;
    void score;
  }

  drawPanelShell(ctx, width, height, panelY) {
    const grad = ctx.createLinearGradient(0, panelY, 0, height);
    grad.addColorStop(0, '#2b303c');
    grad.addColorStop(0.12, PALETTE.panel);
    grad.addColorStop(1, '#14171d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, panelY, width, height - panelY);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, panelY, width, 3);
    // Warm panel backlight: the instruments are lit, not drawn flat.
    const glow = ctx.createRadialGradient(width / 2, panelY + 70, 60, width / 2, panelY + 70, width * 0.55);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.10)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, panelY, width, height - panelY);
  }

  drawAttitude(ctx, x, y, r, plane) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate((-plane.displayRoll * Math.PI) / 180);
    const pitchPx = clamp(plane.displayPitch, -30, 30) * (r / 30);
    // Sky above the horizon bar, ground below it.
    ctx.fillStyle = '#7db3dd';
    ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    ctx.strokeStyle = '#f2f2e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, -pitchPx);
    ctx.lineTo(r, -pitchPx);
    ctx.stroke();
    ctx.restore();
    // Fixed wings: the aeroplane symbol never moves, the world does.
    ctx.strokeStyle = PALETTE.lampAmber;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y);
    ctx.lineTo(x - r * 0.15, y);
    ctx.moveTo(x + r * 0.15, y);
    ctx.lineTo(x + r * 0.55, y);
    ctx.stroke();
    ctx.fillStyle = PALETTE.lampAmber;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    // Ring and label over the clipped ball.
    ctx.strokeStyle = '#c8b98a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.lampAmber;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', x, y + r - 8);
  }

  drawAltimeter(ctx, x, y, r, plane) {
    dialFace(ctx, x, y, r, 'ALT FT');
    const altFt = Math.max(0, (plane.y - 1.2) * 3.28084);
    const angle = ((altFt % 1000) / 1000) * Math.PI * 2 - Math.PI / 2;
    needle(ctx, x, y, r, angle, '#f2f2e8', 2.5);
    ctx.fillStyle = '#0c0e12';
    ctx.fillRect(x - 30, y - 8, 60, 16);
    ctx.fillStyle = PALETTE.lampGreen;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(altFt)), x, y + 5);
  }

  drawAirspeed(ctx, x, y, r, plane) {
    dialFace(ctx, x, y, r, 'KIAS');
    const kt = plane.speed * 1.94384;
    // Needle sweeps 270 degrees: 0 kt at lower-left, 160 kt at lower-right.
    const a = (clamp(kt / 160, 0, 1) * 270 - 225) * (Math.PI / 180);
    needle(ctx, x, y, r, a, '#f2f2e8', 2.5);
    // Red stall arc, green cruise arc.
    ctx.strokeStyle = PALETTE.lampRed;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r - 6, Math.PI * 0.75, Math.PI * 0.75 + 0.35);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.lampGreen;
    ctx.beginPath();
    ctx.arc(x, y, r - 6, Math.PI * 0.75 + 0.9, Math.PI * 0.75 + 1.9);
    ctx.stroke();
    ctx.fillStyle = '#0c0e12';
    ctx.fillRect(x - 28, y - 8, 56, 16);
    ctx.fillStyle = PALETTE.lampGreen;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(kt)), x, y + 5);
  }

  drawCompassTape(ctx, cx, y, plane) {
    ctx.save();
    ctx.fillStyle = '#0c0e12';
    roundRect(ctx, cx - 190, y - 16, 380, 32, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(cx - 190, y - 16, 380, 32);
    ctx.clip();
    const heading = wrapAngle(plane.heading);
    for (let d = -60; d <= 60; d += 5) {
      const h = wrapAngle(heading + d);
      const px = cx + d * 3.1;
      const major = h % 30 === 0;
      ctx.strokeStyle = major ? '#eaf2f8' : '#5a6a78';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(px, y + 12);
      ctx.lineTo(px, y + (major ? -4 : 4));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#eaf2f8';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        const label = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W' : String(h).padStart(3, '0');
        ctx.fillText(label, px, y - 6);
      }
    }
    ctx.restore();
    // Lubber line.
    ctx.fillStyle = PALETTE.lampAmber;
    ctx.beginPath();
    ctx.moveTo(cx, y - 18);
    ctx.lineTo(cx - 6, y - 28);
    ctx.lineTo(cx + 6, y - 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.lampAmber;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HDG ' + String(Math.round(heading)).padStart(3, '0'), cx, y + 30);
  }

  drawThrottleFuel(ctx, x, panelY, plane) {
    const y = panelY + 24;
    ctx.fillStyle = '#c8b98a';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('THROTTLE', x, y - 6);
    // Throttle quadrant.
    ctx.fillStyle = '#0c0e12';
    roundRect(ctx, x, y, 26, 96, 6);
    ctx.fill();
    const leverY = y + 90 - plane.throttle * 84;
    ctx.fillStyle = '#3a4150';
    ctx.fillRect(x + 11, y + 6, 4, 84);
    ctx.fillStyle = PALETTE.lampAmber;
    roundRect(ctx, x + 2, leverY, 22, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#c8b98a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(Math.round(plane.throttle * 100) + '%', x + 34, leverY + 9);
    // Fuel gauge.
    const fx = x + 96;
    ctx.fillStyle = '#c8b98a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('FUEL', fx, y - 6);
    const frac = clamp(plane.fuel / PLANE.fuelCapacity, 0, 1);
    ctx.strokeStyle = frac < 0.2 ? PALETTE.lampRed : PALETTE.lampGreen;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(fx + 26, y + 48, 34, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * frac);
    ctx.stroke();
    ctx.strokeStyle = '#3a4150';
    ctx.beginPath();
    ctx.arc(fx + 26, y + 48, 34, Math.PI * 0.75 + Math.PI * 1.5 * frac, Math.PI * 2.25);
    ctx.stroke();
    ctx.fillStyle = frac < 0.2 ? PALETTE.lampRed : '#eaf2f8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(plane.fuel), fx + 26, y + 52);
    ctx.fillStyle = '#9fb4c4';
    ctx.font = '9px sans-serif';
    ctx.fillText('E', fx - 12, y + 92);
    ctx.fillText('F', fx + 64, y + 92);
    // Vertical speed, as a small tape.
    const vx = x + 180;
    ctx.fillStyle = '#c8b98a';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('V/S FT/MIN', vx, y - 6);
    const vs = plane.verticalSpeed * 196.85;
    ctx.fillStyle = '#0c0e12';
    ctx.fillRect(vx, y, 60, 96);
    ctx.strokeStyle = '#3a4150';
    ctx.strokeRect(vx, y, 60, 96);
    const vsY = y + 48 - clamp(vs / 2000, -1, 1) * 42;
    ctx.fillStyle = vs < -600 ? PALETTE.lampRed : PALETTE.lampGreen;
    ctx.fillRect(vx + 4, Math.min(vsY, y + 48), 52, Math.max(3, Math.abs(vsY - (y + 48))));
    // Value inside the tape, so it never runs off the panel's edge.
    ctx.fillStyle = '#eaf2f8';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(vs)), vx + 30, y + 90);
  }

  drawStatusLamps(ctx, x, y, plane, state) {
    ctx.fillStyle = '#c8b98a';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GEAR', x, y);
    lamp(ctx, x + 52, y - 3, PALETTE.lampGreen, plane.gearDown);
    ctx.fillText('FLAPS', x, y + 22);
    lamp(ctx, x + 52, y + 19, PALETTE.lampAmber, plane.flaps);
    ctx.fillText('STALL', x, y + 44);
    const stalled = plane.airborne && plane.speed < PLANE.stallSpeed;
    lamp(ctx, x + 52, y + 41, PALETTE.lampRed, stalled);
    ctx.fillText('FUEL LOW', x, y + 66);
    lamp(ctx, x + 52, y + 63, PALETTE.lampRed, plane.fuel < 20);
    // Mission name, right-aligned inside the panel so it never clips.
    ctx.fillStyle = '#9fb4c4';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(state.mission.name.toUpperCase(), 1264, y + 88);
  }

  drawHudTop(ctx, width, state) {
    const { plane, score, rings, nextRing, elapsed } = state;
    const altFt = Math.max(0, (plane.y - 1.2) * 3.28084);
    const kt = plane.speed * 1.94384;
    const hdg = Math.round(wrapAngle(plane.heading));
    ctx.textAlign = 'left';
    this.hudNumber(ctx, 24, 30, 'ALT', String(Math.round(altFt)).padStart(5, '0') + ' FT', '#eaf2f8');
    this.hudNumber(ctx, 24, 74, 'SPD', String(Math.round(kt)).padStart(3, '0') + ' KT', '#eaf2f8');
    this.hudNumber(ctx, 24, 118, 'HDG', String(hdg).padStart(3, '0') + '°', '#eaf2f8');
    ctx.textAlign = 'right';
    this.hudNumber(ctx, width - 24, 30, 'SCORE', String(score), PALETTE.lampAmber, true);
    const done = rings.filter((r) => r.passed).length;
    this.hudNumber(ctx, width - 24, 74, 'RINGS', done + ' / ' + rings.length, '#eaf2f8', true);
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    this.hudNumber(ctx, width - 24, 118, 'TIME', mins + ':' + String(secs).padStart(2, '0'), '#eaf2f8', true);
    if (nextRing && state.mode === 'flying') {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.ringNext;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('NEXT RING ' + (nextRing.id + 1) + ' OF ' + rings.length, width / 2, 30);
    }
    if (plane.fuel < 20 && plane.airborne) {
      ctx.textAlign = 'center';
      const blink = Math.sin(Date.now() / 180) > 0;
      if (blink) {
        ctx.fillStyle = PALETTE.lampRed;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('LOW FUEL — THROTTLE BACK AND LAND', width / 2, 56);
      }
    }
  }

  hudNumber(ctx, x, y, label, value, color, right = false) {
    ctx.fillStyle = '#9fb4c4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = right ? 'right' : 'left';
    ctx.fillText(label, x, y - 16);
    ctx.fillStyle = color;
    ctx.font = 'bold 24px monospace';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(value, x, y + 8);
    ctx.shadowBlur = 0;
  }

  drawGuidance(ctx, width, height, state) {
    const { guidance, plane } = state;
    if (!guidance || !plane.airborne) return;
    const cx = width / 2;
    const cy = height * 0.42;
    const gx = cx + guidance.leftRight * 130;
    const gy = cy + guidance.upDown * -70;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = PALETTE.ringNext;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.stroke();
    const ang = Math.atan2(gy - cy, gx - cx);
    ctx.fillStyle = PALETTE.ringNext;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 40);
    ctx.lineTo(cx + Math.cos(ang + 2.6) * 26, cy + Math.sin(ang + 2.6) * 26);
    ctx.lineTo(cx + Math.cos(ang - 2.6) * 26, cy + Math.sin(ang - 2.6) * 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eaf2f8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(guidance.dist) + ' m', cx, cy + 46);
    ctx.restore();
  }

  drawMessages(ctx, width, height, messages, now, mode) {
    // Toasts belong to flying: the end screens tell their own story,
    // and a toast showing through their panels reads as a smudge.
    if (mode !== 'flying') return;
    let y = height * 0.30;
    for (const msg of messages) {
      const age = now - msg.at;
      if (age > 3.2) continue;
      const alpha = age > 2.4 ? 1 - (age - 2.4) / 0.8 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = msg.color || '#ffffff';
      ctx.fillText(msg.text, width / 2, y);
      ctx.restore();
      y += 30;
    }
  }
}
