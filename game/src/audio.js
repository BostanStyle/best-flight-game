// Skylark Valley's sound: every noise the game makes is synthesised
// live with WebAudio — an engine drone, wind, chimes, thuds. No audio
// files, no network, and silence until the pilot touches a control.

export class ValleyAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
  }

  // Call from a user gesture: browsers keep audio locked until then.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: two detuned sawtooths through a lowpass, like a flat-four.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 78;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    this.engineOsc2.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    this.engineOsc2.start();
    // Wind: looped noise through a bandpass that opens with speed.
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    this.windSource.start();
  }

  // Called every frame with the aeroplane's state: the drone follows
  // the throttle, the wind follows the speed.
  update(plane) {
    if (!this.ctx || this.muted) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.windGain) this.windGain.gain.value = 0;
      return;
    }
    const t = this.ctx.currentTime;
    const rpm = 42 + plane.throttle * 62 + plane.speed * 0.22;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 1.5 + 3, t, 0.08);
    const engineLevel = plane.onGround ? 0.05 + plane.throttle * 0.06 : 0.045 + plane.throttle * 0.055;
    this.engineGain.gain.setTargetAtTime(plane.engineOut ? 0 : engineLevel, t, 0.1);
    const windLevel = plane.airborne ? Math.min(0.14, plane.speed * 0.0016) : 0;
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(320 + plane.speed * 9, t, 0.15);
  }

  blip(freq, dur, type = 'sine', level = 0.16) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  chime() {
    // A ring collected: a little rising arpeggio.
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.5, 'sine', 0.14), i * 70);
    });
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
    this.blip(70, 0.6, 'sawtooth', 0.3);
  }

  fanfare() {
    [392, 523, 659, 784].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.7, 'triangle', 0.15), i * 110);
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.windGain) this.windGain.gain.value = 0;
    }
    return this.muted;
  }
}
