// ================= 妖潮调度 / Boss 时间轴 / 渡劫系统（含三千年雷劫） =================
const Waves = {
  spawnT: 0,
  lastWave: 0,
  lastBossIdx: -1,
  bossTimeline: ['wolfking', 'snake', 'spider', 'heart'],
  // 渡劫状态
  trib: { active: false, t: 0, dur: 10, boltT: 0, warning: [], bolts: [], power: 1, label: '' },
  // 三千年雷劫（飞升灵界后开启）
  millennium: { active: false, nextAt: 0, level: 0 },

  reset() {
    this.spawnT = 0;
    this.lastWave = 0;
    this.lastBossIdx = -1;
    this.trib = { active: false, t: 0, dur: 10, boltT: 0, warning: [], bolts: [], power: 1, label: '', millennium: false };
    this.millennium = { active: false, nextAt: 0, level: 0 };
  },

  // 开启三千年雷劫（飞升灵界后）
  startMillennium() {
    this.millennium.active = true;
    this.millennium.nextAt = Game.time + CFG.millennium.firstAt;
    this.millennium.level = 0;
  },

  update(dt) {
    this.updateTrib(dt);
    if (Game.state !== 'playing') return;
    const t = Game.time;
    // 波次提示
    const wave = Math.floor(t / CFG.WAVE_SEC) + 1;
    if (wave !== this.lastWave) {
      this.lastWave = wave;
      Game.setWave(wave);
      if (wave > 1) Game.toast(`第 ${wave} 波妖潮来袭！`);
    }
    // 三千年雷劫
    if (this.millennium.active && t >= this.millennium.nextAt && !this.trib.active) {
      this.millennium.level++;
      this.millennium.nextAt = t + CFG.millennium.interval;
      const lv = this.millennium.level;
      Game.toast(`三千年雷劫（第 ${lv} 劫）降临！一次比一次强！`);
      Game.startTribulation(1.0 + lv * 0.35, lv * 1.5 + 8, `三千年雷劫 · 第 ${lv} 劫`, true);
    }
    // 敌人刷新（渡劫时减半；Boss 在场时妖气收敛，小妖不敢近前——聚焦 Boss 战）
    const ratio = Utils.clamp(t / 480, 0, 1);
    let interval = Utils.lerp(CFG.enemies.spawnBase, CFG.enemies.spawnMin, ratio);
    if (this.trib.active) interval *= 2;
    if (Entities.boss) interval *= 100;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = interval;
      this.spawnGroup(t);
    }
    // Boss 时间轴
    for (let i = 0; i < this.bossTimeline.length; i++) {
      const bt = CFG.boss[this.bossTimeline[i]];
      if (t >= bt.at && !Entities.boss && this.lastBossIdx < i) {
        this.lastBossIdx = i;
        Entities.spawnBoss(this.bossTimeline[i]);
        Game.toast(`${bt.name} 降临！`);
        break;
      }
    }
  },

  spawnGroup(t) {
    const pool = ['wolf', 'bee'];
    if (t > 90) pool.push('golem');
    if (t > 170) pool.push('bat');
    if (t > 300) pool.push('snake');
    if (t > 420) pool.push('scorpion');
    if (t > 480) pool.push('wolf', 'bee', 'golem');
    const n = Utils.randInt(1, t > 300 ? 3 : 2);
    const cap = CFG.enemies.maxCount - Entities.enemies.length;
    const cnt = Math.min(n, Math.max(0, cap));   // 达到上限则不再刷新
    for (let i = 0; i < cnt; i++) {
      const type = Utils.pick(pool);
      const elite = Utils.chance(CFG.enemies.eliteChance);
      const pos = Utils.spawnPos(Game.cam, CFG.W, CFG.H, 90);
      Entities.spawnEnemy(type, pos.x, pos.y, elite);
    }
  },

  // ---------------- 渡劫（天雷劫，power 越高越强） ----------------
  startTribulation(power = 1, duration = 10, label = '', millennium = false) {
    const T = this.trib;
    T.active = true; T.t = 0; T.dur = duration; T.boltT = 1.2;
    T.warning = []; T.bolts = [];
    T.power = power; T.label = label; T.millennium = millennium;
    AudioFX.tribStart();
    Game.shake(10);
    if (label) Game.toast(label);
  },

  updateTrib(dt) {
    const T = this.trib;
    if (!T.active) return;
    T.t += dt;
    for (let i = T.warning.length - 1; i >= 0; i--) {
      const w = T.warning[i];
      w.t -= dt;
      if (w.t <= 0) {
        T.warning.splice(i, 1);
        T.bolts.push({ x: w.x, y: w.y, t: 0.25 });
        AudioFX.thunder2();
        Game.shake(6);
        const p = Entities.player;
        if (Utils.dist(w.x, w.y, p.x, p.y) < 78) {
          Entities.damagePlayer(p.maxHp * 0.2 * T.power, w.x, w.y);
        }
        for (const e of Entities.enemies) {
          if (e.dead || e.boss) continue;
          if (Utils.dist(w.x, w.y, e.x, e.y) < 95) Entities.damageEnemy(e, 120 * T.power, { crit: false });
        }
      }
    }
    for (let i = T.bolts.length - 1; i >= 0; i--) {
      const b = T.bolts[i];
      b.t -= dt;
      if (b.t <= 0) T.bolts.splice(i, 1);
    }
    T.boltT -= dt;
    if (T.boltT <= 0) {
      T.boltT = Math.max(0.7, 1.15 - T.power * 0.15);
      const p = Entities.player;
      const n = Utils.randInt(1, Math.min(4, 1 + Math.floor(T.power)));
      for (let i = 0; i < n; i++) {
        T.warning.push({ x: p.x + Utils.rand(-260, 260), y: p.y + Utils.rand(-180, 180), t: 0.75 });
      }
    }
    if (T.t >= T.dur) {
      T.active = false;
      if (T.millennium) Game.millenniumSuccess();
      else Game.tribSuccess();
    }
  },
};
