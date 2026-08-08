// ================= 工具函数 =================
const Utils = {
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(Utils.rand(a, b + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.hypot(dx, dy); },
  angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
  fmtTime(s) {
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s / 60), ss = s % 60;
    return `${m}:${ss < 10 ? '0' : ''}${ss}`;
  },
  // 获取屏幕外一点的刷新位置（围绕视口边缘，带抖动打散队列）
  spawnPos(cam, W, H, margin = 80) {
    const side = Utils.randInt(0, 3);
    const jitter = 150;   // 沿边缘方向的随机抖动，避免敌人排成整齐长队
    let x, y;
    if (side === 0) { x = cam.x + Utils.rand(-W / 2 - margin, W / 2 + margin); y = cam.y - H / 2 - margin + Utils.rand(-jitter, jitter); }
    else if (side === 1) { x = cam.x + W / 2 + margin + Utils.rand(-jitter, jitter); y = cam.y + Utils.rand(-H / 2 - margin, H / 2 + margin); }
    else if (side === 2) { x = cam.x + Utils.rand(-W / 2 - margin, W / 2 + margin); y = cam.y + H / 2 + margin + Utils.rand(-jitter, jitter); }
    else { x = cam.x - W / 2 - margin + Utils.rand(-jitter, jitter); y = cam.y + Utils.rand(-H / 2 - margin, H / 2 + margin); }
    return { x, y };
  },
  // 找敌人最密集点（用于火球）
  densestPoint(enemies, px, py, range = 520) {
    if (!enemies.length) return { x: px, y: py, count: 0 };
    let best = null, bestN = 0;
    for (let i = 0; i < 14; i++) {
      const e = enemies[Math.floor(Math.random() * enemies.length)];
      const d = Utils.dist(px, py, e.x, e.y);
      if (d > range) continue;
      let n = 0;
      for (const o of enemies) if (Utils.dist(e.x, e.y, o.x, o.y) < 180) n++;
      if (n > bestN) { bestN = n; best = e; }
    }
    return best ? { x: best.x, y: best.y, count: bestN } : { x: px, y: py, count: 0 };
  },
  // 简易存储（file:// 下 localStorage 可能不可用）
  store: {
    data: null,
    load() {
      try {
        const raw = localStorage.getItem('xiuxian-survivors');
        this.data = raw ? JSON.parse(raw) : {};
      } catch (e) { this.data = {}; }
      return this.data;
    },
    save() {
      try { localStorage.setItem('xiuxian-survivors', JSON.stringify(this.data)); } catch (e) {}
    },
    get(k, d) { return this.data[k] ?? d; },
    set(k, v) { this.data[k] = v; this.save(); },
  },
  // 缓动
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInCubic(t) { return t * t * t; },
  // 文字描边绘制辅助（canvas）
  text(ctx, str, x, y, size, color, align = 'center', stroke = 'rgba(0,0,0,.85)') {
    ctx.font = `${size}px 'LXGW WenKai', 'KaiTi', sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = Math.max(2, size / 9); ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },
};
