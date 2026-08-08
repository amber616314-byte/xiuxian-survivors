// ================= 游戏主控：状态机 / 主循环 / 系统编排 =================
const Game = {
  state: 'menu',        // menu | playing | levelup | paused | result
  time: 0,
  cam: { x: 0, y: 0 },
  shakeAmt: 0,
  hitStopT: 0,
  tribCount: 0,
  pendingLevelUps: [],
  _ascendFlash: 0,
  _ascendT: 0, _jindanT: 0, _xinsmT: 0,
  lastTs: 0,
  rafId: 0,
  ctx: null,
  canvas: null,
  // 演示模式（主菜单背景）
  demoP: 0,

  // ---------------- 生命周期 ----------------
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = CFG.W * dpr;
    this.canvas.height = CFG.H * dpr;
    this.ctx.scale(dpr, dpr);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    Input.init();
    Renderer.init();
    UI.init();
    AudioFX.init();
    Assets.init();

    this.lastTs = performance.now();
    const loop = ts => {
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this.frame(dt);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const scale = Math.min(w / CFG.W, h / CFG.H);
    this.canvas.style.width = (CFG.W * scale) + 'px';
    this.canvas.style.height = (CFG.H * scale) + 'px';
  },

  // ---------------- 状态切换 ----------------
  start() {
    // 重置全部
    Entities.reset();
    SkillSystem.reset();
    Waves.reset();
    this.time = 0;
    this.tribCount = 0;
    this.pendingLevelUps = [];
    this._ascendFlash = 0;
    this._ascendT = 0; this._jindanT = 0; this._xinsmT = 0;
    this.shakeAmt = 0;
    this.hitStopT = 0;
    this.state = 'playing';
    this.cam.x = 0; this.cam.y = 0;
    UI.hide('menu'); UI.hide('result'); UI.hide('pause'); UI.hide('howto');
    UI.hide('levelup'); UI.hide('tribulation');
    UI.show('hud');
    UI.buildSkillBar();
    UI.show('tutorial');
    UI.setWave(1);
    AudioFX.resume();
    AudioFX.startMusic();
    this.toast('秘境开启 · 斩妖夺灵！');
    setTimeout(() => UI.hide('tutorial'), 9000);
  },

  toMenu() {
    this.state = 'menu';
    UI.hide('hud'); UI.hide('result'); UI.hide('pause'); UI.hide('levelup');
    UI.show('menu');
    UI.updateMenuBest();
    AudioFX.stopMusic();
    Entities.reset();
  },

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      UI.showPause(true);
      AudioFX.resume();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      UI.showPause(false);
      this.lastTs = performance.now();
    }
  },

  onLevelUp(level) {
    // 大境界突破检测
    const ri = Entities.realmIndex();
    if (ri > this.tribCount && ri > Entities.player.realm) {
      Entities.player.realm = ri;
      this.startBreakthrough(ri);
      return;   // 突破期间不弹神通（存入队列）
    }
    Entities.player.realm = ri;
    this.queueLevelUp();
  },

  // 按原著机制分派突破方式
  startBreakthrough(ri) {
    const R = CFG.realms[ri];
    const realmName = R.name;
    UI.showTrib(true, realmName);
    switch (R.breakType) {
      case 'xinsm': this.startXinsm(ri); break;
      case 'ascend': this.startAscend(ri); break;
      default: this.startTribulation(1.0 + ri * 0.12, 10, `${realmName}天劫 · ${R.desc}`); break;
    }
  },

  // 碎丹成婴：金丹碎裂 → 金丹现世（击碎）→ 心魔现世（击败）→ 成婴
  startXinsm(ri) {
    // 渡劫优先：若有妖王在场，天象引动妖王退避（立即斩杀，奖励照发）
    if (Entities.boss) {
      const b = Entities.boss;
      this.toast('天象大变！妖王仓皇退避！');
      b.hp = 0;
      Entities.killEnemy(b);
    }
    // 碎丹特效
    const p = Entities.player;
    this.shake(18);
    AudioFX.thunder();
    for (let i = 0; i < 60; i++) {
      setTimeout(() => {
        if (Game.state !== 'playing' && Game.state !== 'result') return;
        Particles.spawn({
          x: p.x + Utils.rand(-80, 80), y: p.y + Utils.rand(-80, 80),
          vx: Utils.rand(-200, 200), vy: Utils.rand(-300, -60),
          size: Utils.rand(3, 7), color: Utils.pick(['#ffe9a0', '#ffd24a', '#fff6d8']), life: Utils.rand(0.5, 1.1), drag: 0.92,
        });
        Particles.ring(p.x, p.y, '#ffe9a0', 30, 0.4, 6);
      }, i * 40);
    }
    this.toast('结丹大圆满！金丹出窍，速速击碎！');
    this._jindanT = 1.0;   // 帧驱动：1s 后金丹现世
  },

  // 金丹现世（帧驱动回调）
  spawnJindan() {
    this._jindanT = -1;
    if (this.state === 'playing' && !Entities.boss) {
      Entities.spawnBoss('jindan');
      this.toast('击碎金丹，心魔便现！');
      UI.hide('levelup');
    }
  },

  // 心魔现世（帧驱动回调）
  spawnXinsm() {
    this._xinsmT = -1;
    if (this.state === 'playing' && !Entities.boss) {
      Entities.spawnBoss('xinsm');
      this.toast('击败心魔，方可碎丹成婴！');
    }
  },

  // 金丹被击碎：心魔现世
  onJindanKilled(e) {
    this.shake(14);
    AudioFX.thunder();
    Particles.burst(e.x, e.y, '#ffe9a0', 50, 500, 6);
    Particles.ring(e.x, e.y, '#fff6d8', 50, 0.8, 10);
    this.toast('金丹碎裂！心魔趁虚而入！！');
    this._xinsmT = 1.2;   // 1.2s 后心魔现世
  },

  // 心魔被击败：突破元婴
  onXinsmKilled(e) {
    this.tribCount++;
    Entities.player.realm = this.tribCount;
    const p = Entities.player;
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    SkillSystem.recompute();
    this.shake(12);
    AudioFX.tribSuccess();
    UI.showTrib(false);
    this.toast(`${CFG.realms[this.tribCount].name}已成 · 元婴出窍！`);
    // 全屏清妖（心魔战小怪少，清理残余）
    for (const o of Entities.enemies.slice()) {
      if (o.boss) continue;
      Particles.burst(o.x, o.y, o.color || '#8a5a4a', 6, 240, 3);
      o.dead = true;
    }
    Entities.enemies = Entities.enemies.filter(o => !o.dead);
    // 处理积压升级
    if (this.pendingLevelUps.length > 0 && this.state === 'playing') this.openLevelUp();
  },

  // 飞升灵界：天地大变 + 开启三千年雷劫
  startAscend(ri) {
    const p = Entities.player;
    this.shake(20);
    AudioFX.tribStart();
    UI.showTrib(true, '炼虚');
    this.toast('化神圆满 · 破界飞升灵界！');
    // 飞升光柱特效
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        if (this.state !== 'playing' && this.state !== 'result') return;
        Particles.spawn({
          x: p.x + Utils.rand(-60, 60), y: p.y + Utils.rand(-300, 100),
          vx: Utils.rand(-40, 40), vy: Utils.rand(-500, -200),
          size: Utils.rand(4, 9), color: Utils.pick(['#ffe9a0', '#ffffff', '#d8ccff']), life: Utils.rand(0.6, 1.2), drag: 0.95,
        });
        Particles.ring(p.x, p.y, '#ffe9a0', 20 + i * 2, 0.35, 6);
      }, i * 60);
    }
    this._ascendFlash = 1.2;   // 全屏白光
    this._ascendT = 1.4;       // 帧驱动：1.4s 后完成飞升
  },

  // 飞升完成：突破炼虚 + 开启三千年雷劫
  finishAscend() {
    this._ascendT = -1;
    if (Game.state === 'result') return;
    this.tribCount++;
    Entities.player.realm = this.tribCount;
    const p = Entities.player;
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    SkillSystem.recompute();
    Waves.startMillennium();
    UI.showTrib(false);
    AudioFX.tribSuccess();
    this.toast('灵界已至 · 每三千年一劫，劫劫更强！');
    if (this.pendingLevelUps.length > 0 && this.state === 'playing') this.openLevelUp();
  },

  queueLevelUp() {
    if (this.state !== 'playing') { this.pendingLevelUps.push(true); return; }
    this.pendingLevelUps.push(true);
    if (!Waves.trib.active) this.openLevelUp();
  },

  openLevelUp() {
    if (this.pendingLevelUps.length === 0) return;
    this.pendingLevelUps.shift();
    const choices = SkillSystem.getChoices();
    if (choices.length === 0) {
      // 神通圆满：升级改为道韵补偿（+4% 攻击并回复四成寿元）
      const p = Entities.player;
      p.dmgBonus += 0.04;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
      p.mana = p.maxMana;
      UI.hideLevelUp();   // 关闭可能残留的升级界面
      this.toast('神通已尽 · 道韵加持（攻击 +4%）');
      AudioFX.tribSuccess();
      Particles.ring(p.x, p.y, '#ffe9a0', 30, 0.6, 6);
      if (this.pendingLevelUps.length > 0) this.openLevelUp();
      return;
    }
    this.state = 'levelup';
    UI.showLevelUp(choices);
    AudioFX.levelup();
  },

  chooseSkill(id) {
    const res = SkillSystem.apply(id);
    UI.buildSkillBar();
    this.state = 'playing';
    UI.hideLevelUp();     // 关键：立即关闭升级界面，否则遮罩残留导致后续点击无响应
    if (res.fused) {
      // 融合成功：金光特效 + 横幅
      const F = CFG.fusions[res.fused];
      const p = Entities.player;
      Particles.ring(p.x, p.y, '#ffe9a0', 40, 0.8, 8);
      Particles.burst(p.x, p.y, '#ffe9a0', 30, 420, 5);
      this.shake(8);
      UI.showFusion(F);
      AudioFX.tribSuccess();
    }
    this.lastTs = performance.now();
    if (this.pendingLevelUps.length > 0 && !Waves.trib.active) this.openLevelUp();
  },

  // ---------------- 渡劫（天雷劫） ----------------
  startTribulation(power = 1, duration = 10, label = '', millennium = false) {
    UI.showTrib(true, label ? '' : undefined);
    Waves.startTribulation(power, duration, label, millennium);
    if (!label) this.toast(`渡劫！天雷将至！`);
  },

  tribSuccess() {
    this.tribCount++;
    Entities.player.realm = this.tribCount;
    // 全屏清妖（Boss 除外）
    for (const e of Entities.enemies.slice()) {
      if (e.boss) continue;
      Particles.burst(e.x, e.y, e.color || '#8a5a4a', 6, 240, 3);
      Particles.ring(e.x, e.y, '#ffe9a0', 16, 0.4, 3);
    }
    Entities.enemies = Entities.enemies.filter(e => e.boss);
    // 奖励：满血 + 属性
    const p = Entities.player;
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    SkillSystem.recompute();
    UI.showTrib(false);
    UI.buildSkillBar();
    AudioFX.tribSuccess();
    this.shake(12);
    const realmName = CFG.realms[Math.min(this.tribCount, CFG.realms.length - 1)].name;
    this.toast(`${realmName}已成 · 万妖辟易！`);
    // 处理积压的升级
    if (this.pendingLevelUps.length > 0 && this.state === 'playing') this.openLevelUp();
  },

  // 三千年雷劫渡过：不升境界，仅获道韵加持（劫劫更强的补偿）
  millenniumSuccess() {
    const p = Entities.player;
    p.dmgBonus += 0.05;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
    p.mana = p.maxMana;
    SkillSystem.recompute();
    UI.showTrib(false);
    AudioFX.tribSuccess();
    this.shake(8);
    this.toast(`雷劫已渡 · 道韵+5%（劫劫更强，切勿懈怠）`);
    if (this.pendingLevelUps.length > 0 && this.state === 'playing') this.openLevelUp();
  },

  // ---------------- 事件 ----------------
  onBossKilled(e) {
    if (e.type === 'heart') {
      this.win();
    } else {
      this.toast('妖王伏诛 · 妖潮暂歇');
      // 清场：小妖尽灭（保留 Boss 机制一致）
      for (const o of Entities.enemies.slice()) {
        if (o.boss) continue;
        Particles.burst(o.x, o.y, o.color, 4, 180, 2);
        Entities.spawnOrb(o.x, o.y, 0, true);
        o.dead = true;
      }
      Entities.enemies = Entities.enemies.filter(o => !o.dead);
    }
  },

  win() {
    this.state = 'result';
    AudioFX.win();
    this.showResult(true);
  },

  onPlayerDeath() {
    this.state = 'result';
    AudioFX.lose();
    AudioFX.stopMusic();
    this.showResult(false);
  },

  showResult(win) {
    const p = Entities.player;
    const ri = Entities.realmIndex();
    const stats = {
      win,
      time: this.time,
      kills: Entities.kills,
      level: p.level,
      realm: CFG.realms[ri].name,
      realmIdx: ri,
      maxCombo: Entities.maxCombo,
    };
    // 存档
    const d = Utils.store.load();
    const best = d.best;
    const better = !best ||
      (win && !best.win) ||
      (win === !!best.win && stats.time > best.time) ||
      (win === !!best.win && stats.time === best.time && stats.kills > best.kills);
    if (better) {
      d.best = { win, time: stats.time, kills: stats.kills, level: stats.level, realm: stats.realm };
      Utils.store.save();
    }
    stats.newBest = better;
    UI.showResult(stats);
  },

  setBossUI(name, e) {
    if (!name) { UI.el['boss-bar'].classList.add('hidden'); return; }
    UI.el['boss-name'].textContent = name;
    UI.el['boss-bar'].classList.remove('hidden');
    AudioFX.bossSpawn();
  },

  setWave(wave) { UI.setWave(wave); },
  toast(msg, dur) { UI.toast(msg, dur); },
  shake(amt) { this.shakeAmt = Math.min(24, this.shakeAmt + amt); },
  hitStop() { this.hitStopT = CFG.fx.hitStop; },

  // ---------------- 主循环 ----------------
  frame(dt) {
    const ctx = this.ctx;
    // 顿帧
    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      dt = 0;
    }
    // 更新
    switch (this.state) {
      case 'playing':
        this.time += dt;
        if (this._ascendFlash > 0) this._ascendFlash -= dt * 1.4;
        // 帧驱动突破事件（不依赖 setTimeout，避免升级界面暂停时被吞）
        if (this._ascendT > 0) {
          this._ascendT -= dt;
          if (this._ascendT <= 0) this.finishAscend();
        }
        if (this._jindanT > 0) {
          this._jindanT -= dt;
          if (this._jindanT <= 0) this.spawnJindan();
        }
        if (this._xinsmT > 0) {
          this._xinsmT -= dt;
          if (this._xinsmT <= 0) this.spawnXinsm();
        }
        Entities.update(dt);
        SkillSystem.update(dt);
        Waves.update(dt);
        this.updateCam(dt);
        // 时间到 → 心魔未灭不得飞升
        if (this.time >= CFG.SURVIVE && !Entities.boss && this.state === 'playing') {
          this.toast('心魔未灭 · 何以飞升！');
          // 强制触发心魔
          if (Waves.lastBossIdx < 3) {
            Waves.lastBossIdx = 3;
            Entities.spawnBoss('heart');
          }
        }
        UI.updateHUD(dt);
        break;
      case 'levelup':
      case 'paused':
        UI.updateHUD(0);
        break;
      case 'menu':
        this.demoP += dt;
        this.updateCam(dt);
        if (Math.random() < dt * 6) {
          Particles.spawn({
            x: CFG.W / 2 + Utils.rand(-400, 400), y: CFG.H / 2 + Utils.rand(-300, 300),
            vx: Utils.rand(-20, 20), vy: Utils.rand(-30, -10),
            size: Utils.rand(1.5, 3.5), color: Utils.pick(['#9fe8fa', '#ffe9a0', '#d8c8ff']), life: Utils.rand(2, 4), drag: 0.99,
          });
        }
        Particles.update(dt);
        break;
      case 'result':
        Particles.update(dt);
        break;
    }

    // 渲染
    this.render(ctx);

    // 输入一次性事件
    this.handleInput();
    Input.endFrame();
  },

  handleInput() {
    if (this.state === 'playing') {
      if (Input.justPressed(' ')) Entities.dodge();
      if (Input.justPressed('escape')) this.togglePause();
    } else if (this.state === 'paused') {
      if (Input.justPressed('escape')) this.togglePause();
    } else if (this.state === 'levelup') {
      const k = ['1', '2', '3'].find(k => Input.justPressed(k));
      if (k) {
        const card = UI.el['lu-cards'].querySelector(`.lu-card:nth-child(${k})`);
        if (card) this.chooseSkill(card.dataset.id);
      }
    } else if (this.state === 'menu') {
      if (Input.justPressed('enter', ' ')) this.start();
    }
  },

  updateCam(dt) {
    const p = Entities.player;
    if (this.state === 'menu') {
      const a = this.demoP * 0.06;
      this.cam.x = Math.sin(a) * 160;
      this.cam.y = Math.cos(a * 0.7) * 100;
      return;
    }
    if (!p) return;
    const k = 1 - Math.exp(-8 * dt);
    this.cam.x += (p.x - this.cam.x) * k;
    this.cam.y += (p.y - this.cam.y) * k;
  },

  render(ctx) {
    const W = CFG.W, H = CFG.H;
    const t = this.lastTs / 1000;
    const shakeX = this.shakeAmt ? Utils.rand(-this.shakeAmt, this.shakeAmt) : 0;
    const shakeY = this.shakeAmt ? Utils.rand(-this.shakeAmt, this.shakeAmt) : 0;
    this.shakeAmt *= 0.86;
    if (this.shakeAmt < 0.4) this.shakeAmt = 0;

    // 屏幕空间背景（必须全屏覆盖，杜绝旧帧残留拖影）
    Renderer.drawBackground(ctx, this.cam, t);

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.translate(W / 2 - this.cam.x, H / 2 - this.cam.y);

    if (this.state !== 'menu') {
      const p = Entities.player;
      // 决战结界（世界坐标，画在最底层实体之上）
      Renderer.drawArena(ctx, t);
      // 灵气珠
      Renderer.drawOrbs(ctx, t);
      // 敌人（普通在前，Boss 最后）
      for (const e of Entities.enemies) if (!e.boss) Renderer.drawEnemy(ctx, e, t);
      if (Entities.boss) Renderer.drawBoss(ctx, Entities.boss, t);
      // 玩家
      if (p) Renderer.drawPlayer(ctx, p, t);
      // 剑阵 / 剑灵
      Renderer.drawAura(ctx, t);
      Renderer.drawSpirits(ctx, t);
      // 弹幕
      Renderer.drawProjectiles(ctx, t);
      // 渡劫预警/雷柱（世界空间）
      Renderer.drawTrib(ctx, t);
    }

    // 粒子（世界空间）
    Particles.draw(ctx);

    ctx.restore();

    // 屏幕特效（屏幕空间）
    // 飞升灵界全屏白光
    if (this._ascendFlash > 0) {
      ctx.fillStyle = `rgba(255,250,230,${Math.min(0.85, this._ascendFlash)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // 渡劫全屏紫光压顶
    if (Waves.trib.active && this.state !== 'menu') {
      const a = 0.10 + 0.05 * Math.sin(t * 6);
      ctx.fillStyle = `rgba(120,100,255,${a})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.state === 'result') {
      const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, H * 0.7);
      g.addColorStop(0, 'transparent');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  },
};
