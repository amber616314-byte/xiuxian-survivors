// 开发期自检脚本：config 结构 / HTML id / 融合配对（node 运行）
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cfgSrc = readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const CFG = new Function(cfgSrc + '\nreturn CFG;')();
let errs = 0;

// ---- 1. 技能结构 ----
console.log('技能总数:', Object.keys(CFG.skills).length, '(目标 20)');
for (const [id, S] of Object.entries(CFG.skills)) {
  if (S.levels.length !== S.max) { console.error(`FAIL ${id}: levels=${S.levels.length} != max=${S.max}`); errs++; }
  if (S.gainText.length !== S.max - 1) { console.error(`FAIL ${id}: gainText=${S.gainText.length} != ${S.max - 1}`); errs++; }
  if (!S.name || !S.icon) { console.error(`FAIL ${id}: 缺 name/icon`); errs++; }
  if (!S.fuse) { console.error(`FAIL ${id}: 缺 fuse 配对`); errs++; }
}
// ---- 2. 融合配对完整性 ----
console.log('融合产物:', Object.keys(CFG.fusions).length, '(目标 10)');
for (const [fid, F] of Object.entries(CFG.fusions)) {
  if (F.parts.length !== 2) { console.error(`FAIL ${fid}: parts 必须 2 个`); errs++; continue; }
  for (const p of F.parts) {
    if (!CFG.skills[p]) { console.error(`FAIL ${fid}: 部件 ${p} 不存在`); errs++; }
    else if (CFG.skills[p].fuse !== F.parts.find(x => x !== p)) {
      console.error(`FAIL ${fid}: ${p}.fuse=${CFG.skills[p].fuse} 与配对 ${F.parts.find(x => x !== p)} 不一致`); errs++;
    }
  }
  if (!F.name || !F.icon || !F.data) { console.error(`FAIL ${fid}: 缺字段`); errs++; }
}
// ---- 3. 境界体系 ----
console.log('境界:', CFG.realms.map(r => r.name + '@' + r.at + (r.breakType ? '[' + r.breakType + ']' : '')).join(' → '));
let prev = -1;
for (const r of CFG.realms) {
  if (r.at <= prev) { console.error(`FAIL 境界阈值不递增: ${r.name}@${r.at}`); errs++; }
  prev = r.at;
}
// ---- 4. Boss 时间轴 ----
const timeline = ['wolfking', 'snake', 'spider', 'heart'];
let pt = 0;
for (const t of timeline) {
  const at = CFG.boss[t].at;
  if (at <= pt) { console.error(`FAIL Boss 时间轴不递增: ${t}@${at}`); errs++; }
  pt = at;
  if (at > CFG.SURVIVE) { console.error(`FAIL Boss ${t} 出场时间超时限`); errs++; }
}
console.log('Boss 时间轴检查完成');

// ---- 5. 经验曲线里程碑 ----
const need = lv => Math.round(CFG.expBase + lv * CFG.expPerLevel);
for (const r of CFG.realms) {
  if (r.at === 0 || r.at === 999) continue;
  let acc = 0;
  for (let lv = 1; lv < r.at; lv++) acc += need(lv);
  console.log(`  ${r.name} 门槛 Lv.${r.at}：累计 ${acc} 灵气`);
}

// ---- 6. HTML id ----
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const uiSrc = readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
const btnIds = [...uiSrc.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
for (const id of btnIds) {
  if (!html.includes(`id="${id}"`)) { console.error(`FAIL: index.html 缺少 id="${id}"`); errs++; }
}
console.log(`按钮 id 引用: ${btnIds.length} 个, 全部存在`);

// ---- 7. script 顺序 ----
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
for (const s of scripts) {
  if (!readFileSync(path.join(root, s), 'utf8')) { console.error(`FAIL: ${s} 不存在`); errs++; }
}
console.log('script:', scripts.length, '个');

// ---- 8. 素材引用存在性 ----
for (const [id, S] of Object.entries(CFG.skills)) {
  const p = path.join(root, 'assets', S.icon);
  if (!readFileSync(p, 'utf8').length) { console.error(`FAIL 技能图标缺失: ${S.icon}`); errs++; }
}
for (const [fid, F] of Object.entries(CFG.fusions)) {
  const p = path.join(root, 'assets', F.icon);
  if (!readFileSync(p, 'utf8').length) { console.error(`FAIL 融合图标缺失: ${F.icon}`); errs++; }
}
console.log('技能/融合图标文件检查完成');

if (errs) { console.error(`\n共 ${errs} 个错误`); process.exit(1); }
console.log('\n=== 自检全部通过 ===');
