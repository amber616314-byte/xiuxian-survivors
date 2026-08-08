// ================= 素材加载器：图片预加载 + 精灵帧管理 =================
// 素材来源：hetu-script/heavenly-tribulation（MIT License）《天道奇劫》游戏素材
// 经 tools/slice-sprites.py 切成单帧 PNG 后存放于 assets/sprites/
const Assets = {
  images: {},       // path -> Image
  total: 0, loaded: 0,
  ready: false,
  onReady: null,

  // 需要预加载的图片清单
  manifest: () => {
    const m = [];
    const add = (key, path) => m.push({ key, path });
    // 背景
    add('bg_battle', 'images/bg/mountain_night.png');
    add('bg_menu', 'images/bg/wanfuzong.png');
    add('bg_ascend', 'images/bg/meteor.png');
    add('bg_trib', 'images/bg/dungeon_night.png');
    // 云粒子
    for (let i = 0; i < 5; i++) add('cloud' + i, `images/fx/cloud${i}.png`);
    // 玩家动作帧（归一化画布，sprites2）
    for (let i = 0; i < 6; i++) add(`player_stand_${i}`, `sprites2/player_stand_${String(i).padStart(2, '0')}.png`);
    for (let i = 0; i < 16; i++) add(`player_move_${i}`, `sprites2/player_move_${String(i).padStart(2, '0')}.png`);
    for (let i = 0; i < 8; i++) add(`player_attack_${i}`, `sprites2/player_attack_${String(i).padStart(2, '0')}.png`);
    for (let i = 0; i < 5; i++) add(`player_cast_${i}`, `sprites2/player_cast_${String(i).padStart(2, '0')}.png`);
    for (let i = 0; i < 6; i++) add(`player_dodge_${i}`, `sprites2/player_dodge_${String(i).padStart(2, '0')}.png`);
    for (let i = 0; i < 6; i++) add(`player_hit_${i}`, `sprites2/player_hit_${String(i).padStart(2, '0')}.png`);
    for (let i = 0; i < 7; i++) add(`player_defeat_${i}`, `sprites2/player_defeat_${String(i).padStart(2, '0')}.png`);
    // 敌人（梵族妖修，归一化画布）
    const enemies = { fanzu1: 'enemy_fanzu1', fanzu2: 'enemy_fanzu2', fanzu3: 'enemy_fanzu3', fanzu_mage: 'enemy_fanzu_mage', fanzu_bat: 'enemy_fanzu_bat', elite: 'enemy_fanzu_elite', boss: 'enemy_fanzu_boss' };
    for (const [key, base] of Object.entries(enemies)) {
      for (let i = 0; i < 4; i++) add(`enemy_${key}_${i}`, `sprites2/${base}_${String(i).padStart(2, '0')}.png`);
    }
    // 妖兽（OpenMoji 高清兽形静态图）
    const monsters = ['wolf', 'bee', 'bear', 'bat', 'snake', 'fox', 'dragon', 'tiger', 'spider', 'boar', 'eagle', 'scorpion'];
    for (const m of monsters) add(`monster_${m}`, `images/monster/${m}.png`);
    // 立绘（心魔/主菜单）
    add('portrait_hero1', 'images/portrait/hero1.png');
    add('portrait_hero2', 'images/portrait/hero2.png');
    add('portrait_villain1', 'images/portrait/villain1.png');
    // 技能特效（帧数为实际切片数量）
    const fx = {
      sword: ['fx_flying_sword', 9], fireball: ['fx_fireball', 11], lightning: ['fx_lightning', 12],
      wind: ['fx_wind_blade', 11], stone: ['fx_falling_stone', 8], sigil: ['fx_sigil', 14],
      heal: ['fx_restore_life', 9], poison: ['fx_poison', 9], swamp: ['fx_swamp', 12],
      curse: ['fx_curse', 7],
    };
    for (const [key, [base, n]] of Object.entries(fx)) {
      for (let i = 0; i < n; i++) add(`fx_${key}_${i}`, `sprites/${base}_${String(i).padStart(2, '0')}.png`);
    }
    return m;
  },

  init(onReady) {
    this.onReady = onReady;
    const list = this.manifest();
    this.total = list.length;
    for (const { key, path } of list) {
      const img = new Image();
      img.onload = () => {
        this.loaded++;
        if (this.loaded >= this.total) {
          this.ready = true;
          if (this.onReady) this.onReady();
        }
      };
      img.onerror = () => {
        this.loaded++;
        console.warn('素材加载失败:', path);
        if (this.loaded >= this.total && !this.ready) {
          this.ready = true;
          if (this.onReady) this.onReady();
        }
      };
      this.images[key] = img;
      img.src = 'assets/' + path;
    }
  },

  img(key) { return this.images[key]; },
  readyImg(key) { const i = this.images[key]; return i && i.complete && i.naturalWidth > 0; },

  // 动画帧辅助：返回第 i 帧图片（循环）
  anim(keyBase, frame, count) {
    return this.images[keyBase + '_' + (frame % count)];
  },
};
