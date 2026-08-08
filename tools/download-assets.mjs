// 从 hetu-script/heavenly-tribulation (MIT) 批量下载仙侠素材
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/hetu-script/heavenly-tribulation/master/';
const OUT = path.resolve(import.meta.dirname, '..', 'assets', 'images');

// [远程路径, 本地文件名（保留相对结构）]
const FILES = [
  // ---- 玩家：男修士通用动作 ----
  ...['stand', 'attack_sword', 'attack_spell', 'attack_spell_recovery', 'dodge', 'hit', 'recovery', 'startup', 'defeat', 'buff_sword', 'tilemap_moving_animation'].map(n => [`assets/images/animation/characterManGeneral/${n}.png`, `player/${n}.png`]),
  // ---- 敌人：梵族修士（3 色 = 3 种敌人；costume3 精英；costume5 Boss）----
  ['assets/images/animation/character/battle_female_fanzu_costume1_color1.png', 'enemy/fanzu1.png'],
  ['assets/images/animation/character/battle_female_fanzu_costume1_color2.png', 'enemy/fanzu2.png'],
  ['assets/images/animation/character/battle_female_fanzu_costume1_color3.png', 'enemy/fanzu3.png'],
  ['assets/images/animation/character/battle_female_fanzu_costume3_color1.png', 'enemy/fanzu_elite.png'],
  ['assets/images/animation/character/battle_female_fanzu_costume5_color1.png', 'enemy/fanzu_boss.png'],
  // 飞剑弹幕
  ['assets/images/animation/flying_sword.png', 'fx/flying_sword.png'],
  ['assets/images/animation/flying_sword_recover.png', 'fx/flying_sword_recover.png'],
  // ---- 技能特效 overlay ----
  ...['curse', 'falling_stone', 'fireball', 'flying_sword', 'lightning', 'poison', 'restore_life', 'restore_mana', 'sigil', 'sigil_buff', 'swamp', 'wind_blade', 'wind_buff', 'wood_buff'].map(n => [`assets/images/animation/overlay/${n}.png`, `fx/${n}.png`]),
  // ---- 技能图标（招式图）----
  ...['sword_attack', 'sword_defend', 'spellcraft_fire_attack', 'spellcraft_lightning_attack', 'spellcraft_earth_attack', 'spellcraft_wind_attack', 'spellcraft_water', 'spellcraft_wood_defend', 'swordcraft_flying_sword_attack', 'swordcraft_flying_sword_defend', 'talisman', 'scroll', 'xinfa', 'swordcraft_xinfa', 'bodyforge_xinfa', 'spellcraft_xinfa', 'vitality_xinfa', 'punch_attack', 'kick_attack', 'staff_attack', 'spear_attack', 'sabre_attack', 'dart_attack', 'bow_attack', 'quick', 'nimble', 'uniquecard_draw', 'array', 'avatar_sigil_attack', 'avatar_scripture_attack', 'bodyforge_dianxue', 'bodyforge_qinggong', 'bodyforge_qinna', 'spellcraft_nimble', 'vitality_power_word_attack', 'punch_defend', 'kick_defend', 'staff_defend', 'spear_defend', 'sabre_defend', 'bow_attack'].map(n => [`assets/images/battlecard/illustration/${n}.png`, `icons/${n}.png`]),
  // ---- 背景：战斗场景 + 剧情 CG ----
  ['assets/images/battle/scene/mountain_night.png', 'bg/mountain_night.png'],
  ['assets/images/battle/scene/mountain_day.png', 'bg/mountain_day.png'],
  ['assets/images/battle/scene/plain_night.png', 'bg/plain_night.png'],
  ['assets/images/battle/scene/forest_night.png', 'bg/forest_night.png'],
  ['assets/images/battle/scene/dungeon_night.png', 'bg/dungeon_night.png'],
  ['assets/images/battle/scene/dojo_night.png', 'bg/dojo_night.png'],
  ['assets/images/story/cg/chapter1/wanfuzong.png', 'bg/wanfuzong.png'],
  ['assets/images/story/cg/chapter1/dinglingbei.png', 'bg/dinglingbei.png'],
  ['assets/images/story/cg/prelude/meteor.png', 'bg/meteor.png'],
  ['assets/images/story/cg/prelude/dungeon_1.png', 'bg/dungeon_1.png'],
  // ---- UI ----
  ['assets/images/ui/button.png', 'ui/button.png'],
  ['assets/images/battlecard/border.png', 'ui/border.png'],
  ['assets/images/battlecard/border_unique.png', 'ui/border_unique.png'],
  ['assets/images/battlecard/icon_border.png', 'ui/icon_border.png'],
  ['assets/images/battlecard/glow.png', 'ui/glow.png'],
  ['assets/images/battlecard/cardback.png', 'ui/cardback.png'],
  // ---- 头像（敌人）----
  ['assets/images/illustration/avatar/fanzu/female/0.png', 'avatar/fanzu0.png'],
  ['assets/images/illustration/avatar/fanzu/female/1.png', 'avatar/fanzu1.png'],
  ['assets/images/illustration/avatar/fanzu/female/2.png', 'avatar/fanzu2.png'],
];

let ok = 0, fail = 0;
const CONC = 10;
for (let i = 0; i < FILES.length; i += CONC) {
  const batch = FILES.slice(i, i + CONC);
  await Promise.all(batch.map(async ([src, dest]) => {
    const out = path.join(OUT, dest);
    try {
      const r = await fetch(BASE + src);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 200) throw new Error('太小 ' + buf.length + 'B');
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, buf);
      ok++;
    } catch (e) { fail++; console.error('FAIL', dest, e.message); }
  }));
}
console.log(`\n下载完成: 成功 ${ok} / 失败 ${fail}`);
