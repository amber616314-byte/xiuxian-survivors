// 模拟测试：mock DOM/Canvas，驱动 Game.frame 实跑 200 秒，抓运行时错误与数值节奏
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');

// ---- mock DOM ----
const fakeEl = () => {
  const classes = new Set();
  const el = {
    classList: {
      add(...cs) { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      toggle(c, force) { const on = force === undefined ? !classes.has(c) : !!force; on ? classes.add(c) : classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
    style: {}, dataset: {}, children: [],
    textContent: '', innerHTML: '',
    offsetWidth: 0, clientWidth: 0,
    width: 1600, height: 900,
    getContext: () => ctxProxy,
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return fakeEl(); },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
  return el;
};
const ctxProxy = new Proxy({}, {
  get(t, k) {
    if (typeof k === 'symbol') return undefined;
    if (k === 'measureText') return () => ({ width: 10 });
    if (['createRadialGradient', 'createLinearGradient'].includes(k)) return () => ({ addColorStop() {} });
    if (['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign', 'textBaseline', 'shadowColor', 'shadowBlur', 'lineCap', 'lineJoin', 'filter'].includes(k)) return t[k] ?? '';
    if (k === 'canvas') return { width: 1600, height: 900 };
    if (k in t) return t[k];
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; },
});
const fakeCanvas = { width: 1600, height: 900, style: {}, getContext: () => ctxProxy };

const store = {};
// getElementById 返回同一 id 的稳定实例（便于断言 DOM 状态）
const elCache = new Map();
const docEl = id => {
  if (!elCache.has(id)) elCache.set(id, fakeEl());
  return elCache.get(id);
};
const sandbox = {
  console, Math, JSON, Date, Set, Map, Promise, Uint8Array, ArrayBuffer,
  // 同步化定时器（模拟主循环是同步 for 循环，真实 setTimeout 会堆积到结束后执行导致测试巨慢）
  setTimeout: fn => { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  performance: { now: () => Date.now() },
  requestAnimationFrame() {},
  window: {
    addEventListener() {}, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
    AudioContext: undefined, webkitAudioContext: undefined,
  },
  Image: class {
    constructor() { this.complete = false; this.naturalWidth = 0; this.onload = null; this.onerror = null; }
    set src(v) { this.complete = true; this.naturalWidth = 128; this.naturalHeight = 128; if (this.onload) this.onload(); }
    get src() { return ''; }
  },
  document: {
    getElementById: docEl,
    createElement: () => fakeEl(),
    querySelector: () => fakeEl(),
    addEventListener() {},
    fonts: { load: async () => {} },
  },
  localStorage: {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
};
vm.createContext(sandbox);

// ---- 加载全部 JS ----
const files = ['config.js', 'assets.js', 'utils.js', 'audio.js', 'input.js', 'particles.js', 'entities.js', 'skills.js', 'waves.js', 'render.js', 'ui.js', 'game.js', 'main.js'];
for (const f of files) {
  const src = readFileSync(path.join(root, 'js', f), 'utf8');
  try { vm.runInContext(src, sandbox, { filename: f }); }
  catch (e) { console.error(`加载失败 ${f}:`, e.message); process.exit(1); }
}
console.log('全部文件加载成功');

// const 声明在 vm 中为词法作用域，显式导出引用
vm.runInContext(`
  globalThis.__export = { Game, Entities, SkillSystem, Particles, Input };
`, sandbox);
const { Game, Entities, SkillSystem, Particles, Input } = sandbox.__export;
Game.init();
Game.start();   // 直接进入游戏局

// ---- 驱动模拟 ----
const errors = [];
const dt = 1 / 60;
const DUR = parseInt(process.env.TEST_DUR || '850', 10);
let maxEnemies = 0, maxProj = 0, maxOrbs = 0, maxParticles = 0;
let choices = 0;
let tSim = 0;
const frameCosts = [];
const t0 = Date.now();

for (let i = 0; i < DUR * 60; i++) {
  const f0 = Date.now();
  tSim += dt;
  // 模拟走位：SIM_STAND=1 时站桩（验证死亡流程）
  const p = Entities.player;
  const b = Entities.boss;
  let kx, ky;
  if (process.env.SIM_STAND === '1') { kx = 0; ky = 0; }
  else if (b && p) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d > 130) { kx = (b.x - p.x) / d; ky = (b.y - p.y) / d; }
    else { kx = 0; ky = 0; }
  } else {
    kx = Math.cos(tSim * 0.7); ky = Math.sin(tSim * 0.9);
  }
  Input.keys.clear();
  if (kx > 0.3) Input.keys.add('d'); else if (kx < -0.3) Input.keys.add('a');
  if (ky > 0.3) Input.keys.add('s'); else if (ky < -0.3) Input.keys.add('w');

  try {
    Game.frame(dt);
  } catch (e) {
    errors.push(`帧 ${i} (t=${tSim.toFixed(1)}s): ${e.message}\n${e.stack.split('\n').slice(0, 4).join('\n')}`);
    if (errors.length > 5) break;
  }

  // 自动处理升级选择
  if (Game.state === 'levelup') {
    const choicesArr = SkillSystem.getChoices();
    if (choicesArr.length) { Game.chooseSkill(choicesArr[0]); choices++; }
  }
  // 断言：playing 状态下升级界面必须已关闭（防止遮罩残留导致点击无响应）
  const luEl = elCache.get('levelup');
  if (Game.state === 'playing' && luEl && luEl.classList.contains('hidden') === false) {
    errors.push(`帧 ${i} (t=${tSim.toFixed(1)}s): 升级界面残留未关闭（state=playing 但 levelup 遮罩可见）—— 选择后必须立即关闭`);
    break;
  }
  // 断言：Boss 在场必有决战结界（金丹光球除外）；结界开启时玩家与 Boss 都在结界内
  if (Entities.boss && Entities.boss.type !== 'jindan') {
    if (!Entities.arena) {
      errors.push(`帧 ${i} (t=${tSim.toFixed(1)}s): Boss ${Entities.boss.type} 在场但结界未生成`);
      break;
    }
    const a = Entities.arena, pl = Entities.player, b = Entities.boss;
    const pRadius = 20;   // CFG.player.radius（沙箱外不可见，用常量）
    const inA = (x, y, r) => x >= a.x - a.w / 2 + r - 1 && x <= a.x + a.w / 2 - r + 1 && y >= a.y - a.h / 2 + r - 1 && y <= a.y + a.h / 2 - r + 1;
    if (!inA(pl.x, pl.y, pRadius)) {
      errors.push(`帧 ${i} (t=${tSim.toFixed(1)}s): 玩家在结界外 (${pl.x.toFixed(0)},${pl.y.toFixed(0)}) vs 结界 ${a.x.toFixed(0)},${a.y.toFixed(0)},${a.w},${a.h}`);
      break;
    }
    if (b.type !== 'jindan' && b.state === 'fight' && !inA(b.x, b.y, b.r)) {
      errors.push(`帧 ${i} (t=${tSim.toFixed(1)}s): Boss ${b.type} 在结界外`);
      break;
    }
  } else if (Entities.arena) {
    errors.push(`帧 ${i} (t=${tSim.toFixed(1)}s): Boss 已死但结界未破碎`);
    break;
  }
  // 断言：敌方必杀弹（nova）不可被剑阵格挡（blockable=false）
  for (const pr of Entities.projectiles) {
    if (pr.owner === 'enemy' && pr.kind === 'nova' && pr.blockable) {
      errors.push(`帧 ${i}: nova 必杀弹必须 blockable=false`);
      break;
    }
  }
  // 断言：元婴心魔是玩家 1:1 复制体（mimic 技能表非空）
  if (Entities.boss && Entities.boss.type === 'xinsm') {
    const b = Entities.boss;
    if (!b.mimic || !b.mimic.skills || !b.mimic.skills.length) {
      errors.push(`帧 ${i} (t=${tSim.toFixed(1)}s): 心魔未复制玩家技能`);
      break;
    }
    if (b.state === 'fight') {
      // 5 秒窗口内至少出现过一次敌方弹幕（避免瞬时为 0 误报）
      if (Entities.projectiles.some(pr => pr.owner === 'enemy')) b._sawEp = true;
      if (i % 300 === 0) {
        if (!b._sawEp) {
          errors.push(`帧 ${i} (t=${tSim.toFixed(1)}s): 心魔 fight 中 5 秒内无敌方弹幕（技能未生效）`);
          break;
        }
        b._sawEp = false;
      }
    }
  }
  // 玩家保命（聚焦逻辑节奏而非死亡）；NO_HEAL=1 时验证死亡流程
  const noHeal = process.env.NO_HEAL === '1';
  if (!noHeal && Entities.player) Entities.player.hp = Entities.player.maxHp;

  // 心魔战诊断（NO_HEAL 时关闭）
  if (!noHeal && Entities.boss && Entities.boss.type === 'heart' && i % 120 === 0) {
    const b = Entities.boss;
    console.log(`[heart ${tSim.toFixed(1)}s] hp=${Math.round(b.hp)} state=${b.state} 弹幕=${Entities.projectiles.length} 玩家弹幕=${Entities.projectiles.filter(p => p.owner === 'player').length}`);
  }
  // 心魔复制体诊断：首次 fight 时打印 1:1 技能表
  if (!noHeal && Entities.boss && Entities.boss.type === 'xinsm' && Entities.boss.state === 'fight' && !Entities.boss._mimicLogged) {
    Entities.boss._mimicLogged = true;
    console.log(`[xinsm ${tSim.toFixed(1)}s] 1:1复制技能表: [${Entities.boss.mimic.skills.join(', ')}] hp=${Math.round(Entities.boss.hp)} speed=${Entities.boss.speed.toFixed(0)}`);
  }

  maxEnemies = Math.max(maxEnemies, Entities.enemies.length);
  maxProj = Math.max(maxProj, Entities.projectiles.length);
  maxOrbs = Math.max(maxOrbs, Entities.orbs.length);
  maxParticles = Math.max(maxParticles, Particles.active.length);

  if (i % 1200 === 0 && Entities.player) {
    console.log(`[${tSim.toFixed(0)}s] Lv.${Entities.player.level} 境界:${Entities.realmName()} 斩妖:${Entities.kills} 敌:${Entities.enemies.length} 弹:${Entities.projectiles.length} 珠:${Entities.orbs.length} 粒:${Particles.active.length} 帧耗:${(frameCosts.reduce((a, b) => a + b, 0) / Math.max(1, frameCosts.length)).toFixed(2)}ms`);
    frameCosts.length = 0;
  }
  frameCosts.push(Date.now() - f0);
}

const p = Entities.player;
console.log('\n===== 模拟结果 =====');
console.log(`模拟时长: ${tSim.toFixed(0)}s / ${DUR}s`);
console.log(`等级: ${p.level}  境界: ${Entities.realmName()} (idx ${Entities.realmIndex()})`);
console.log(`斩妖: ${Entities.kills}  伤害输出: ${Math.round(Entities.damageDealt)}`);
console.log(`渡劫次数: ${Game.tribCount}  升级三选一次数: ${choices}  积压升级: ${Game.pendingLevelUps.length}`);
console.log(`三千年雷劫: active=${vm.runInContext('Waves.millennium.active', sandbox)} level=${vm.runInContext('Waves.millennium.level', sandbox)} 已触发 ${vm.runInContext('Waves.millennium.level', sandbox)} 次`);
console.log(`峰值: 敌人 ${maxEnemies}/230  弹幕 ${maxProj}  灵气珠 ${maxOrbs}/320  粒子 ${maxParticles}`);
console.log(`Boss: ${Entities.boss ? Entities.boss.type + ' 存活中 hp=' + Math.round(Entities.boss.hp) : '无'}  lastBossIdx=${sandbox.__export ? '' : ''}${vm.runInContext('Waves.lastBossIdx', sandbox)}  Game.time=${Game.time.toFixed(1)}`);
console.log(`bossQueue: ${JSON.stringify(vm.runInContext('Waves.bossQueue', sandbox))}`);
console.log(`技能: ${Object.entries(SkillSystem.owned).map(([k, v]) => k + ':' + v).join(' ')}`);
console.log(`状态: ${Game.state}`);
if (errors.length) {
  console.log(`\n⚠️ 运行时错误 ${errors.length} 个:`);
  for (const e of errors) console.log(' -', e);
  process.exit(1);
} else {
  console.log('\n✅ 200 秒模拟无运行时错误');
}
