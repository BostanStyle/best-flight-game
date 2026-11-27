// Skylark Valley's controls: keyboard and mouse, read the same way.
// One job: turn keys, pointer and wheel into one clean control frame
// the flight model can trust, and remember clicks on screen buttons.

export class PilotInput {
  constructor(canvas) {
    this.keys = new Set();
    this.roll = 0; // -1 (left) .. 1 (right)
    this.pitch = 0; // -1 (down) .. 1 (up)
    this.throttleDelta = 0;
    this.mouseSteer = false;
    this.mouseX = 0.5; // Normalised pointer position, 0..1.
    this.mouseY = 0.5;
    this.mouseActive = false;
    this.clicks = [];
    this.pressed = new Set(); // Keys pressed since last frame.
    this.canvas = canvas;
    this.attach(canvas);
  }

  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) / rect.width;
      this.mouseY = (e.clientY - rect.top) / rect.height;
      this.mouseActive = true;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.clicks.push({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
      this.mouseActive = true;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.throttleDelta += e.deltaY < 0 ? 0.12 : -0.12;
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Read the controls once per frame. Keyboard always works; the mouse
  // steers too, once the pilot moves it over the canvas.
  poll() {
    const k = this.keys;
    let roll = 0;
    let pitch = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) pitch += 1;
    if (k.has('ArrowDown') || k.has('KeyS')) pitch -= 1;
    if (this.mouseSteer && this.mouseActive) {
      // Pointer offset from centre steers, like a sidestick.
      roll += (this.mouseX - 0.5) * 2.4;
      pitch += (0.5 - this.mouseY) * 2.0;
    }
    let throttleDelta = this.throttleDelta;
    this.throttleDelta = 0;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) throttleDelta += 0.9;
    if (k.has('ControlLeft') || k.has('ControlRight')) throttleDelta -= 0.9;
    if (k.has('KeyR') && k.has('ShiftLeft')) throttleDelta = 0;
    this.roll = Math.max(-1, Math.min(1, roll));
    this.pitch = Math.max(-1, Math.min(1, pitch));
    this.throttleDelta = throttleDelta;
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.clicks.length = 0;
  }

  // A click inside a rectangle given in normalised canvas coordinates.
  clickedIn(x0, y0, x1, y1) {
    return this.clicks.some((c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1);
  }
}
