// ================= 实体系统：玩家 / 敌人 / Boss / 弹幕 / 灵气珠 =================
const Entities = {
  player: null,
  enemies: [],       // 全部敌人（含 Boss）
  projectiles: [],   // 双方弹幕
  orbs: [],          // 灵气珠
  boss: null,        // 当前 Boss 引用
  bossQueue: [],     // 待出场 Boss 类型队列
  arena: null,       // Boss 决战结界 { x, y, w, h }
  blocks: 0,         // 剑阵挡弹计数
  comboT: 0, combo: 0, maxCombo: 0,
  kills: 0, damageDealt: 0, damageTaken: 0,
  _eid: 1,

  reset() {
    const P = CFG.player;
    this.player = {
      x: 0, y: 0,
      hp: P.hp, maxHp: P.hp,
      mana: P.mana, maxMana: P.mana,
      level: 1, xp: 0, xpNeed: this.xpNeed(1),
      realm: 0,
      speed: P.speed, critChance: P.critChance, critMult: P.critMult,
      atkPct: 1, hpRegen: P.hpRegen, manaRegen: P.manaRegen,
      dmgBonus: 0,
      lifesteal: 0, dmgPct: 0,
      dodgeBonus: 0, dodgeCdMul: 1, dodgeInvulnAdd: 0, dodgeDistAdd: 0,
      xpRange: CFG.orb.attractR, xpGain: P.xpGain, killHeal: 0,
      dr: 0, parry: { chance: 0, reflect: 0 },
      dodgeCd: 0, dodgeMaxCd: P.dodge.cd, invulnT: 0, hurtT: 0,
      slowT: 0, slowPct: 0,
      face: 0, moving: false, dashT: 0,
      speedPct: 0,
      dead: false,
    };
    this.enemies = [];
    this.projectiles = [];
    this.orbs = [];
    this.boss = null;
    this.bossQueue = [];
    this.arena = null;
    this.blocks = 0;
    this.comboT = 0; this.combo = 0; this.maxCombo = 0;
    this.kills = 0; this.damageDealt = 0; this.damageTaken = 0;
  },

  xpNeed(level) { return Math.round(CFG.expBase + level * 2.2); },

  realmName() {
    let name = CFG.realms[0].name;
    for (const rl of CFG.realms) if (this.player.level >= rl.at) name = rl.name;
    return name;
  },
  realmIndex() {
    let idx = 0;
    for (let i = 0; i < CFG.realms.length; i++) if (this.player.level >= CFG.realms[i].at) idx = i;
    return idx;
  },

  // ---------------- 玩家 ----------------
  addXp(n) {
    const p = this.player;
    if (p.dead) return;
    p.xp += n;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed;
      p.level++;
      p.xpNeed = this.xpNeed(p.level);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.12);   // 升级回寿元
      Game.onLevelUp(p.level);
    }
  },

  damagePlayer(amount, srcX = null, srcY = null) {
    const p = this.player;
    if (p.dead || p.invulnT > 0) return;
    // 天眼通 · 闪避
    if ((p.dodgeBonus || 0) > 0 && Utils.chance(p.dodgeBonus)) {
      Particles.text(p.x, p.y - 34, '闪避!', '#a8e8ff', 20);
      p.invulnT = 0.2;
      return;
    }
    // 乾坤挪移 · 概率免伤反弹
    if (p.parry.chance > 0 && Utils.chance(p.parry.chance)) {
      Particles.text(p.x, p.y - 34, '挪 移 !', '#ffd0d8', 22);
      Particles.ring(p.x, p.y, '#ffd0d8', 26, 0.35);
      if (srcX !== null) this.damageEnemyAt(srcX, srcY, p.parry.reflect, { knock: 130, crit: false, silent: true });
      AudioFX.dodge();
      p.invulnT = 0.2;
      return;
    }
    const dmg = amount * (1 - p.dr);
    p.hp -= dmg;
    p.hurtT = 0.18;
    p.invulnT = 0.55;
    this.damageTaken += dmg;
    Game.hitStop();
    Game.shake(7);
    AudioFX.hurt();
    Particles.burst(p.x, p.y, '#e4573d', 10, 220, 4);
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true;
      Game.onPlayerDeath();
    }
  },
  damageEnemyAt(x, y, dmg, opts = {}) {
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Utils.dist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) this.damageEnemy(best, dmg, opts);
  },

  dodge() {
    const p = this.player;
    if (p.dead || p.dodgeCd > 0) return;
    const axis = Input.axis();
    const D = CFG.player.dodge;
    const hasMana = p.mana >= D.manaCost;
    const cd = D.cd * (p.dodgeCdMul || 1);
    p.dodgeCd = hasMana ? cd : D.noManaCd;
    p.dodgeMaxCd = p.dodgeCd;
    if (hasMana) p.mana -= D.manaCost;
    const ang = (axis.x || axis.y) ? Math.atan2(axis.y, axis.x) : p.face;
    p.x += Math.cos(ang) * D.dist * (1 + (p.dodgeDistAdd || 0));
    p.y += Math.sin(ang) * D.dist * (1 + (p.dodgeDistAdd || 0));
    p.invulnT = Math.max(p.invulnT, D.invuln + (p.dodgeInvulnAdd || 0));
    p.dashT = 0.22;
    Particles.ring(p.x, p.y, '#7ee8fa', 24, 0.4);
    for (let i = 0; i < 8; i++) Particles.spawn({ x: p.x, y: p.y, vx: Math.cos(ang) * Utils.rand(40, 160), vy: Math.sin(ang) * Utils.rand(40, 160), size: Utils.rand(3, 6), color: '#9fe8fa', life: 0.4, drag: 0.85 });
    AudioFX.dodge();
  },

  // ---------------- 伤害结算（对敌人） ----------------
  damageEnemy(e, dmg, opts = {}) {
    if (e.dead) return;
    const crit = opts.crit !== false && Utils.chance(this.player.critChance);
    const mult = crit ? this.player.critMult : 1;
    const total = dmg * this.player.atkPct * (1 + (this.player.dmgPct || 0)) * mult * (1 + (this.player.dmgBonus || 0)) + (opts.flat || 0);
    e.hp -= total;
    e.flash = 0.09;
    this.damageDealt += total;
    // 血煞功 · 吸血
    if (this.player.lifesteal > 0) {
      const heal = total * this.player.lifesteal;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      if (Math.random() < 0.15) Particles.text(e.x, e.y - e.r - 20, '+' + Math.round(heal), '#e86a6a', 14, 0.5);
    }
    if (crit) {
      Particles.text(e.x, e.y - e.r - 12, Math.round(total).toString(), '#ffd24a', 24, 0.8);
      AudioFX.crit();
      Particles.burst(e.x, e.y, '#ffe9a0', 6, 200, 3);
    } else if (opts.showDmg) {
      Particles.text(e.x, e.y - e.r - 10, Math.round(total).toString(), opts.dmgColor || '#e8e4d8', 16, 0.6);
    }
    if (opts.knock && (e.knockT || 0) <= 0) {
      e.knockT = 0.12;
      const sx = opts.sx !== undefined ? opts.sx : this.player.x;
      const sy = opts.sy !== undefined ? opts.sy : this.player.y;
      const a = Math.atan2(e.y - sy, e.x - sx);
      e.knockVx = Math.cos(a) * opts.knock;
      e.knockVy = Math.sin(a) * opts.knock;
    }
    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy(e) {
    e.dead = true;
    const p = this.player;
    this.kills++;
    this.combo++; this.comboT = 3.0;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    // 掉落灵气珠
    const n = e.boss ? CFG.orbDrop.boss : (e.elite ? CFG.orbDrop.elite : CFG.orbDrop.normal);
    const isHeal = Utils.chance(CFG.orb.healChance);
    for (let i = 0; i < n; i++) {
      this.spawnOrb(e.x + Utils.rand(-e.r, e.r), e.y + Utils.rand(-e.r, e.r), e.xp, e.boss ? false : isHeal);
    }
    if (p.killHeal > 0 && !e.boss) {
      p.hp = Math.min(p.maxHp, p.hp + p.killHeal);
      Particles.text(e.x, e.y, '+' + p.killHeal.toFixed(1), '#6fd9a5', 16, 0.7);
    }
    Particles.burst(e.x, e.y, e.color || '#8a5a4a', e.boss ? 40 : (e.elite ? 20 : 8), e.boss ? 420 : 260, e.boss ? 5 : 4);
    if (e.boss) {
      this.boss = null;
      this.breakArena();
      Game.setBossUI(null, null);
      AudioFX.tribSuccess();
      Game.shake(14);
      Particles.ring(e.x, e.y, '#ffe9a0', 40, 0.7, 8);
      Particles.ring(e.x, e.y, '#ffffff', 24, 0.5, 6);
      if (e.xinsm) Game.onXinsmKilled(e);
      else if (e.jindan) Game.onJindanKilled(e);
      else Game.onBossKilled(e);
    } else {
      if (e.elite) { AudioFX.bossHit(); Particles.ring(e.x, e.y, '#ffd24a', 30, 0.5, 6); }
      else AudioFX.kill();
    }
  },

  spawnOrb(x, y, val, heal = false) {
    if (this.orbs.length >= CFG.orb.maxCount) this.orbs.shift();
    const a = Math.random() * Math.PI * 2;
    const s = Utils.rand(20, 90);
    this.orbs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, val, heal, t: Utils.rand(0, 6) });
  },

  // ---------------- 刷新 ----------------
  spawnEnemy(type, x, y, elite = false) {
    const T = CFG.types[type];
    const EL = CFG.elite;
    const mult = Math.pow(1 + Game.time / 75, 1.32);
    const e = {
      id: this._eid++,
      type, elite,
      x, y,
      hp: (T.hp * (elite ? EL.hpMult : 1)) * mult,
      maxHp: 0,
      speed: T.speed * (elite ? 0.9 : 1) * Utils.rand(0.88, 1.12),
      dmg: T.dmg * (elite ? EL.dmgMult : 1),
      r: T.r * (elite ? EL.rMult : 1),
      xp: T.xp * (elite ? EL.xpMult : 1),
      sprite: elite ? EL.sprite : T.sprite,
      flash: 0, knockT: 0, knockVx: 0, knockVy: 0,
      slowT: 0, slowPct: 0, burnT: 0, burnDps: 0,
      dash: T.dash ? { cd: T.dash.cd * Utils.rand(0.9, 1.2), t: 0, state: 'idle', chargeT: 0, tx: 0, ty: 0 } : null,
      ranged: T.ranged ? { t: T.ranged.cd * Utils.rand(0.4, 1) } : null,
      dead: false, wob: Math.random() * 6,
      scale: T.scale || 1,
    };
    e.maxHp = e.hp;
    this.enemies.push(e);
    return e;
  },

  spawnBoss(type) {
    if (this.boss) return null;   // 已有 Boss 时拒绝新 Boss（防撞车）
    const B = CFG.boss[type];
    const p = this.player;
    const isXinsm = type === 'xinsm';
    const isJindan = type === 'jindan';
    let hp = B.hp;
    let e;
    if (isXinsm) {
      // ===== 心魔：1:1 复制当前玩家 =====
      // 血量：以玩家当前战力为基准（保证一场有分量的心魔战）
      hp = Math.max(30000, 22000 + p.level * 550);
      e = {
        id: this._eid++, type, elite: false, boss: true, xinsm: true, jindan: false,
        x: 0, y: -260,
        hp, maxHp: hp,
        speed: p.speed * 0.92, dmg: 12, r: 34,
        xp: 30, sprite: 'heart',
        flash: 0, knockT: 0, knockVx: 0, knockVy: 0,
        slowT: 0, slowPct: 0, burnT: 0, burnDps: 0,
        dead: false, wob: 0,
        state: 'enter', enterT: 0,
        chargeAng: 0, chargeSpd: 0, chargeT: 0,
        fireT: {}, slamR: 0,
        mimic: this.buildMimic(),   // 复制玩家的神通
        orbit: Math.random() * Math.PI * 2,
      };
    } else {
      e = {
        id: this._eid++, type, elite: false, boss: true, xinsm: false, jindan: isJindan,
        x: 0, y: -260,
        hp, maxHp: hp,
        speed: B.speed, dmg: B.dmg, r: B.r,
        xp: 30, sprite: B.sprite,
        flash: 0, knockT: 0, knockVx: 0, knockVy: 0,
        slowT: 0, slowPct: 0, burnT: 0, burnDps: 0,
        dead: false, wob: 0,
        state: 'enter', enterT: 0,
        chargeAng: 0, chargeSpd: 0, chargeT: 0,
        fireT: {}, slamR: 0,
      };
      for (const k in B.skills) e.fireT[k] = B.skills[k].cd * Utils.rand(0.3, 0.7);
    }
    this.boss = e;
    this.enemies.push(e);
    // 决战结界：妖王现身，天罡困阵锁住战场（金丹光球不设结界）
    if (!isJindan) {
      const aw = 1280, ah = 720;
      this.arena = {
        x: Utils.clamp(p.x, aw / 2 + 40, CFG.W * 2 - aw / 2 - 40),
        y: Utils.clamp(p.y, ah / 2 + 40, CFG.H * 2 - ah / 2 - 40),
        w: aw, h: ah, t: 0,
      };
      // 生成当帧立即拉回玩家（Waves 在 Entities 之前更新，否则玩家滞留阵外一帧）
      const A = this.arena;
      p.x = Utils.clamp(p.x, A.x - A.w / 2 + CFG.player.radius, A.x + A.w / 2 - CFG.player.radius);
      p.y = Utils.clamp(p.y, A.y - A.h / 2 + CFG.player.radius, A.y + A.h / 2 - CFG.player.radius);
      Game.shake(20);
      Game.toast('妖王现身！天罡困阵已启——决一死战，胜者方出！');
    }
    AudioFX.bossSpawn();
    Game.shake(16);
    if (isJindan) Game.setBossUI('金丹 · 碎丹在即', e);
    else if (isXinsm) Game.setBossUI('心魔 · 元婴劫', e);
    else Game.setBossUI(B.name, e);
    return e;
  },

  // 结界破碎
  breakArena() {
    if (!this.arena) return;
    const a = this.arena;
    this.arena = null;
    Game.shake(18);
    AudioFX.tribSuccess();
    const col = '#ffd24a';
    // 四边光墙爆散
    for (let i = 0; i < 46; i++) {
      const edge = i % 4;
      const bx = edge === 0 ? a.x - a.w / 2 : (edge === 1 ? a.x + a.w / 2 : a.x + Utils.rand(-a.w / 2, a.w / 2));
      const by = edge === 2 ? a.y - a.h / 2 : (edge === 3 ? a.y + a.h / 2 : a.y + Utils.rand(-a.h / 2, a.h / 2));
      Particles.spawn({
        x: bx, y: by, vx: Utils.rand(-140, 140), vy: Utils.rand(-140, 140),
        size: Utils.rand(2.5, 5), color: col, life: Utils.rand(0.4, 0.9), drag: 0.9,
      });
    }
    Particles.ring(a.x, a.y, col, 60, 0.7, 10);
  },

  // ---------------- 弹幕 ----------------
  fireProj(o) {
    o.kind = o.kind || 'generic';
    o.hit = new Set();
    o.life = o.life ?? 1.2;
    this.projectiles.push(o);
  },
  fireEnemyProj(x, y, tx, ty, speed, dmg, opts = {}) {
    const a = Math.atan2(ty - y, tx - x);
    this.fireProj({
      x, y, owner: 'enemy',
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      r: opts.r || CFG.projectile.enemyR,
      dmg, life: opts.life || CFG.projectile.enemyLife,
      kind: opts.kind || 'orb',
      color: opts.color || '#b06adf',
      blockable: opts.blockable !== false,   // 普通弹可被剑阵格挡；必杀弹不可挡
      slow: opts.slow || 0, slowT: opts.slowT || 2.5,
    });
  },

  // 诛仙剑阵 / 青竹诛仙阵：环绕飞剑格挡普通弹幕
  updateAuraBlock(dt) {
    const p = this.player;
    if (!p || p.dead) return;
    const fused = SkillSystem.hasFusion('qingzhu');
    const lv = SkillSystem.lv('aura');
    if (!fused && !lv) return;
    const blades = fused ? CFG.fusions.qingzhu.data.blades : SkillSystem.levelData('aura').blades;
    const rad = fused ? CFG.fusions.qingzhu.data.r : SkillSystem.levelData('aura').r;
    const angle = SkillSystem.auraAngle;
    for (const pr of this.projectiles) {
      if (pr.owner !== 'enemy' || pr.dead) continue;
      if (!pr.blockable) continue;   // 必杀弹不可挡
      for (let i = 0; i < blades; i++) {
        const a = angle + (i / blades) * Math.PI * 2;
        const bx = p.x + Math.cos(a) * rad;
        const by = p.y + Math.sin(a) * rad;
        if (Utils.dist(pr.x, pr.y, bx, by) < pr.r + 10) {
          pr.dead = true;
          this.blocks++;
          Particles.burst(pr.x, pr.y, '#ffe9a0', 6, 200, 2.5);
          Particles.spawn({ x: pr.x, y: pr.y, vx: Utils.rand(-80, 80), vy: Utils.rand(-120, -20), size: 3, color: '#ffd24a', life: 0.4, drag: 0.9 });
          if (this.blocks % 12 === 0) AudioFX.dodge();
          break;
        }
      }
    }
  },

  // ---------------- 更新 ----------------
  update(dt) {
    this.updatePlayer(dt);
    this.updateAuraBlock(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateOrbs(dt);
    this.updateCombo(dt);
  },

  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;
    const ax = Input.axis();
    let spd = p.speed * (1 + p.speedPct);
    if (p.dashT > 0) spd *= 1.45;
    if (p.slowT > 0) { p.slowT -= dt; spd *= (1 - p.slowPct); }
    if (ax.x || ax.y) {
      p.x += ax.x * spd * dt;
      p.y += ax.y * spd * dt;
      p.face = Math.atan2(ax.y, ax.x);
      p.moving = true;
    } else p.moving = false;

    p.mana = Math.min(p.maxMana, p.mana + p.manaRegen * dt);
    p.hp = Math.min(p.maxHp, p.hp + p.hpRegen * dt);
    // 决战结界：玩家被困于天罡阵内
    if (this.arena) {
      const a = this.arena;
      p.x = Utils.clamp(p.x, a.x - a.w / 2 + CFG.player.radius, a.x + a.w / 2 - CFG.player.radius);
      p.y = Utils.clamp(p.y, a.y - a.h / 2 + CFG.player.radius, a.y + a.h / 2 - CFG.player.radius);
    }
    if (p.invulnT > 0) p.invulnT -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.dodgeCd > 0) p.dodgeCd -= dt;
    if (p.dashT > 0) p.dashT -= dt;
    // 御空残影
    if (p.moving && Math.random() < dt * 14) {
      Particles.spawn({
        x: p.x + Utils.rand(-8, 8), y: p.y + Utils.rand(-8, 8),
        vx: -ax.x * 60 + Utils.rand(-15, 15), vy: -ax.y * 60 + Utils.rand(-15, 15),
        size: Utils.rand(2.5, 5), color: '#7ee8fa', life: Utils.rand(0.25, 0.45), drag: 0.92, alpha: 0.5,
      });
    }
  },

  updateEnemies(dt) {
    const p = this.player;
    const list = this.enemies;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.dead) { list.splice(i, 1); continue; }
      if (e.flash > 0) e.flash -= dt;
      if (e.knockT > 0) { e.knockT -= dt; e.x += e.knockVx * dt; e.y += e.knockVy * dt; }
      // 灼烧
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burnDps * dt;
        if (Math.random() < dt * 12) Particles.spawn({ x: e.x + Utils.rand(-e.r, e.r), y: e.y + Utils.rand(-e.r, e.r), vx: Utils.rand(-20, 20), vy: Utils.rand(-60, -20), size: Utils.rand(2, 4), color: '#ff8a4a', life: 0.4, drag: 0.9 });
        if (e.hp <= 0) { this.killEnemy(e); list.splice(i, 1); continue; }
      }
      if (e.boss) {
        this.updateBoss(e, dt);
        // Boss 任何状态（含镜像/冲锋/甩尾）都在结界内——防止被击退穿墙
        if (this.arena && e.state !== 'enter') {
          const a = this.arena;
          e.x = Utils.clamp(e.x, a.x - a.w / 2 + e.r, a.x + a.w / 2 - e.r);
          e.y = Utils.clamp(e.y, a.y - a.h / 2 + e.r, a.y + a.h / 2 - e.r);
        }
      }
      else this.updateNormal(e, dt);
      // 接触伤害（普通敌人与 Boss 一视同仁）
      if (p.invulnT <= 0 && !p.dead) {
        const rr = e.r + CFG.player.radius;
        if (Utils.dist(p.x, p.y, e.x, e.y) < rr) this.damagePlayer(e.dmg, e.x, e.y);
      }
    }
  },

  updateNormal(e, dt) {
    const p = this.player;
    let spd = e.speed;
    if (e.slowT > 0) { e.slowT -= dt; spd *= (1 - e.slowPct); }
    // 血蝠冲刺
    if (e.dash) {
      const d = e.dash;
      if (d.state === 'idle') {
        d.t += dt;
        this.chase(e, spd * 0.45, dt);
        if (d.t >= CFG.types.bat.dash.cd) { d.state = 'windup'; d.chargeT = CFG.types.bat.dash.windup; d.tx = p.x; d.ty = p.y; }
      } else if (d.state === 'windup') {
        d.chargeT -= dt;
        e.wob += dt * 26;
        if (d.chargeT <= 0) { d.state = 'dash'; }
      } else {
        const a = Math.atan2(d.ty - e.y, d.tx - e.x);
        e.x += Math.cos(a) * CFG.types.bat.dash.speed * dt;
        e.y += Math.sin(a) * CFG.types.bat.dash.speed * dt;
        if (Utils.dist(e.x, e.y, d.tx, d.ty) < 18 || Math.hypot(d.tx - e.x, d.ty - e.y) < 18) { d.state = 'idle'; d.t = 0; }
      }
    } else {
      this.chase(e, spd, dt);
    }
    // 远程妖兽弹幕（蛇妖/蝠妖/蝎妖/精英狐妖，按各自配置连发或扇形）
    if (e.ranged) {
      e.ranged.t -= dt;
      const d = Utils.dist(p.x, p.y, e.x, e.y);
      const R = e.ranged;
      if (e.ranged.t <= 0 && d < (R.range || 560) && d > 220) {
        e.ranged.t = R.cd;
        const count = R.count || 1;
        const spread = R.spread || 0;
        const base = Utils.angle(e.x, e.y, p.x, p.y);
        const kind = R.kind || 'orb';
        const dmgMul = R.dmgMult || 1;
        const colors = { dart: '#c88adf', venom: '#8ae86a', willow: '#ffd24a' };
        for (let i = 0; i < count; i++) {
          const a = count === 1 ? base : base + (i - (count - 1) / 2) * spread;
          this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60,
            R.speed, e.dmg * dmgMul, { kind, color: colors[kind] || '#b06adf', r: kind === 'venom' ? 11 : 9 });
        }
        if (kind === 'venom') AudioFX.bossHit();
      }
    }
  },

  chase(e, spd, dt) {
    const p = this.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.x += Math.cos(a) * spd * dt;
    e.y += Math.sin(a) * spd * dt;
    e.wob += dt * 8;
  },

  // 心魔 1:1 复制：读取玩家已装备的全部主动/召唤神通（含融合产物）
  buildMimic() {
    const list = [];
    for (const id in SkillSystem.owned) {
      const S = CFG.skills[id];
      if (S && (S.type === 'active' || S.type === 'summon')) list.push(id);
    }
    for (const fid in SkillSystem.fused) {
      const F = CFG.fusions[fid];
      if (F && (F.type === 'active' || F.type === 'summon')) list.push(fid);
    }
    if (!list.length) list.push('sword');
    const cd = {};
    for (const id of list) cd[id] = Utils.rand(0.6, 1.6);
    return { skills: list, cd };
  },

  // 心魔技能冷却：与玩家同技能同等级同 CD（1:1）
  mimicCd(id) {
    const S = CFG.skills[id];
    if (S) {
      const lv = SkillSystem.lv(id);
      const D = lv ? S.levels[lv - 1] : null;
      return (D && D.cd ? D.cd : 2.2) * Utils.rand(0.85, 1.05);
    }
    const F = CFG.fusions[id];
    if (F) return (F.data.cd || 2.2) * Utils.rand(0.85, 1.05);
    return 2.2;
  },

  // 心魔 AI：像玩家一样走位风筝 + 用玩家神通反打
  updateXinsm(e, dt) {
    const p = this.player;
    // 技能调度：1:1 复刻玩家技能
    for (const id of e.mimic.skills) {
      e.mimic.cd[id] -= dt;
      if (e.mimic.cd[id] <= 0) {
        e.mimic.cd[id] = this.mimicCd(id);
        this.mimicFire(e, id);
      }
    }
    // 走位：保持距离绕圈（复制玩家的风筝打法）
    const d = Utils.dist(p.x, p.y, e.x, e.y);
    e.orbit += dt * 1.15;
    const tx = p.x + Math.cos(e.orbit) * 330;
    const ty = p.y + Math.sin(e.orbit) * 330;
    const a = Math.atan2(ty - e.y, tx - e.x);
    const spd = d < 260 ? -e.speed * 1.25 : (d > 500 ? e.speed * 1.05 : e.speed * 0.6);
    e.x += Math.cos(a) * spd * dt;
    e.y += Math.sin(a) * spd * dt;
  },

  // 心魔发招：复用玩家技能数值（伤害/数量/速度 1:1），弹幕暗紫色
  mimicFire(e, id) {
    const p = this.player;
    const L = SkillSystem.lv(id);
    const D = L ? CFG.skills[id].levels[L - 1] : null;
    const F = CFG.fusions[id];
    const dmg = D ? D.dmg : (F ? F.data.dmg : 12);
    const col = '#c88adf';
    const base = Utils.angle(e.x, e.y, p.x, p.y);
    const proj = (kind, r, speed, n, spread, extra) => {
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? base : base + (i - (n - 1) / 2) * spread;
        this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60,
          speed, dmg * ((extra && extra.dmgMul) || 1), Object.assign({ kind, color: col, r }, extra));
      }
    };
    switch (id) {
      case 'sword': proj('sword', 9, D ? D.speed : 720, D ? D.swords : 1, 0.22); break;
      case 'wave': {
        const n = D ? D.blades : 12;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60,
            D ? D.speed : 560, dmg * 0.8, { kind: 'wave', color: col, r: 11, life: 0.7 });
        }
        break;
      }
      case 'bamboo': proj('bamboo', 8, 620, D ? D.count : 8, D ? D.spread : 0.5); break;
      case 'fire':
        this.fireEnemyProj(e.x, e.y, p.x, p.y, 430, dmg * 1.1, { kind: 'fireball', color: '#ff8a6a', r: 14, life: 1.8 });
        break;
      case 'ice': proj('shard', 8, D ? D.speed : 640, D ? D.shards : 8, 0.16, { slow: D ? D.slow : 0.4, slowT: D ? D.slowT : 2.4 }); break;
      case 'thunder': {
        // 心魔引雷：警示圈 + 延迟落雷（可走位躲）
        const tx = p.x + Utils.rand(-130, 130), ty = p.y + Utils.rand(-130, 130);
        Particles.ring(tx, ty, '#c88adf', 36, 0.55, 6);
        const self = this;
        setTimeout(() => {
          if (Game.state !== 'playing' || self.player.dead) return;
          Particles.bolt(tx, ty - 220, tx, ty, '#d8b0ff', 0.25, 4);
          Particles.light(tx, ty, '#d8ccff', 0.5);
          Game.shake(5);
          if (Utils.dist(tx, ty, self.player.x, self.player.y) < 64) self.damagePlayer(dmg, tx, ty);
        }, 450);
        break;
      }
      case 'stone': {
        const n = D ? D.count : 4;
        for (let i = 0; i < n; i++) {
          const tx = p.x + Utils.rand(-150, 150), ty = p.y + Utils.rand(-150, 150);
          Particles.ring(tx, ty, '#b08ae0', 22, 0.4, 5);
          const self = this;
          setTimeout(() => {
            if (Game.state !== 'playing' || self.player.dead) return;
            Particles.burst(tx, ty, '#c8b8a0', 12, 320, 4);
            Game.shake(4);
            if (Utils.dist(tx, ty, self.player.x, self.player.y) < 52) self.damagePlayer(dmg * 0.9, tx, ty);
          }, 420 + i * 60);
        }
        break;
      }
      case 'spirit': case 'puppet': proj('spirit', 8, 560, (D ? D.count : 2) || 2, 0.5); break;
      case 'bugs': proj('bug', 8, 520, D ? D.count : 6, 0.5, { dmgMul: 0.8 }); break;
      case 'wanjian':
        for (let i = 0; i < 5; i++) {
          const a = base + (i - 2) * 0.30;
          this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, 900, dmg * 0.9, { kind: 'sword', color: col, r: 10 });
        }
        break;
      case 'qingzhu':
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, 680, dmg * 0.7, { kind: 'wave', color: col, r: 12, life: 0.7 });
        }
        break;
      case 'fenlei':
        this.fireEnemyProj(e.x, e.y, p.x, p.y, 460, dmg * 1.0, { kind: 'fireball', color: '#ff8a6a', r: 16, life: 1.8 });
        break;
      case 'bingfeng': proj('shard', 9, 700, 10, 0.3, { slow: 0.7, slowT: 4 }); break;
      case 'wanling': proj('spirit', 9, 640, 5, 0.35); break;
      case 'chongchao': proj('bug', 8, 560, 14, 0.6, { dmgMul: 0.8 }); break;
      default: proj('orb', 9, 340, 3, 0.35); break;
    }
    AudioFX.bossHit();
  },

  // ---------------- Boss AI 状态机 ----------------
  updateBoss(e, dt) {
    const p = this.player;
    const B = CFG.boss[e.type];
    if (e.state === 'enter') {
      e.enterT += dt;
      e.y += 240 * dt;
      if (e.enterT > 0.9) {
        // 入场结束：撞破结界落下（拉进结界内）
        if (this.arena) {
          const a = this.arena;
          e.x = Utils.clamp(e.x, a.x - a.w / 2 + e.r, a.x + a.w / 2 - e.r);
          e.y = Utils.clamp(e.y, a.y - a.h / 2 + e.r, a.y + a.h / 2 - e.r);
          Particles.burst(e.x, e.y, '#ffd24a', 14, 320, 4);
        }
        e.state = 'fight';
      }
      return;
    }
    if (e.state === 'windup') {           // 蓄力（冲锋 / 甩尾）
      e.chargeT -= dt;
      if (e.chargeT <= 0) {
        if (e.chargeSpd > 0) e.state = 'charging';
        else if (e.slamR > 0) { e.state = 'slam'; e.slamT = 0; }
        else e.state = 'fight';
      }
      return;
    }
    if (e.state === 'charging') {         // 冲锋中
      e.chargeT -= dt;
      e.x += Math.cos(e.chargeAng) * e.chargeSpd * dt;
      e.y += Math.sin(e.chargeAng) * e.chargeSpd * dt;
      if (Utils.dist(p.x, p.y, e.x, e.y) < e.r + CFG.player.radius) {
        this.damagePlayer(e.dmg * 1.5, e.x, e.y);
        e.state = 'fight'; e.chargeSpd = 0;
      } else if (e.chargeT <= 0) { e.state = 'fight'; e.chargeSpd = 0; }
      return;
    }
    if (e.state === 'slam') {             // 甩尾冲击波扩散
      e.slamT += dt;
      const rr = e.slamR0 + e.slamT * 520;
      if (Utils.dist(p.x, p.y, e.x, e.y) < rr + 12 && p.invulnT <= 0) this.damagePlayer(e.dmg * 1.2, e.x, e.y);
      Particles.ring(e.x, e.y, '#7adf6a', rr, 0.06, 5);
      if (e.slamT > 0.9) { e.state = 'fight'; e.slamR = 0; }
      return;
    }
    if (e.state === 'mirror') {           // 心魔镜像（无敌）
      e.mirrorT -= dt;
      if (e.mirrorT <= 0) e.state = 'fight';
      return;
    }
    if (e.xinsm) {                        // 元婴心魔：1:1 复制玩家神通反打
      this.updateXinsm(e, dt);
      return;
    }
    // ---- fight：常规移动 + 技能调度 ----
    for (const k in B.skills) {
      e.fireT[k] -= dt;
      if (e.fireT[k] <= 0) {
        e.fireT[k] = B.skills[k].cd * Utils.rand(0.92, 1.1);
        this.bossSkill(e, k, B.skills[k]);
      }
    }
    const d = Utils.dist(p.x, p.y, e.x, e.y);
    if (d < 160) this.chase(e, -e.speed * 1.3, dt);
    else if (d > 400) this.chase(e, e.speed * 1.15, dt);
    else this.chase(e, e.speed * 0.55, dt);
    // 决战结界：Boss 同样被困
    if (this.arena) {
      const a = this.arena;
      e.x = Utils.clamp(e.x, a.x - a.w / 2 + e.r, a.x + a.w / 2 - e.r);
      e.y = Utils.clamp(e.y, a.y - a.h / 2 + e.r, a.y + a.h / 2 - e.r);
    }
  },

  bossSkill(e, kind, S) {
    const p = this.player;
    switch (kind) {
      case 'charge': {
        e.state = 'windup'; e.chargeT = S.windup;
        e.chargeAng = Math.atan2(p.y - e.y, p.x - e.x);
        e.chargeSpd = S.speed;
        break;
      }
      case 'summon': {
        for (let i = 0; i < S.count; i++) this.spawnEnemy('wolf', e.x + Utils.rand(-70, 70), e.y + Utils.rand(-70, 70));
        Particles.ring(e.x, e.y, '#8d6a5a', 40, 0.5, 6);
        AudioFX.bossRoar();
        break;
      }
      case 'spray': {
        const base = Utils.angle(e.x, e.y, p.x, p.y);
        for (let i = 0; i < S.count; i++) {
          const a = base + (i - S.count / 2) * 0.34;
          this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 100, e.y + Math.sin(a) * 100, S.speed, e.dmg * 0.8, { kind: 'orb', color: '#7adf6a' });
        }
        AudioFX.bossHit();
        break;
      }
      case 'slam': {
        e.state = 'windup'; e.chargeT = S.windup;
        e.slamR = 1; e.slamR0 = 40;
        Game.shake(6);
        break;
      }
      case 'web': {
        const a = Utils.angle(e.x, e.y, p.x, p.y) + Utils.rand(-0.5, 0.5);
        this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50, S.speed, e.dmg * 0.5,
          { kind: 'web', color: '#e8e8ff', slow: S.slow, slowT: S.dur, r: 13, life: 4 });
        break;
      }
      case 'spawn': {
        for (let i = 0; i < S.count; i++) this.spawnEnemy('bee', e.x + Utils.rand(-60, 60), e.y + Utils.rand(-60, 60));
        Particles.ring(e.x, e.y, '#c98a2d', 36, 0.5, 6);
        break;
      }
      case 'storm': {
        Game.shake(8);
        AudioFX.thunder();
        const self = this;
        for (let i = 0; i < S.bolts; i++) {
          const tx = p.x + Utils.rand(-420, 420), ty = p.y + Utils.rand(-300, 300);
          setTimeout(() => {
            if (Game.state !== 'playing' || self.player.dead) return;
            Particles.bolt(tx, ty - 200, tx, ty, '#c8b8ff', 0.25, 4);
            Particles.light(tx, ty, '#d8ccff', 0.35);
            Game.shake(6);
            AudioFX.thunder2();
            if (Utils.dist(tx, ty, p.x, p.y) < 70) self.damagePlayer(e.dmg * 0.9, tx, ty);
            for (const o of self.enemies) {
              if (o.dead || o.boss) continue;
              if (Utils.dist(tx, ty, o.x, o.y) < 90) self.damageEnemy(o, e.dmg * 1.2, { crit: false });
            }
          }, i * 180);
        }
        break;
      }
      case 'mirror': {
        Particles.ring(e.x, e.y, '#c8b8ff', 50, 0.6, 8);
        e.state = 'mirror'; e.mirrorT = S.dur;
        break;
      }
      case 'scatter': {
        const base = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = 0; i < S.count; i++) {
          const a = base + (i - S.count / 2) * 0.2;
          this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, S.speed, e.dmg * 0.65, { kind: 'orb', color: '#b06adf' });
        }
        AudioFX.bossHit();
        break;
      }
      case 'burst': {        // 环形弹幕：四面八方
        const col = e.xinsm ? '#c88adf' : '#7adf6a';
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < S.count; i++) {
          const a = base + (i / S.count) * Math.PI * 2;
          this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60,
            S.speed, e.dmg * (e.xinsm ? 0.85 : 0.9), { kind: 'orb', color: col });
        }
        Particles.ring(e.x, e.y, col, 36, 0.4, 6);
        AudioFX.bossHit();
        break;
      }
      case 'nova': {         // 必杀新星：紫色强弹扩散环，剑阵不可挡
        Game.shake(8);
        AudioFX.thunder();
        Particles.ring(e.x, e.y, '#c040ff', 60, 0.6, 10);
        Particles.ring(e.x, e.y, '#8a2adf', 40, 0.45, 8);
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < S.count; i++) {
          const a = base + (i / S.count) * Math.PI * 2;
          this.fireEnemyProj(e.x, e.y, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60,
            S.speed, e.dmg * 1.5, { kind: 'nova', color: '#c040ff', r: 15, blockable: false, life: 6 });
        }
        break;
      }
      case 'rain': {         // 弹雨：锁定玩家方位坠落
        Game.shake(6);
        const self = this;
        for (let i = 0; i < S.drops; i++) {
          const tx = p.x + Utils.rand(-480, 480), ty = p.y + Utils.rand(-340, 340);
          setTimeout(() => {
            if (Game.state !== 'playing' || self.player.dead) return;
            Particles.ring(tx, ty, '#c040ff', 12, 0.25, 4);
            for (let j = 0; j < 3; j++) {
              const a = Math.random() * Math.PI * 2;
              self.fireEnemyProj(tx, ty, tx + Math.cos(a) * 50, ty + Math.sin(a) * 50,
                220, e.dmg * 0.7, { kind: 'orb', color: '#e08ae0', r: 8, life: 2.4 });
            }
            if (Utils.dist(tx, ty, p.x, p.y) < 46) self.damagePlayer(e.dmg * 0.5, tx, ty);
          }, i * 140);
        }
        break;
      }
    }
  },

  updateProjectiles(dt) {
    const p = this.player;
    const list = this.projectiles;
    const cam = Game.cam;
    for (let i = list.length - 1; i >= 0; i--) {
      const pr = list[i];
      if (pr.dead) { list.splice(i, 1); continue; }   // 被剑阵格挡等
      pr.life -= dt;
      // 出屏快速销毁：离屏 300px 即消散（不留残影），寿命到期同样销毁
      if (pr.life <= 0 || Math.abs(pr.x - cam.x) > 1100 || Math.abs(pr.y - cam.y) > 700) {
        if (pr.kind === 'fireball' && pr.life > 0) this.explodeAt(pr.x, pr.y, pr.dmg, pr.r, pr.burn, pr.burnT);
        else if (pr.owner === 'player' && pr.kind !== 'bug') {
          // 消散粒子：明确弹幕已消失
          if (Math.random() < 0.5) Particles.spawn({ x: pr.x, y: pr.y, vx: Utils.rand(-40, 40), vy: Utils.rand(-40, 40), size: 3, color: pr.color || '#cfe8ff', life: 0.3, drag: 0.9, alpha: 0.7 });
        }
        list.splice(i, 1);
        continue;
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.owner === 'player') {
        let dead = false;
        for (const e of this.enemies) {
          if (e.dead || pr.hit.has(e.id)) continue;
          if (e.state === 'mirror') continue;   // 心魔镜像无敌
          const rr = e.r + pr.r;
          if (Utils.dist(pr.x, pr.y, e.x, e.y) < rr) {
            pr.hit.add(e.id);
            this.damageEnemy(e, pr.dmg, { crit: true, showDmg: pr.showDmg, knock: pr.knock || 0, dmgColor: pr.color, sx: pr.sx, sy: pr.sy });
            if (pr.kind === 'sword') Particles.slash(pr.x, pr.y, Math.atan2(pr.vy, pr.vx), 30, '#cfe8ff', 0.12);
            if (pr.kind === 'fireball') {           // 火球命中即爆
              this.explodeAt(pr.x, pr.y, pr.dmg, pr.r, pr.burn, pr.burnT);
              dead = true;
              break;
            }
            if (pr.pierce > 0) {
              pr.pierce--;
              if (pr.pierce < 0) { dead = true; break; }
            } else { dead = true; break; }
          }
        }
        if (dead) { list.splice(i, 1); continue; }
        if (pr.kind === 'fireball' && Utils.dist(pr.x, pr.y, pr.tx, pr.ty) < 24) {
          this.explodeAt(pr.x, pr.y, pr.dmg, pr.r, pr.burn, pr.burnT);
          list.splice(i, 1);
          continue;
        }
      } else {
        if (p.dead) continue;
        const rr = pr.r + CFG.player.radius;
        if (Utils.dist(pr.x, pr.y, p.x, p.y) < rr) {
          this.damagePlayer(pr.dmg, pr.x, pr.y);
          if (pr.slow && !p.dead) { p.slowT = Math.max(p.slowT, pr.slowT || 2); p.slowPct = Math.max(p.slowPct, pr.slow); }
          Particles.burst(pr.x, pr.y, pr.color, 8, 160, 3);
          list.splice(i, 1);
        }
      }
    }
  },

  explodeAt(x, y, dmg, r, burn, burnT, opts = {}) {
    const col = opts.color || '#ffab7a';
    Particles.burst(x, y, col, 22, 380, 5);
    Particles.ring(x, y, col, 20, 0.4, 7);
    Particles.light(x, y, col, 0.4);
    AudioFX.explode();
    Game.shake(opts.shake || 5);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Utils.dist(x, y, e.x, e.y);
      if (d < r + e.r) {
        this.damageEnemy(e, dmg, { crit: true, showDmg: true, dmgColor: col, knock: 60, sx: x, sy: y });
        if (burn) { e.burnT = burnT; e.burnDps = burn; }
      }
    }
  },

  updateOrbs(dt) {
    const p = this.player;
    const list = this.orbs;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      o.t += dt;
      const d = Utils.dist(p.x, p.y, o.x, o.y);
      // 远离玩家过远：直接消失（防角落堆积与超长珠串）
      if (d > 1300) { list.splice(i, 1); continue; }
      if (d < p.xpRange + 30) {
        const a = Math.atan2(p.y - o.y, p.x - o.x);
        o.vx += Math.cos(a) * CFG.orb.attractSpeed * dt * 2.2;
        o.vy += Math.sin(a) * CFG.orb.attractSpeed * dt * 2.2;
        const sp = Math.hypot(o.vx, o.vy);
        const cap = CFG.orb.attractSpeed * 1.6;
        if (sp > cap) { o.vx *= cap / sp; o.vy *= cap / sp; }
      } else {
        o.vx *= Math.pow(0.9, dt * 60); o.vy *= Math.pow(0.9, dt * 60);
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (d < CFG.player.radius + 12) {
        list.splice(i, 1);
        if (o.heal) {
          p.hp = Math.min(p.maxHp, p.hp + CFG.orb.healAmt);
          Particles.text(o.x, o.y, '+' + CFG.orb.healAmt, '#6fd9a5', 18, 0.8);
        } else {
          this.addXp(o.val * p.xpGain);
        }
        if (Math.random() < 0.1) AudioFX.orb();
      }
    }
  },

  updateCombo(dt) {
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
  },
};
