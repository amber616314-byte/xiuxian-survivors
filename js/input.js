// ================= 输入管理 =================
const Input = {
  keys: new Set(),
  pressed: new Set(),   // 本帧按下（用于一次性事件）
  mouse: { x: 0, y: 0, down: false },

  init() {
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) || k === ' ') e.preventDefault();
      if (!e.repeat) this.pressed.add(k);
      this.keys.add(k);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', e => { this.mouse.down = true; });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    document.addEventListener('contextmenu', e => e.preventDefault());
  },
  down(...names) { return names.some(n => this.keys.has(n)); },
  justPressed(...names) { return names.some(n => this.pressed.has(n)); },
  axis() {
    let x = 0, y = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) y -= 1;
    if (this.down('s', 'arrowdown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  },
  endFrame() { this.pressed.clear(); },
};
