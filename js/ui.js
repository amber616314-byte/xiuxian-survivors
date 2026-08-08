// ================= UI 层：HUD / 升级三选一 / 结算 / 暂停 =================
const UI = {
  el: {},
  realmColors: ['#cfd8ec', '#7ee8fa', '#e8c15a', '#b06adf', '#ff7a6a', '#a8a0ff', '#ffe9a0'],
  realmTitles: ['初入道途', '筑基新秀', '金丹真人', '元婴老怪', '化神大能', '渡劫至尊', '半步飞仙'],
  winTitle: '陆地剑仙 · 羽化飞升',

  init() {
    const $ = id => this.el[id] = document.getElementById(id);
    ['menu','howto','hud','levelup','pause','result','toast','tutorial','hp-fill','hp-text','mp-fill','mp-text',
     'xp-fill','xp-text','realm-icon','realm-name','timer','wave','kill-count','combo','boss-bar','boss-name',
     'boss-fill','skill-bar','dodge-cd','tribulation','trib-title','trib-sub','lu-cards','result-title',
     'result-sub','rs-time','rs-kills','rs-level','rs-realm','rs-combo','result-title2','result-best',
     'menu-best'].forEach($);

    document.getElementById('btn-start').addEventListener('click', () => Game.start());
    document.getElementById('btn-howto').addEventListener('click', () => this.show('howto'));
    document.getElementById('btn-howto-close').addEventListener('click', () => this.hide('howto'));
    document.getElementById('btn-resume').addEventListener('click', () => Game.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => Game.start());
    document.getElementById('btn-quit').addEventListener('click', () => Game.toMenu());
    document.getElementById('btn-retry').addEventListener('click', () => Game.start());
    document.getElementById('btn-menu').addEventListener('click', () => Game.toMenu());
    document.getElementById('btn-tut-close').addEventListener('click', () => this.hide('tutorial'));

    // 升级卡片点击
    this.el['lu-cards'].addEventListener('click', e => {
      const card = e.target.closest('.lu-card');
      if (card) Game.chooseSkill(card.dataset.id);
    });
    // 菜单音乐按钮
    const musicBtn = document.createElement('button');
    musicBtn.id = 'btn-music';
    musicBtn.className = 'btn btn-ghost btn-sm';
    musicBtn.textContent = '♪ 背景音乐：开';
    musicBtn.addEventListener('click', () => {
      const on = AudioFX.musicOn;
      AudioFX.setMusic(!on);
      musicBtn.textContent = '♪ 背景音乐：' + (on ? '关' : '开');
      AudioFX.tone(880, 0.2, 'sine', 0.1);
    });
    document.querySelector('.menu-actions').appendChild(musicBtn);

    this.updateMenuBest();
  },

  show(id) { this.el[id].classList.remove('hidden'); },
  hide(id) { this.el[id].classList.add('hidden'); },
  set(id, html) { this.el[id].innerHTML = html; },

  // ---------------- 主菜单 ----------------
  updateMenuBest() {
    const d = Utils.store.load();
    const best = d.best;
    if (!best) { this.el['menu-best'].textContent = '尚无仙途记录 · 秘境静候首修'; return; }
    const win = best.win ? '（飞升）' : '';
    this.el['menu-best'].textContent =
      `仙途最高纪录：${best.realm}${win} · 斩妖 ${best.kills} · 存活 ${Utils.fmtTime(best.time)}`;
  },

  // ---------------- HUD ----------------
  updateHUD(dt) {
    const p = Entities.player;
    if (!p) return;
    const hpPct = Utils.clamp(p.hp / p.maxHp, 0, 1);
    const mpPct = Utils.clamp(p.mana / p.maxMana, 0, 1);
    const xpPct = Utils.clamp(p.xp / p.xpNeed, 0, 1);
    this.el['hp-fill'].style.width = (hpPct * 100) + '%';
    this.el['hp-text'].textContent = `${Math.ceil(p.hp)}/${Math.ceil(p.maxHp)}`;
    this.el['mp-fill'].style.width = (mpPct * 100) + '%';
    this.el['mp-text'].textContent = Math.floor(p.mana);
    this.el['xp-fill'].style.width = (xpPct * 100) + '%';
    this.el['xp-text'].textContent = `Lv.${p.level}`;

    const ri = Entities.realmIndex();
    this.el['realm-icon'].textContent = CFG.realms[ri].name[0];
    this.el['realm-name'].textContent = CFG.realms[ri].name;
    this.el['realm-icon'].style.background =
      `radial-gradient(circle at 34% 30%, #fff, ${this.realmColors[ri]} 55%, #1c2438)`;

    // 计时
    const remain = CFG.SURVIVE - Game.time;
    this.el['timer'].textContent = Utils.fmtTime(remain);
    this.el['timer'].classList.toggle('warn', remain <= 60);

    this.el['kill-count'].textContent = Entities.kills;
    if (Entities.combo >= 5) {
      this.el['combo'].textContent = `连斩 ×${Entities.combo}`;
      this.el['combo'].classList.add('on');
    } else this.el['combo'].classList.remove('on');

    // 闪避冷却
    const dc = p.dodgeCd;
    this.el['dodge-cd'].classList.toggle('ready', dc <= 0);
    this.el['dodge-cd'].textContent = dc <= 0 ? '缩地成寸 · 就绪' : `缩地成寸 · ${dc.toFixed(1)}s`;

    // Boss 血条
    const boss = Entities.boss;
    if (boss) {
      this.el['boss-bar'].classList.remove('hidden');
      this.el['boss-fill'].style.width = (Utils.clamp(boss.hp / boss.maxHp, 0, 1) * 100) + '%';
    }
  },

  buildSkillBar() {
    // 8 装备栏：先排已拥有神通（含融合产物），空位留白
    const slots = [];
    const items = [];
    for (const id in SkillSystem.owned) {
      const S = CFG.skills[id];
      items.push({ icon: S.icon, name: S.name, lv: SkillSystem.owned[id], fuse: SkillSystem.maxed(id) && !!S.fuse });
    }
    for (const id in SkillSystem.fused) {
      const F = CFG.fusions[id];
      items.push({ icon: F.icon, name: F.name, lv: '融', fused: true });
    }
    for (let i = 0; i < CFG.slots; i++) {
      const it = items[i];
      if (!it) {
        slots.push(`<div class="skill-slot empty" title="空装备栏"></div>`);
        continue;
      }
      slots.push(`<div class="skill-slot${it.fused ? ' fused' : ''}" title="${it.name}">
        <img src="assets/${it.icon}" alt="${it.name}">
        ${it.lv === '融' ? '<span class="lv fuse">融</span>' : `<span class="lv">${it.lv}</span>`}
      </div>`);
    }
    this.el['skill-bar'].innerHTML = slots.join('');
  },

  setWave(wave) {
    this.el['wave'].textContent = `第 ${wave} 波妖潮`;
  },

  // ---------------- 渡劫横幅 ----------------
  showTrib(active, realmName) {
    if (active) {
      this.el['trib-title'].textContent = '天 劫 降 临';
      this.el['trib-sub'].textContent = `渡劫突破 · ${realmName}在望`;
      this.show('tribulation');
      this.el['tribulation'].style.animation = 'none';
      void this.el['tribulation'].offsetWidth;
      this.el['tribulation'].style.animation = 'tribFlash 1s ease both';
    } else {
      this.el['trib-title'].textContent = '劫 后 飞 升';
      this.el['trib-sub'].textContent = '道基已成 · 万妖辟易';
      setTimeout(() => this.hide('tribulation'), 1300);
    }
  },

  // ---------------- 升级三选一 ----------------
  showLevelUp(choices) {
    this.show('levelup');
    const cards = [];
    for (const id of choices) {
      const S = CFG.skills[id];
      const lv = SkillSystem.owned[id] || 0;
      const isNew = !lv;
      const gain = S.gainText[lv - 1] || S.gainText[S.gainText.length - 1];
      // 融合预兆：若此神通升满且配对已满 → 提示融合
      let fuseHint = '';
      if (lv === S.max - 1 && S.fuse && SkillSystem.lv(S.fuse) >= S.max) {
        const fid = Object.keys(CFG.fusions).find(f => {
          const P = CFG.fusions[f].parts;
          return (P[0] === id && P[1] === S.fuse) || (P[0] === S.fuse && P[1] === id);
        });
        if (fid) fuseHint = `<div class="lu-fuse">⚡ 满级将与「${CFG.skills[S.fuse].name}」融合为 <b>${CFG.fusions[fid].name}</b>！</div>`;
      }
      let effect = '';
      if (isNew) {
        effect = `<div class="lu-next">新神通 · <b>${S.desc}</b></div>`;
      } else {
        effect = `<div class="lu-next">升级 → <b>${gain}</b></div>`;
      }
      cards.push(`<div class="lu-card${isNew ? ' new' : ''}" data-id="${id}">
        <div class="lu-icon"><img src="assets/${S.icon}" alt="${S.name}"></div>
        <div class="lu-name">${S.name}</div>
        <div class="lu-desc">${S.desc}</div>
        <div class="lu-cur">当前 Lv.${lv}${isNew ? '（未参悟）' : ''}</div>
        ${effect}
        ${fuseHint}
        <div class="lu-keyhint"><span class="key">${choices.indexOf(id) + 1}</span> 参悟此神通</div>
      </div>`);
    }
    this.el['lu-cards'].innerHTML = cards.join('');
  },

  hideLevelUp() { this.hide('levelup'); },

  // ---------------- 暂停 ----------------
  showPause(show) {
    if (show) this.show('pause'); else this.hide('pause');
  },

  // ---------------- 结算 ----------------
  showResult(stats) {
    const win = stats.win;
    this.el['result-title'].textContent = win ? '羽 化 飞 升' : '陨 落 道 消';
    this.el['result-title'].className = win ? 'win' : 'lose';
    this.el['result-sub'].textContent = win
      ? '斩灭心魔 · 功德圆满 · 白日飞升'
      : `殒身于${stats.realm}境界 · 妖潮无情`;
    this.el['rs-time'].textContent = Utils.fmtTime(stats.time);
    this.el['rs-kills'].textContent = stats.kills;
    this.el['rs-level'].textContent = `Lv.${stats.level}`;
    this.el['rs-realm'].textContent = stats.realm;
    this.el['rs-combo'].textContent = stats.maxCombo;
    const title = win ? this.winTitle : this.realmTitles[stats.realmIdx] || '初入道途';
    this.el['result-title2'].textContent = title;
    // 最高纪录
    const d = Utils.store.load();
    const best = d.best;
    let bestStr = '无历史纪录';
    if (best) {
      bestStr = `历史最佳：${best.realm}${best.win ? '（飞升）' : ''} · 斩妖 ${best.kills} · 存活 ${Utils.fmtTime(best.time)}`;
    }
    if (stats.newBest) bestStr = '🏆 打破仙途纪录！' + bestStr.replace('历史最佳：', '');
    this.el['result-best'].textContent = bestStr;
    this.show('result');
    this.hide('levelup');
    this.hide('pause');
  },

  // 融合成功横幅
  showFusion(F) {
    const el = this.el['toast'];
    el.innerHTML = `<div style="font-size:30px;color:#ffe9a0;letter-spacing:4px">⚡ 神 通 融 合 ⚡</div>
      <div style="margin-top:6px;font-size:20px;color:#fff">${F.parts.map(p => CFG.skills[p].name).join(' + ')} → <b style="color:#ffd24a">${F.name}</b></div>
      <div style="margin-top:4px;font-size:15px;color:#cfd8ec">${F.desc}</div>`;
    el.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.add('hidden'), 3200);
  },

  // ---------------- 提示 ----------------
  toast(msg, dur = 2.2) {
    const t = this.el['toast'];
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), dur * 1000);
  },
};
