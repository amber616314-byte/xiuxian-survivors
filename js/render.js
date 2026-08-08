// ================= 渲染层：贴图精灵动画 / 背景 / 特效 =================
const Renderer = {
  clouds: [],       // 飘动云雾

  init() {
    this.clouds = [];
    for (let i = 0; i < 10; i++) {
      this.clouds.push({
        x: Math.random() * CFG.W, y: Utils.rand(CFG.H * 0.05, CFG.H * 0.5),
        s: Utils.rand(0.5, 1.4), sp: Utils.rand(8, 26), a: Utils.rand(0.15, 0.4), t: Utils.rand(0, 10),
      });
    }
  },

  // ---- 背景（屏幕空间，必须全屏覆盖）----
  drawBackground(ctx, cam, t) {
    const W = CFG.W, H = CFG.H;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    // 夜空底色（图片未加载时兜底）
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 100, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, '#101a30');
    g.addColorStop(0.55, '#0a1120');
    g.addColorStop(1, '#04070e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 战场背景贴图（cover 铺满）
    const key = Game.state === 'menu' ? 'bg_menu' : (Game.tribCount >= 5 ? 'bg_battle' : 'bg_battle');
    const img = Assets.img(key);
    if (img && Assets.readyImg(key)) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.globalAlpha = Game.state === 'menu' ? 0.9 : 0.75;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      // 顶部加深（HUD 可读性）
      const vg = ctx.createLinearGradient(0, 0, 0, H * 0.35);
      vg.addColorStop(0, 'rgba(4,7,14,0.72)');
      vg.addColorStop(1, 'transparent');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H * 0.35);
    }

    // 飘动云雾
    for (const c of this.clouds) {
      const img2 = Assets.img('cloud' + Math.floor(t * 0.35 + c.t) % 5);
      if (!img2 || !img2.complete) continue;
      const cw = 420 * c.s, ch = 160 * c.s;
      const cx = ((c.x + t * c.sp) % (W + cw)) - cw / 2;
      ctx.globalAlpha = c.a;
      ctx.drawImage(img2, cx, c.y, cw, ch);
      ctx.globalAlpha = 1;
    }

    // 暗角
    const vg2 = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.72);
    vg2.addColorStop(0, 'transparent');
    vg2.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },

  // 绘制精灵图（保持原图宽高比：按目标高度 h 缩放，宽度自动），可选翻转/染色
  drawSprite(ctx, key, x, y, h, flip = false, alpha = 1, filter = null) {
    const img = Assets.img(key);
    if (!img || !img.complete || img.naturalWidth === 0) return false;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const w = h * iw / ih;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (filter) ctx.filter = filter;
    if (flip) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    }
    ctx.restore();
    return true;
  },

  // ---- 玩家 ----
  drawPlayer(ctx, p, t) {
    if (p.dead) {
      // 倒地动画
      const f = Math.floor(t * 10) % 7;
      this.drawSprite(ctx, `player_defeat_${f}`, p.x, p.y + 10, 95);
      return;
    }
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 26, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.invulnT > 0 && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.5;
    const flip = p.face > Math.PI / 2 || p.face < -Math.PI / 2;

    // 选择动画帧
    let key, n = 6, fps = 8;
    if (p.hurtT > 0) { key = 'player_hit'; n = 6; }
    else if (p.dashT > 0) { key = 'player_dodge'; n = 6; fps = 14; }
    else if (p.moving) {
      // 移动：16 帧 4×4（4 方向 × 4 帧），行 = 方向
      const dirRow = Math.floor(((p.face + Math.PI * 1.25) / (Math.PI * 2) + 1) % 1 * 4) % 4;
      const f = (Math.floor(t * 10) % 4);
      key = `player_move_${dirRow * 4 + f}`;
      n = 16;
    } else {
      const f = Math.floor(t * 6) % 6;
      key = `player_stand_${f}`;
    }
    const bob = Math.sin(t * 9) * 1.6 * (p.moving ? 1 : 0.3);
    const drawn = this.drawSprite(ctx, key, p.x, p.y + bob, 100, flip);
    if (!drawn) {
      // 兜底：程序化绘制（素材未加载）
      this.drawPlayerFallback(ctx, p, t);
    }
    ctx.globalAlpha = 1;

    // 渡劫法阵（玩家脚下）
    if (Waves.trib.active) {
      const f = Math.floor(t * 12) % 14;
      this.drawSprite(ctx, `fx_sigil_${f}`, p.x, p.y + 4, 130, false, 0.8);
    }
  },

  drawPlayerFallback(ctx, p, t) {
    const bob = Math.sin(t * 9) * 1.6 * (p.moving ? 1 : 0.3);
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = '#3d6b8f';
    ctx.strokeStyle = '#1c3247';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2d8bc';
    ctx.beginPath(); ctx.arc(0, -19, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#22283a';
    ctx.beginPath(); ctx.arc(0, -27, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  // ---- 敌人（兽形妖兽 + 妖气光效）----
  drawEnemy(ctx, e, t) {
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * 0.9, e.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 妖气光环（所有妖兽）
    const auraCol = e.elite ? '255,210,74' : '150,60,200';
    const rg = ctx.createRadialGradient(e.x, e.y, e.r * 0.3, e.x, e.y, e.r * 2.1);
    rg.addColorStop(0, `rgba(${auraCol},${e.elite ? 0.32 : 0.16})`);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2.1, 0, Math.PI * 2); ctx.fill();

    // 兽形静态图 + 呼吸脉动浮动
    const bob = Math.sin(e.wob) * 3;
    const breathe = 1 + Math.sin(t * 3 + e.id) * 0.05;
    const size = e.r * 3.0 * breathe * (e.elite ? 1.3 : 1);
    const flip = false;
    const filter = e.flash > 0 ? 'brightness(2.2)' : (e.elite ? 'saturate(1.5) hue-rotate(-15deg)' : null);
    const img = Assets.img(`monster_${e.sprite}`);
    if (img && img.complete && img.naturalWidth > 0) {
      // 妖气红眼：底部红晕 + 本体
      ctx.save();
      if (filter) ctx.filter = filter;
      ctx.globalAlpha = e.flash > 0 ? 1 : 0.95;
      ctx.drawImage(img, e.x - size / 2, e.y + bob - size / 2, size, size);
      ctx.restore();
    } else {
      // 兜底：程序化圆
      ctx.fillStyle = e.color || '#8a5a4a';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff4a4a';
      ctx.beginPath(); ctx.arc(e.x - e.r * 0.35, e.y - e.r * 0.2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + e.r * 0.35, e.y - e.r * 0.2, 3, 0, Math.PI * 2); ctx.fill();
    }
    // 减速/灼烧状态光效
    if (e.slowT > 0) {
      ctx.strokeStyle = 'rgba(140,220,255,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    if (e.burnT > 0) {
      ctx.strokeStyle = 'rgba(255,140,60,0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // 血蝠蓄力警示
    if (e.dash && e.dash.state === 'windup') {
      ctx.strokeStyle = 'rgba(255,120,80,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8 + Math.sin(t * 20) * 3, 0, Math.PI * 2); ctx.stroke();
    }
    // 精英血条
    if (e.elite && e.hp < e.maxHp) {
      const w = e.r * 2.6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - w / 2, e.y - e.r * 1.9, w, 4.5);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(e.x - w / 2, e.y - e.r * 1.9, w * Utils.clamp(e.hp / e.maxHp, 0, 1), 4.5);
    }
  },

  // ---- Boss（兽形妖王 / 心魔立绘）----
  drawBoss(ctx, e, t) {
    const bob = Math.sin(t * 3 + e.id) * 4;
    const breathe = 1 + Math.sin(t * 2.5) * 0.04;
    // 旋转法阵
    ctx.save();
    ctx.translate(e.x, e.y + bob);
    ctx.strokeStyle = 'rgba(255,90,50,0.3)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(t * (0.5 + i * 0.25) + i * 2);
      ctx.beginPath();
      ctx.arc(0, 0, e.r * (1.15 + i * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 妖王威压光环
    const auraCol = e.xinsm ? '150,60,200' : '255,60,30';
    const rg = ctx.createRadialGradient(0, 0, e.r * 0.3, 0, 0, e.r * 2.6);
    rg.addColorStop(0, `rgba(${auraCol},0.32)`);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 2.6, 0, Math.PI * 2); ctx.fill();

    const size = e.r * 3.4 * breathe;
    const filter = e.flash > 0 ? 'brightness(2.2)' : (e.xinsm ? 'hue-rotate(35deg) saturate(1.5)' : 'saturate(1.25)');
    // 金丹：悬浮的金色光球 + 旋转丹纹
    if (e.jindan) {
      const pulse = 1 + Math.sin(t * 4) * 0.08;
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, size * 0.5 * pulse);
      g.addColorStop(0, '#fffbe8');
      g.addColorStop(0.4, '#ffd24a');
      g.addColorStop(0.75, 'rgba(232,160,40,0.55)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.5 * pulse, 0, Math.PI * 2); ctx.fill();
      // 旋转丹纹
      ctx.strokeStyle = 'rgba(255,240,180,0.85)';
      ctx.lineWidth = 3;
      ctx.save();
      ctx.rotate(t * 1.8);
      ctx.beginPath(); ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, size * 0.14, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.rotate(-t * 2.4);
      ctx.beginPath(); ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      // 金丹血条
      const w = size * 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-w / 2, -size * 0.62, w, 6);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(-w / 2, -size * 0.62, w * Utils.clamp(e.hp / e.maxHp, 0, 1), 6);
    } else if (e.xinsm || e.type === 'heart') {
      // 心魔：玩家 1:1 复制体（暗紫幻影）+ 玩家站立精灵帧
      const f = Math.floor(t * 6) % 6;
      const img = Assets.img(`sprites2_player_stand_${f}`);
      if (img && img.complete && img.naturalWidth > 0) {
        // 残影拖尾
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.filter = 'hue-rotate(160deg) saturate(1.8) brightness(0.7)';
        ctx.drawImage(img, -size * 0.42 + 6, -size * 0.42 + 6, size * 0.84, size * 0.84);
        ctx.restore();
        ctx.save();
        ctx.filter = e.flash > 0 ? 'brightness(2.2)' : 'hue-rotate(160deg) saturate(1.6) brightness(0.82)';
        ctx.drawImage(img, -size * 0.42, -size * 0.42, size * 0.84, size * 0.84);
        ctx.restore();
      } else {
        const portrait = Assets.img(e.type === 'heart' ? 'portrait_hero2' : 'portrait_villain1');
        if (portrait && portrait.complete && portrait.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
          ctx.clip();
          ctx.filter = e.flash > 0 ? 'brightness(2.2)' : 'hue-rotate(160deg) saturate(1.5)';
          ctx.drawImage(portrait, -size * 0.62, -size * 0.62, size * 1.24, size * 1.24);
          ctx.restore();
          ctx.strokeStyle = 'rgba(160,80,220,0.5)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, size * 0.62 + 3, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // 心魔暗紫残影光环
      ctx.strokeStyle = 'rgba(160,80,220,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.62 + 3, 0, Math.PI * 2); ctx.stroke();
    } else {
      // 兽形妖王
      const img = Assets.img(`monster_${e.sprite}`);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.filter = filter;
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.fillStyle = '#a03028';
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 蓄力警示
    if (e.state === 'windup') {
      ctx.strokeStyle = 'rgba(255,80,50,0.9)';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 12 + Math.sin(t * 20) * 4, 0, Math.PI * 2); ctx.stroke();
      if (e.chargeSpd > 0) {
        ctx.strokeStyle = 'rgba(255,120,80,0.5)';
        ctx.lineWidth = 6;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(e.chargeAng) * 320, Math.sin(e.chargeAng) * 320);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  },

  // ---- 弹幕 ----
  drawProjectiles(ctx, t) {
    for (const pr of Entities.projectiles) {
      if (pr.owner === 'player') {
        const f = Math.floor(t * 16) % 12;
        switch (pr.kind) {
          case 'sword': {
            const a = Math.atan2(pr.vy, pr.vx);
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(a);
            const img = Assets.img(`fx_sword_${f}`);
            if (img && img.complete) ctx.drawImage(img, -22, -14, 44, 28);
            else {
              ctx.fillStyle = '#e8f4ff';
              ctx.shadowColor = '#9fd8ff'; ctx.shadowBlur = 10;
              ctx.fillRect(-16, -2.5, 30, 5);
              ctx.shadowBlur = 0;
            }
            ctx.restore();
            break;
          }
          case 'wave': {
            const f2 = Math.floor(t * 16) % 11;
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(Math.atan2(pr.vy, pr.vx));
            const img = Assets.img(`fx_wind_${f2}`);
            if (img && img.complete) ctx.drawImage(img, -30, -16, 60, 32);
            else {
              ctx.strokeStyle = '#c8d8ff';
              ctx.lineWidth = 5;
              ctx.beginPath(); ctx.arc(0, 0, 16, -0.7, 0.7); ctx.stroke();
            }
            ctx.restore();
            break;
          }
          case 'fireball': {
            const f3 = Math.floor(t * 20) % 13;
            ctx.save();
            ctx.translate(pr.x, pr.y);
            const img = Assets.img(`fx_fireball_${f3}`);
            if (img && img.complete) ctx.drawImage(img, -30, -30, 60, 60);
            else {
              const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
              g.addColorStop(0, '#fff8e0'); g.addColorStop(0.4, '#ffab5a'); g.addColorStop(1, 'rgba(255,90,30,0.25)');
              ctx.fillStyle = g;
              ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            break;
          }
          case 'shard': {
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(Math.atan2(pr.vy, pr.vx));
            ctx.fillStyle = '#c8f0ff';
            ctx.shadowColor = '#7ec8ff'; ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(-10, -5); ctx.lineTo(4, 0); ctx.lineTo(-10, 5);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
            break;
          }
          case 'bamboo':
          case 'spirit': {
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(Math.atan2(pr.vy, pr.vx) + Math.PI / 4);
            ctx.fillStyle = pr.kind === 'bamboo' ? '#a8e8a0' : '#c8e8ff';
            ctx.shadowColor = '#7ec8ff'; ctx.shadowBlur = 8;
            ctx.fillRect(-2, -12, 4, 22);
            ctx.shadowBlur = 0;
            ctx.restore();
            break;
          }
          case 'puppet': {
            const f4 = Math.floor(t * 12) % 10;
            const img = Assets.img(`fx_curse_${f4}`);
            ctx.save();
            ctx.translate(pr.x, pr.y);
            if (img && img.complete) ctx.drawImage(img, -20, -20, 40, 40);
            else { ctx.fillStyle = '#b06adf'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
            break;
          }
          case 'bug': {
            // 噬金虫：金色甲虫 + 扇动翅膀 + 拖尾光点
            const flap = Math.sin(t * 40 + pr.x * 0.05) * 0.6;
            const a = Math.atan2(pr.vy, pr.vx);
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(a);
            // 翅膀（两侧半透明椭圆，扇动）
            ctx.fillStyle = `rgba(255,230,150,${0.55 + flap * 0.3})`;
            ctx.beginPath(); ctx.ellipse(-3, -5 - flap * 2, 4, 2.6, -0.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-3, 5 + flap * 2, 4, 2.6, 0.5, 0, Math.PI * 2); ctx.fill();
            // 虫身
            ctx.fillStyle = '#ffe9a0';
            ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 3.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#c8862a';
            ctx.beginPath(); ctx.arc(-2, 0, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // 拖尾
            if (Math.random() < 0.3) {
              Particles.spawn({ x: pr.x - Math.cos(a) * 4, y: pr.y - Math.sin(a) * 4, vx: Utils.rand(-20, 20), vy: Utils.rand(-20, 20), size: 2, color: '#ffd24a', life: 0.25, drag: 0.9, alpha: 0.6 });
            }
            break;
          }
        }
      } else {
        // 敌方弹幕：心魔复制的玩家神通 → 暗紫版（一眼可辨）
        const a2 = Math.atan2(pr.vy, pr.vx);
        switch (pr.kind) {
          case 'sword': {
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(a2);
            ctx.fillStyle = '#d8b0ff';
            ctx.shadowColor = '#a060e0'; ctx.shadowBlur = 10;
            ctx.fillRect(-16, -2.5, 30, 5);
            ctx.shadowBlur = 0;
            ctx.restore();
            break;
          }
          case 'wave': {
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.strokeStyle = '#c88adf';
            ctx.lineWidth = 5;
            ctx.shadowColor = '#a060e0'; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(0, 0, 14, -0.7, 0.7); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
            break;
          }
          case 'fireball': {
            ctx.save();
            ctx.translate(pr.x, pr.y);
            const g3 = ctx.createRadialGradient(0, 0, 1, 0, 0, 13);
            g3.addColorStop(0, '#ffe0f0'); g3.addColorStop(0.4, '#e08ae0'); g3.addColorStop(1, 'rgba(160,40,200,0.25)');
            ctx.fillStyle = g3;
            ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            break;
          }
          case 'shard': {
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(a2);
            ctx.fillStyle = '#d8b8ff';
            ctx.shadowColor = '#a060e0'; ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(-10, -5); ctx.lineTo(4, 0); ctx.lineTo(-10, 5);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
            break;
          }
          case 'bamboo':
          case 'spirit': {
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(a2 + Math.PI / 4);
            ctx.fillStyle = '#c898e8';
            ctx.shadowColor = '#a060e0'; ctx.shadowBlur = 8;
            ctx.fillRect(-2, -12, 4, 22);
            ctx.shadowBlur = 0;
            ctx.restore();
            break;
          }
          case 'bug': {
            ctx.fillStyle = '#e0b0ff';
            ctx.shadowColor = '#a060e0'; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(pr.x, pr.y, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            break;
          }
          case 'web': {
            ctx.strokeStyle = 'rgba(230,230,255,0.85)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(pr.x, pr.y, 9, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pr.x - 7, pr.y); ctx.lineTo(pr.x + 7, pr.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pr.x, pr.y - 7); ctx.lineTo(pr.x, pr.y + 7); ctx.stroke();
            break;
          }
          case 'nova': {
            // 必杀新星弹：紫色妖核 + 旋转符文环（剑阵不可挡）
            const pulse = 1 + Math.sin(t * 10) * 0.15;
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(t * 6);
            const g2 = ctx.createRadialGradient(0, 0, 1, 0, 0, 16 * pulse);
            g2.addColorStop(0, '#fff');
            g2.addColorStop(0.4, '#e08ae0');
            g2.addColorStop(1, 'rgba(192,64,255,0.35)');
            ctx.fillStyle = g2;
            ctx.beginPath(); ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,160,255,0.8)';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(-11, -11, 22, 22);
            ctx.restore();
            break;
          }
          default: {
            const f5 = Math.floor(t * 10) % 19;
            const img = Assets.img(`fx_poison_${f5}`);
            ctx.save();
            ctx.translate(pr.x, pr.y);
            if (img && img.complete && pr.kind !== 'orb') ctx.drawImage(img, -16, -16, 32, 32);
            else {
              ctx.fillStyle = pr.color;
              ctx.shadowColor = pr.color; ctx.shadowBlur = 10;
              ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.7, 0, Math.PI * 2); ctx.fill();
              ctx.shadowBlur = 0;
            }
            ctx.restore();
            break;
          }
        }
      }
    }
  },

  // ---- 灵气珠 ----
  drawOrbs(ctx, t) {
    for (const o of Entities.orbs) {
      const pulse = 1 + Math.sin(o.t * 5) * 0.22;
      const r = CFG.orb.radius * pulse;
      const c = o.heal ? '111,217,165' : '126,232,250';
      const g = ctx.createRadialGradient(o.x, o.y, 0.5, o.x, o.y, r * 3);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, `rgba(${c},0.9)`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(o.x, o.y, r * 3, 0, Math.PI * 2); ctx.fill();
    }
  },

  // ---- 决战结界（天罡困阵）----
  drawArena(ctx, t) {
    const a = Entities.arena;
    if (!a) return;
    a.t += 1 / 60;
    const { x, y, w, h } = a;
    const pulse = 0.75 + Math.sin(t * 3) * 0.25;
    ctx.save();
    // 顶部半透明罩
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y);
    g.addColorStop(0, `rgba(255,210,74,${0.10 * pulse})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y - h / 2, w, h / 2);
    // 四边金色光柱
    ctx.lineWidth = 6;
    ctx.strokeStyle = `rgba(255,210,74,${0.55 + 0.3 * Math.sin(t * 4)})`;
    ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 18;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.shadowBlur = 0;
    // 内层符文细线（缓慢旋转）
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.12);
    ctx.strokeStyle = 'rgba(255,190,60,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 18, -h / 2 + 18, w - 36, h - 36);
    ctx.rotate(t * 0.18);
    ctx.strokeStyle = 'rgba(255,220,120,0.22)';
    ctx.strokeRect(-w / 2 + 40, -h / 2 + 40, w - 80, h - 80);
    ctx.restore();
    // 角落灵气符箓
    const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]];
    for (let i = 0; i < 4; i++) {
      const cx = x + corners[i][0], cy = y + corners[i][1];
      ctx.fillStyle = `rgba(255,220,120,${0.5 + 0.4 * Math.sin(t * 6 + i * 1.7)})`;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
      Particles.spawn({
        x: cx + Utils.rand(-10, 10), y: cy + Utils.rand(-10, 10),
        vx: Utils.rand(-16, 16), vy: Utils.rand(-16, 16),
        size: Utils.rand(1.5, 3), color: '#ffe9a0', life: Utils.rand(0.5, 0.9), drag: 0.96, alpha: 0.6,
      });
    }
    ctx.restore();
  },

  // ---- 剑阵（诛仙剑阵/青竹诛仙阵）----
  drawAura(ctx, t) {
    const lv = SkillSystem.lv('aura');
    const fused = SkillSystem.hasFusion('qingzhu');
    const p = Entities.player;
    if (!p) return;
    if (fused) {
      // 融合版：双环剑阵
      const F = CFG.fusions.qingzhu.data;
      for (let i = 0; i < F.blades; i++) {
        const a = SkillSystem.auraAngle + (i / F.blades) * Math.PI * 2;
        const bx = p.x + Math.cos(a) * F.r;
        const by = p.y + Math.sin(a) * F.r;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + Math.PI / 2);
        const img = Assets.img(`fx_sword_${Math.floor(t * 14) % 12}`);
        if (img && img.complete) ctx.drawImage(img, -20, -12, 40, 26);
        else {
          ctx.fillStyle = '#ffe9a0';
          ctx.shadowColor = '#e8c15a'; ctx.shadowBlur = 12;
          ctx.fillRect(-2.2, -12, 4.4, 19);
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }
      return;
    }
    if (!lv) return;
    const D = SkillSystem.levelData('aura');
    for (let i = 0; i < D.blades; i++) {
      const a = SkillSystem.auraAngle + (i / D.blades) * Math.PI * 2;
      const bx = p.x + Math.cos(a) * D.r;
      const by = p.y + Math.sin(a) * D.r;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#ffe9a0';
      ctx.shadowColor = '#e8c15a'; ctx.shadowBlur = 12;
      ctx.fillRect(-2.2, -12, 4.4, 19);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  },

  // ---- 剑灵 / 傀儡（召唤物环绕）----
  drawSpirits(ctx, t) {
    const p = Entities.player;
    if (!p) return;
    const lv = SkillSystem.lv('spirit');
    const puppetLv = SkillSystem.lv('puppet');
    const wanling = SkillSystem.hasFusion('wanling');
    const n = wanling ? 5 : ((lv || 0) + (puppetLv || 0));
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const a = SkillSystem.spiritAngle + (i / n) * Math.PI * 2;
      const sx = p.x + Math.cos(a) * 46;
      const sy = p.y + Math.sin(a) * 46;
      const f = Math.floor(t * 10 + i) % 10;
      const img = Assets.img(`fx_curse_${f}`);
      ctx.save();
      ctx.globalAlpha = 0.8;
      if (img && img.complete) ctx.drawImage(img, sx - 14, sy - 14, 28, 28);
      else {
        const g = ctx.createRadialGradient(sx, sy, 1, sx, sy, 12);
        g.addColorStop(0, 'rgba(200,232,255,0.9)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  },

  // ---- 渡劫特效 ----
  drawTrib(ctx, t) {
    const T = Waves.trib;
    if (!T.active) return;
    for (const w of T.warning) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 22);
      ctx.strokeStyle = `rgba(200,180,255,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(w.x, w.y, 60, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,180,255,0.3)';
      ctx.beginPath(); ctx.arc(w.x, w.y, 78, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(180,160,255,0.14)';
      ctx.beginPath(); ctx.arc(w.x, w.y, 60, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of T.bolts) {
      const f = Math.floor(t * 24) % 16;
      const img = Assets.img(`fx_lightning_${f}`);
      ctx.save();
      ctx.translate(b.x, b.y);
      if (img && img.complete) ctx.drawImage(img, -30, -240, 60, 260);
      else {
        const g = ctx.createLinearGradient(0, -260, 0, 0);
        g.addColorStop(0, 'transparent');
        g.addColorStop(1, 'rgba(220,210,255,0.9)');
        ctx.fillStyle = g;
        ctx.fillRect(-10, -260, 20, 260);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 22, 0, Math.PI * 2); ctx.fill();
    }
  },
};
