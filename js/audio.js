// ================= 音频引擎：全部音效/音乐由 WebAudio 合成 =================
const AudioFX = {
  ctx: null, master: null, bgmGain: null, fxGain: null,
  delay: null, delayGain: null,
  muted: false,
  // 音乐状态
  musicOn: true, nextNoteTime: 0, step: 0, timer: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    this.fxGain = this.ctx.createGain();
    this.fxGain.gain.value = 0.9;
    this.fxGain.connect(this.master);

    // 空间回声（古风氛围）
    this.delay = this.ctx.createDelay(1.2);
    this.delay.delayTime.value = 0.34;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.32;
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.delay);
    this.delayGain.connect(this.master);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.42;
    this.bgmGain.connect(this.master);
    this.bgmGain.connect(this.delay);

    this.musicOn = Utils.store.get('musicOn', true);
    this.muted = Utils.store.get('muted', false);
    if (this.muted) this.master.gain.value = 0;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    Utils.store.set('muted', this.muted);
    return this.muted;
  },

  // ---------- 基础合成原语 ----------
  tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(this.fxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur, vol = 0.3, filterFreq = 2000, filterType = 'lowpass', slideTo = null, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.fxGain);
    src.start(t0); src.stop(t0 + dur + 0.05);
  },
  sweep(freqA, freqB, dur, type = 'sine', vol = 0.3) {
    this.tone(freqA, dur, type, vol, freqB);
  },

  // ---------- 游戏音效 ----------
  sword()  { this.noise(0.09, 0.16, 3200, 'bandpass', 900); this.tone(880, 0.07, 'triangle', 0.08, 1400); },
  hit()    { this.noise(0.05, 0.22, 1800, 'bandpass', 400); },
  kill()   { this.tone(200, 0.14, 'square', 0.12, 60); this.noise(0.1, 0.12, 900, 'lowpass', 150); },
  hurt()   { this.tone(140, 0.22, 'sawtooth', 0.24, 55); this.noise(0.12, 0.2, 500, 'lowpass', 120); },
  crit()   { this.tone(1200, 0.1, 'square', 0.12, 600); this.noise(0.08, 0.18, 4000, 'bandpass', 1200); },
  dodge()  { this.sweep(300, 1300, 0.18, 'sine', 0.2); this.noise(0.15, 0.08, 3000, 'bandpass', 600); },
  orb()    { this.tone(620 + Math.random() * 220, 0.05, 'sine', 0.05, null); },
  levelup() {
    const scale = [523, 659, 784, 1047, 1319];
    scale.forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.16, null, i * 0.07));
    this.tone(1568, 0.5, 'sine', 0.1, null, 0.36);
  },
  card()   { if (!this.ctx || !this.delayGain) return; this.tone(1319, 0.6, 'sine', 0.14, null); this.tone(1976, 0.8, 'sine', 0.1, null, 0.08); this.delayGain.gain.setValueAtTime(0.4, this.ctx.currentTime); },
  explode(){ this.noise(0.4, 0.4, 900, 'lowpass', 60); this.tone(90, 0.35, 'sine', 0.35, 40); },
  thunder() {
    this.noise(1.4, 0.5, 300, 'lowpass', 40);
    this.noise(0.12, 0.3, 6000, 'highpass', null);
    this.tone(50, 1.2, 'sine', 0.4, 25);
  },
  tribStart() {
    for (let i = 0; i < 3; i++) this.thunder2(i * 0.5);
    this.tone(110, 1.6, 'sawtooth', 0.1, 55);
  },
  thunder2(when = 0) { this.noise(1.1, 0.42, 260, 'lowpass', 35, when); this.tone(46, 1.0, 'sine', 0.35, 22, when); },
  tribSuccess() {
    const scale = [523, 659, 784, 1047, 1319, 1568];
    scale.forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.15, null, i * 0.09));
    this.noise(0.9, 0.2, 4000, 'bandpass', 300);
  },
  bossRoar() { this.tone(70, 1.1, 'sawtooth', 0.32, 40); this.tone(95, 1.1, 'sawtooth', 0.22, 55); this.noise(0.9, 0.2, 300, 'lowpass', 80); },
  bossHit() { this.tone(80, 0.2, 'square', 0.2, 45); },
  win() {
    const m = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    m.forEach((f, i) => this.tone(f, 0.42, 'triangle', 0.16, null, i * 0.16));
  },
  lose() {
    const m = [392, 330, 262, 196];
    m.forEach((f, i) => this.tone(f, 0.6, 'sine', 0.18, null, i * 0.28));
  },
  bossSpawn() { this.bossRoar(); this.noise(1.2, 0.25, 200, 'lowpass', 50); },

  // ---------- 古风背景音乐（五声音阶筝音 + 低音 drone）----------
  startMusic() {
    if (!this.ctx || this.musicOn === false) return;
    if (this.timer) return;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 200);
  },
  stopMusic() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  setMusic(on) { this.musicOn = on; Utils.store.set('musicOn', on); if (!on) this.stopMusic(); else this.startMusic(); },

  schedule() {
    if (!this.ctx || this.musicOn === false) return;
    const c = this.ctx;
    while (this.nextNoteTime < c.currentTime + 0.7) {
      this.playStep(this.step, this.nextNoteTime - c.currentTime);
      this.nextNoteTime += 60 / 72 / 4; // 72 BPM 十六分音符
      this.step++;
    }
  },
  playStep(step, when) {
    // 每 16 步一乐句；使用 A 宫五声音阶（A C D E G）
    const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];
    const bar = Math.floor(step / 16);
    const s = step % 16;
    // 低音 drone：每小节第 0、8 步
    if (s === 0) this.mTone(55 * (bar % 2 === 0 ? 1 : 1.5), 1.4, 'sine', 0.14, when);
    if (s === 8) this.mTone(110, 0.9, 'sine', 0.08, when);
    // 旋律：稀疏的筝音
    if (s === 0 || s === 4 || s === 10 || s === 14) {
      if (Math.random() < 0.8) {
        const idx = Utils.randInt(3, scale.length - 1);
        this.mTone(scale[idx], 0.55, 'triangle', 0.055, when);
        if (Math.random() < 0.35) this.mTone(scale[idx + 2] || scale[idx], 0.4, 'triangle', 0.035, when + 0.12);
      }
    }
    // 偶尔的装饰高音
    if (s === 12 && Math.random() < 0.5) this.mTone(scale[9], 0.3, 'sine', 0.03, when);
  },
  mTone(freq, dur, type, vol, when) {
    if (!this.ctx || !this.bgmGain) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(this.bgmGain);
    o.start(t0); o.stop(t0 + dur + 0.1);
  },
};
