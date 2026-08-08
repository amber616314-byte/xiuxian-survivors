// ================= 神通系统：20 神通 + 8 装备栏 + 满级融合 =================
const SkillSystem = {
  owned: {},        // { skillId: level }，占用装备栏槽位
  fused: {},        // { fusionId: true } 融合产物（占 1 槽）
  timers: {},       // 技能冷却
  auraAngle: 0, spiritAngle: 0, bambooAngle: 0,
  fxT: {},          // 特效动画计时

  reset() {
    this.owned = { sword: 1 };
    this.fused = {};
    this.timers = {};
    this.auraAngle = 0; this.spiritAngle = 0; this.bambooAngle = 0;
    this.fxT = {};
    this.recompute();
  },

  lv(id) { return this.owned[id] || 0; },
  levelData(id) { return CFG.skills[id].levels[this.lv(id) - 1]; },
  maxed(id) { return this.lv(id) >= CFG.skills[id].max; },
  hasFusion(id) { return !!this.fused[id]; },

  // 已用槽位数（8 装备栏）
  slotsUsed() { return Object.keys(this.owned).length + Object.keys(this.fused).length; },
  slotsFree() { return CFG.slots - this.slotsUsed(); },

  // 被动属性重算
  recompute() {
    const p = Entities.player;
    if (!p) return;
    const L = (id) => this.lv(id);
    const D = (id) => this.levelData(id);
    const trib = Game.tribCount || 0;

    let maxHp = CFG.player.hp, hpRegen = CFG.player.hpRegen;
    if (L('body')) { maxHp += D('body').hp; hpRegen += D('body').regen; }
    if (L('pill')) { maxHp *= (1 + D('pill').hpPct); hpRegen += D('pill').regen; }
    maxHp += CFG.tribBonus.hp * trib;

    let speed = CFG.player.speed * (1 + (L('wind') ? D('wind').speedPct : 0)) * Math.pow(1 + CFG.tribBonus.speedPct, trib);
    let cc = CFG.player.critChance, cm = CFG.player.critMult;
    if (L('crit')) { cc += D('crit').cc; cm += D('crit').cm; }
    if (L('eye')) { cc += D('eye').cc; }

    let xpRange = CFG.orb.attractR, xpGain = CFG.player.xpGain, killHeal = 0;
    if (L('devour')) { xpRange *= (1 + D('devour').rangePct); xpGain *= (1 + D('devour').xpPct); killHeal = D('devour').killHeal; }

    let dr = 0, parry = { chance: 0, reflect: 0 };
    if (L('parry')) { dr = D('parry').dr; parry = { chance: D('parry').chance, reflect: D('parry').reflect }; }

    let lifesteal = 0, dmgPct = 0;
    if (L('blood')) { lifesteal = D('blood').lifesteal; dmgPct = D('blood').dmgPct; }

    let dodgeBonus = 0;
    if (L('eye')) dodgeBonus = D('eye').dodge;
    if (L('blink')) {
      const B = D('blink');
      p.dodgeCdMul = B.dodgeCd; p.dodgeInvulnAdd = B.invuln; p.dodgeDistAdd = B.distPct;
    }

    // ---- 融合产物被动 ----
    if (this.hasFusion('jinzhen')) {
      const F = CFG.fusions.jinzhen.data;
      maxHp += F.hp; hpRegen += F.regen; dr = F.dr; parry = { chance: F.chance, reflect: F.reflect };
    }
    if (this.hasFusion('liuguang')) {
      const F = CFG.fusions.liuguang.data;
      speed *= (1 + F.speedPct);
      p.dodgeCdMul = F.dodgeCd; p.dodgeInvulnAdd = F.invuln; p.dodgeDistAdd = F.distPct;
    }
    if (this.hasFusion('xuechi')) {
      const F = CFG.fusions.xuechi.data;
      lifesteal = F.lifesteal; dmgPct = F.dmgPct; xpGain *= (1 + F.xpPct); xpRange *= (1 + F.rangePct);
    }
    if (this.hasFusion('shentong')) {
      const F = CFG.fusions.shentong.data;
      cc = F.cc; cm = F.cm; dodgeBonus = F.dodge;
    }

    p.maxHp = maxHp; p.hpRegen = hpRegen;
    p.speed = speed;
    p.critChance = cc; p.critMult = cm;
    p.xpRange = xpRange; p.xpGain = xpGain; p.killHeal = killHeal;
    p.dr = dr; p.parry = parry;
    p.lifesteal = lifesteal; p.dmgPct = dmgPct;
    p.dodgeBonus = dodgeBonus;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  },

  // 三选一候选：已装备技能升级 + 空槽时新神通
  getChoices() {
    const pool = [];
    const free = this.slotsFree();
    for (const id in CFG.skills) {
      if (this.maxed(id) || this.owned[id] === undefined && free <= 0) continue;
      const isNew = !this.owned[id];
      if (!isNew || free > 0) pool.push({ id, weight: isNew ? 2.2 : 1.0 });
    }
    const chosen = [];
    const copy = pool.slice();
    while (chosen.length < 3 && copy.length) {
      let total = 0;
      for (const c of copy) total += c.weight;
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < copy.length; i++) {
        r -= copy[i].weight;
        if (r <= 0) { idx = i; break; }
      }
      chosen.push(copy[idx].id);
      copy.splice(idx, 1);
    }
    return chosen;
  },

  // 选择/升级神通；若触发融合则返回融合信息
  apply(id) {
    const S = CFG.skills[id];
    this.owned[id] = (this.owned[id] || 0) + 1;
    if (!this.timers[id]) this.timers[id] = 0.2;
    let fusedInfo = null;
    // 满级融合检测
    if (this.maxed(id) && S.fuse && this.lv(S.fuse) >= S.max) {
      fusedInfo = this.doFusion(id, S.fuse);
    }
    this.recompute();
    AudioFX.card();
    return { level: this.owned[id], fused: fusedInfo };
  },

  // 融合：两神通满级 → 超武（占 1 槽，释放 1 槽）
  doFusion(idA, idB) {
    // 找融合产物
    let fusionId = null;
    for (const fid in CFG.fusions) {
      const F = CFG.fusions[fid];
      if ((F.parts[0] === idA && F.parts[1] === idB) || (F.parts[0] === idB && F.parts[1] === idA)) {
        fusionId = fid; break;
      }
    }
    if (!fusionId) return null;
    delete this.owned[idA];
    delete this.owned[idB];
    delete this.timers[idA];
    delete this.timers[idB];
    this.fused[fusionId] = true;
    this.fxT[fusionId] = 1;
    AudioFX.tribSuccess();
    return fusionId;
  },

  fusionData(id) { return CFG.fusions[id].data; },

  // ---------------- 主动技能更新 ----------------
  update(dt) {
    const p = Entities.player;
    if (!p || p.dead) return;
    for (const id in this.timers) this.timers[id] -= dt;
    for (const id in this.fxT) if (this.fxT[id] > 0) this.fxT[id] -= dt;

    if (this.owned.sword) this.actSword(dt);
    if (this.owned.wave) this.actWave(dt);
    if (this.owned.aura) this.actAura(dt);
    if (this.owned.bamboo) this.actBamboo(dt);
    if (this.owned.fire) this.actFire(dt);
    if (this.owned.ice) this.actIce(dt);
    if (this.owned.thunder) this.actThunder(dt);
    if (this.owned.stone) this.actStone(dt);
    if (this.owned.spirit) this.actSpirit(dt);
    if (this.owned.bugs) this.actBugs(dt);
    if (this.owned.puppet) this.actPuppet(dt);
    // 融合产物主动
    if (this.hasFusion('wanjian')) this.actWanjian(dt);
    if (this.hasFusion('qingzhu')) this.actQingzhu(dt);
    if (this.hasFusion('fenlei')) this.actFenlei(dt);
    if (this.hasFusion('bingfeng')) this.actBingfeng(dt);
    if (this.hasFusion('wanling')) this.actWanling(dt);
    if (this.hasFusion('chongchao')) this.actChongchao(dt);

    this.auraAngle += dt * 2.2;
    this.spiritAngle += dt * 1.4;
    this.bambooAngle += dt * 3;
  },

  nearestEnemy(maxR = 560) {
    const p = Entities.player;
    let best = null, bd = maxR;
    for (const e of Entities.enemies) {
      if (e.dead || e.state === 'mirror') continue;
      const d = Utils.dist(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  T(id) { if (this.timers[id] === undefined) this.timers[id] = 0.2; return this.timers[id]; },

  actSword(dt) {
    if (this.T('sword') > 0) return;
    const D = this.levelData('sword');
    this.timers.sword = D.cd;
    const p = Entities.player;
    const tgt = this.nearestEnemy(560);
    const base = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : p.face;
    for (let i = 0; i < D.swords; i++) {
      const a = D.swords === 1 ? base : base + (i - (D.swords - 1) / 2) * 0.22;
      Entities.fireProj({ kind: 'sword', owner: 'player', x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * D.speed, vy: Math.sin(a) * D.speed, r: 9, dmg: D.dmg, life: 1.1, pierce: 2, sx: p.x, sy: p.y });
    }
    // 释放源闪光：明确技能生效
    Particles.ring(p.x, p.y, '#cfe8ff', 20, 0.28, 5);
    AudioFX.sword();
  },

  actWave(dt) {
    if (this.T('wave') > 0) return;
    const D = this.levelData('wave');
    this.timers.wave = D.cd;
    const p = Entities.player;
    for (let i = 0; i < D.blades; i++) {
      const a = (i / D.blades) * Math.PI * 2;
      Entities.fireProj({ kind: 'wave', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * D.speed, vy: Math.sin(a) * D.speed, r: 11, dmg: D.dmg, life: D.life, pierce: 999, sx: p.x, sy: p.y });
    }
    AudioFX.sword();
  },

  actAura(dt) {
    const D = this.levelData('aura');
    const p = Entities.player;
    for (const e of Entities.enemies) {
      if (e.dead || e.state === 'mirror') continue;
      const d = Utils.dist(p.x, p.y, e.x, e.y);
      if (d < D.r + e.r) {
        e.hp -= D.dmg * dt * 1.4;
        e.flash = Math.max(e.flash, 0.02);
        if (Math.random() < dt * 8) Particles.slash(e.x + Utils.rand(-e.r, e.r), e.y + Utils.rand(-e.r, e.r), Math.random() * 6, 22, '#ffe9a0', 0.1);
        if (e.hp <= 0 && !e.dead) { e.hp = 0; Entities.damageEnemy(e, 0, { crit: false }); }
      }
    }
  },

  actBamboo(dt) {
    if (this.T('bamboo') > 0) return;
    const D = this.levelData('bamboo');
    this.timers.bamboo = D.cd;
    const p = Entities.player;
    const tgt = this.nearestEnemy(560);
    const base = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : p.face;
    for (let i = 0; i < D.count; i++) {
      const a = base + (i - (D.count - 1) / 2) * D.spread / D.count * 2;
      Entities.fireProj({ kind: 'bamboo', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 8, dmg: D.dmg, life: 1.0, pierce: 3, sx: p.x, sy: p.y });
    }
    AudioFX.sword();
  },

  actFire(dt) {
    if (this.T('fire') > 0) return;
    const D = this.levelData('fire');
    this.timers.fire = D.cd;
    const p = Entities.player;
    const dens = Utils.densestPoint(Entities.enemies, p.x, p.y, 520);
    if (!dens.count) return;
    const a = Utils.angle(p.x, p.y, dens.x, dens.y);
    Entities.fireProj({ kind: 'fireball', owner: 'player', x: p.x, y: p.y,
      vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, r: D.r, dmg: D.dmg, life: 1.8, tx: dens.x, ty: dens.y,
      burn: D.burn, burnT: D.burnT, sx: p.x, sy: p.y });
    AudioFX.sword();
  },

  actIce(dt) {
    if (this.T('ice') > 0) return;
    const D = this.levelData('ice');
    this.timers.ice = D.cd;
    const p = Entities.player;
    const tgt = this.nearestEnemy(560);
    const base = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : p.face;
    for (let i = 0; i < D.shards; i++) {
      const a = base + (i - (D.shards - 1) / 2) * 0.16;
      Entities.fireProj({ kind: 'shard', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * D.speed, vy: Math.sin(a) * D.speed, r: 8, dmg: D.dmg, life: 1.1, pierce: 3, sx: p.x, sy: p.y,
        slow: D.slow, slowT: D.slowT });
    }
    AudioFX.sword();
  },

  actThunder(dt) {
    if (this.T('thunder') > 0) return;
    const D = this.levelData('thunder');
    this.timers.thunder = D.cd;
    const candidates = Entities.enemies.filter(e => !e.dead && e.state !== 'mirror');
    const targets = [];
    for (let i = 0; i < D.targets && candidates.length; i++) {
      targets.push(candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]);
    }
    for (const t of targets) this.boltChain(t, D.dmg, D.chain, new Set());
    AudioFX.thunder2();
  },

  boltChain(e, dmg, chainLeft, hitSet) {
    if (e.dead || hitSet.has(e.id)) return;
    hitSet.add(e.id);
    const srcX = e.x, srcY = e.y;
    Entities.damageEnemy(e, dmg, { crit: true, showDmg: true, dmgColor: '#d8ccff' });
    // 天雷：双道交叉闪电 + 地面电弧 + 冲击环（特效醒目）
    Particles.bolt(srcX, srcY - 230, srcX, srcY, '#e4dcff', 0.25, 4.5);
    Particles.bolt(srcX + Utils.rand(-26, 26), srcY - 200, srcX, srcY, '#c8b8ff', 0.2, 3);
    Particles.bolt(srcX - 14, srcY - 150, srcX + 10, srcY, '#b8a8ff', 0.16, 2.5);
    Particles.light(srcX, srcY, '#d8ccff', 0.5);
    Particles.ring(srcX, srcY, '#d8ccff', 20, 0.35, 6);
    Game.shake(4);
    AudioFX.thunder2();
    if (chainLeft <= 0) return;
    let best = null, bd = 190;
    for (const o of Entities.enemies) {
      if (o.dead || o.state === 'mirror' || hitSet.has(o.id)) continue;
      const d = Utils.dist(srcX, srcY, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) {
      Particles.bolt(srcX, srcY, best.x, best.y, '#d8ccff', 0.18, 2.5);
      this.boltChain(best, dmg * 0.85, chainLeft - 1, hitSet);
    }
  },

  actStone(dt) {
    if (this.T('stone') > 0) return;
    const D = this.levelData('stone');
    this.timers.stone = D.cd;
    const p = Entities.player;
    for (let i = 0; i < D.count; i++) {
      const e = Entities.enemies[Math.floor(Math.random() * Entities.enemies.length)];
      if (!e || e.dead) continue;
      const tx = e.x + Utils.rand(-40, 40), ty = e.y + Utils.rand(-40, 40);
      setTimeout(() => {
        if (Game.state !== 'playing') return;
        Entities.explodeAt(tx, ty, D.dmg, D.r, 0, 0, { color: '#c8b8a0', shake: 4 });
      }, i * 90);
    }
  },

  actSpirit(dt) {
    if (this.T('spirit') > 0) return;
    const D = this.levelData('spirit');
    this.timers.spirit = D.cd;
    const p = Entities.player;
    const baseDmg = this.levelData('sword') ? this.levelData('sword').dmg : 15;
    for (let i = 0; i < D.count; i++) {
      const tgt = this.nearestEnemy(560);
      const ang0 = p.face + (i - (D.count - 1) / 2) * 0.8;
      const a = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : ang0;
      Entities.fireProj({ kind: 'spirit', owner: 'player',
        x: p.x + Math.cos(ang0) * 40, y: p.y + Math.sin(ang0) * 40,
        vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 7, dmg: baseDmg * D.pct, life: 1.2, pierce: 1, sx: p.x, sy: p.y });
    }
  },

  actBugs(dt) {
    if (this.T('bugs') > 0) return;
    const D = this.levelData('bugs');
    this.timers.bugs = D.cd;
    const p = Entities.player;
    for (let i = 0; i < D.count; i++) {
      const tgt = this.nearestEnemy(480);
      if (!tgt) break;
      const a = Utils.angle(p.x, p.y, tgt.x, tgt.y) + Utils.rand(-0.5, 0.5);
      Entities.fireProj({ kind: 'bug', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 8, dmg: D.dmg, life: 0.9, pierce: 1, sx: p.x, sy: p.y,
        showDmg: true, color: '#ffd24a' });
    }
    // 虫群涌出特效
    for (let i = 0; i < 4; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      Particles.spawn({ x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14, vx: Math.cos(a) * Utils.rand(90, 190), vy: Math.sin(a) * Utils.rand(90, 190), size: 2.5, color: '#ffe9a0', life: 0.4, drag: 0.9 });
    }
  },

  actPuppet(dt) {
    if (this.T('puppet') > 0) return;
    const D = this.levelData('puppet');
    this.timers.puppet = D.cd || 4;
    const p = Entities.player;
    for (let i = 0; i < (D.count || 1); i++) {
      const tgt = this.nearestEnemy(500);
      const a = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : p.face + Utils.rand(-1, 1);
      Entities.fireProj({ kind: 'puppet', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 12, dmg: D.dmg, life: 1.6, pierce: 4, sx: p.x, sy: p.y });
    }
  },

  // ================= 融合产物（超武） =================
  actWanjian(dt) {
    if (this.T('wanjian') > 0) return;
    const F = this.fusionData('wanjian');
    this.timers.wanjian = F.cd;
    const p = Entities.player;
    const tgt = this.nearestEnemy(600);
    const base = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : p.face;
    // 万剑齐发（扇形剑雨）+ 环形剑气
    for (let i = 0; i < F.swords; i++) {
      const a = base + (i - (F.swords - 1) / 2) * 0.30;
      Entities.fireProj({ kind: 'sword', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * F.speed, vy: Math.sin(a) * F.speed, r: 10, dmg: F.dmg, life: 1.2, pierce: 3, sx: p.x, sy: p.y });
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      Entities.fireProj({ kind: 'wave', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 12, dmg: F.dmg * 0.6, life: 0.7, pierce: 999, sx: p.x, sy: p.y });
    }
    Game.shake(3);
    AudioFX.tribSuccess();
  },

  actQingzhu(dt) {
    const F = this.fusionData('qingzhu');
    const p = Entities.player;
    // 环绕剑阵持续伤害
    for (const e of Entities.enemies) {
      if (e.dead || e.state === 'mirror') continue;
      const d = Utils.dist(p.x, p.y, e.x, e.y);
      if (d < F.r + e.r) {
        e.hp -= F.dmg * dt * 2;
        if (e.hp <= 0 && !e.dead) { e.hp = 0; Entities.damageEnemy(e, 0, { crit: false }); }
      }
    }
    // 定期蜂云剑爆发
    if (this.T('qingzhu') > 0) return;
    this.timers.qingzhu = F.cd;
    const tgt = this.nearestEnemy(600);
    const base = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : p.face;
    for (let i = 0; i < F.count; i++) {
      const a = base + (i - (F.count - 1) / 2) * 0.22;
      Entities.fireProj({ kind: 'bamboo', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, r: 9, dmg: F.dmg, life: 1.0, pierce: 3, sx: p.x, sy: p.y });
    }
  },

  actFenlei(dt) {
    if (this.T('fenlei') > 0) return;
    const F = this.fusionData('fenlei');
    this.timers.fenlei = F.cd;
    const p = Entities.player;
    // 火球群 + 连锁雷
    for (let i = 0; i < 3; i++) {
      const dens = Utils.densestPoint(Entities.enemies, p.x, p.y, 560);
      if (!dens.count) break;
      const a = Utils.angle(p.x, p.y, dens.x, dens.y);
      Entities.fireProj({ kind: 'fireball', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, r: F.r, dmg: F.dmg, life: 1.8, tx: dens.x, ty: dens.y,
        burn: 30, burnT: 3, sx: p.x, sy: p.y });
    }
    const candidates = Entities.enemies.filter(e => !e.dead && e.state !== 'mirror');
    for (let i = 0; i < F.targets && candidates.length; i++) {
      const t = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      this.boltChain(t, F.dmg * 0.8, F.chain, new Set());
    }
    Game.shake(4);
  },

  actBingfeng(dt) {
    if (this.T('bingfeng') > 0) return;
    const F = this.fusionData('bingfeng');
    this.timers.bingfeng = F.cd;
    const p = Entities.player;
    const tgt = this.nearestEnemy(600);
    const base = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : p.face;
    for (let i = 0; i < F.count; i++) {
      const a = base + (i - (F.count - 1) / 2) * 0.30;
      Entities.fireProj({ kind: 'shard', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, r: 9, dmg: F.dmg, life: 1.2, pierce: 4, sx: p.x, sy: p.y,
        slow: F.slow, slowT: F.slowT });
    }
    // 冰峰坠地
    for (let i = 0; i < 5; i++) {
      const e = Entities.enemies[Math.floor(Math.random() * Entities.enemies.length)];
      if (!e || e.dead) continue;
      const tx = e.x + Utils.rand(-60, 60), ty = e.y + Utils.rand(-60, 60);
      setTimeout(() => {
        if (Game.state !== 'playing') return;
        Entities.explodeAt(tx, ty, F.dmg * 0.8, 90, 0, 0, { color: '#a8e8ff', shake: 3 });
        for (const o of Entities.enemies) {
          if (o.dead) continue;
          if (Utils.dist(tx, ty, o.x, o.y) < 100) { o.slowT = F.slowT; o.slowPct = F.slow; }
        }
      }, i * 80);
    }
  },

  actWanling(dt) {
    if (this.T('wanling') > 0) return;
    const F = this.fusionData('wanling');
    this.timers.wanling = F.cd;
    const p = Entities.player;
    const baseDmg = this.levelData('sword') ? this.levelData('sword').dmg : 15;
    for (let i = 0; i < F.count; i++) {
      const tgt = this.nearestEnemy(600);
      const ang0 = p.face + (i - (F.count - 1) / 2) * 0.6;
      const a = tgt ? Utils.angle(p.x, p.y, tgt.x, tgt.y) : ang0;
      Entities.fireProj({ kind: 'spirit', owner: 'player',
        x: p.x + Math.cos(ang0) * 46, y: p.y + Math.sin(ang0) * 46,
        vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: 9, dmg: baseDmg * F.pct, life: 1.3, pierce: 2, sx: p.x, sy: p.y });
    }
  },

  actChongchao(dt) {
    if (this.T('chongchao') > 0) return;
    const F = this.fusionData('chongchao');
    this.timers.chongchao = F.cd;
    const p = Entities.player;
    for (let i = 0; i < F.count; i++) {
      const tgt = this.nearestEnemy(520);
      if (!tgt) break;
      const a = Utils.angle(p.x, p.y, tgt.x, tgt.y) + Utils.rand(-0.7, 0.7);
      Entities.fireProj({ kind: 'bug', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 6, dmg: F.dmg, life: 1.0, pierce: 2, sx: p.x, sy: p.y });
    }
  },
};
