// ================= 入口 =================
window.addEventListener('DOMContentLoaded', () => {
  Game.init();
  // 预加载字体（确保 canvas 文本用上霞鹜文楷）
  try {
    document.fonts && document.fonts.load('20px "LXGW WenKai"').catch(() => {});
  } catch (e) {}
});
