// ================= 粒子系统（对象池） =================
const Particles = {
  pool: [], active: [], maxPool: 900,
  textCount: 0,   // 当前飘字数（避免每帧 filter 遍历）
  absorb: [],

  get() { return this.pool.pop() || {}; },
  spawn(o) {
    if (this.active.length >= 1500) return null;   // 性能保护
    if (o.type === 'text') {
      if (this.textCount > 26) return null;
      this.textCount++;
    }
    const p = this.get();
    Object.assign(p, o);
    p.life = o.life ?? 0.6;
    p.maxLife = p.life;
    p.x = o.x; p.y = o.y;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0;
    p.size = o.size ?? 4;
    p.color = o.color ?? '#fff';
    p.type = o.type ?? 'dot';
    p.drag = o.drag ?? 0.9;
    p.grav = o.grav ?? 0;
    p.alpha = o.alpha ?? 1;
    p.data = o.data ?? null;
    this.active.push(p);
    return p;
  },

  // 便捷生成器
  burst(x, y, color, n, speed, size = 4, life = 0.5, type = 'dot') {
    n = Math.min(n, 40);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Utils.rand(speed * 0.3, speed);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: Utils.rand(size * 0.6, size), color, life: Utils.rand(life * 0.6, life), type, drag: 0.86 });
    }
  },
  ring(x, y, color, size = 20, life = 0.4, width = 5) {
    this.spawn({ x, y, type: 'ring', color, size, life, width });
  },
  text(x, y, str, color = '#ffe9a0', size = 20, life = 0.9) {
    this.spawn({ x, y, type: 'text', text: str, color, size, life, vy: -70 });
  },
  slash(x, y, angle, len, color, life = 0.18) {
    this.spawn({ x, y, type: 'slash', angle, len, color, life });
  },
  bolt(x1, y1, x2, y2, color = '#e8dcff', life = 0.22, width = 3) {
    this.spawn({ x: x1, y: y1, type: 'bolt', x2, y2, color, life, width });
  },
  light(x, y, color, life = 0.25) {
    this.spawn({ x, y, type: 'light', color, life, size: 1 });
  },

  update(dt) {
    const act = this.active;
    for (let i = act.length - 1; i >= 0; i--) {
      const p = act[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.type === 'text') this.textCount--;
        act.splice(i, 1);
        this.pool.push(p);
        if (this.pool.length > this.maxPool) this.pool.length = this.maxPool;
        continue;
      }
      const drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag; p.vy *= drag;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'ring') p.size += 260 * dt;
      if (p.type === 'light') p.size += 40 * dt;
    }
  },

  draw(ctx) {
    const act = this.active;
    for (let i = 0; i < act.length; i++) {
      const p = act[i];
      const t = p.life / p.maxLife;
      ctx.globalAlpha = p.alpha * (t < 0.3 ? t / 0.3 : 1);
      switch (p.type) {
        case 'dot': {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'ring': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width * t + 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'slash': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 6 * t + 1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          const c = Math.cos(p.angle), s = Math.sin(p.angle);
          ctx.moveTo(p.x - c * p.len / 2, p.y - s * p.len / 2);
          ctx.lineTo(p.x + c * p.len / 2, p.y + s * p.len / 2);
          ctx.stroke();
          break;
        }
        case 'bolt': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width * t + 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          const seg = 5;
          let cx = p.x, cy = p.y;
          for (let sgi = 1; sgi <= seg; sgi++) {
            const nx = p.x + (p.x2 - p.x) * sgi / seg;
            const ny = p.y + (p.y2 - p.y) * sgi / seg;
            const off = sgi < seg ? Utils.rand(-8, 8) : 0;
            ctx.lineTo(nx + off, ny + off);
          }
          ctx.stroke();
          break;
        }
        case 'text': {
          Utils.text(ctx, p.text, p.x, p.y, p.size, p.color);
          break;
        }
        case 'light': {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  },
};
