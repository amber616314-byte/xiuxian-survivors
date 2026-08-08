// 探测可用素材源
(async () => {
  // 1. wallhaven API（仙侠壁纸）
  try {
    const j = await fetch('https://wallhaven.cc/api/v1/search?q=chinese%20fantasy&purity=100&categories=010&atleast=1920x1080&sort=toplist', { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.json());
    console.log('wallhaven 结果数:', (j.data || []).length);
    (j.data || []).slice(0, 6).forEach(d => console.log(' -', d.id, d.resolution, d.path));
  } catch (e) { console.log('wallhaven FAIL:', e.message); }

  // 2. OpenGameArt 搜索页
  try {
    const r = await fetch('https://opengameart.org/art-search-advanced?keys=chinese+fantasy', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    console.log('OGA 状态:', r.status, '长度:', html.length);
    const links = [...html.matchAll(/href="(https:\/\/opengameart\.org\/content\/[^"]+)"/g)].map(m => m[1]);
    console.log('OGA 内容页:', [...new Set(links)].slice(0, 8));
  } catch (e) { console.log('OGA FAIL:', e.message); }

  // 3. jsdelivr 上 npm 游戏素材包探测
  try {
    const pkgs = ['rpg-js-assets', 'game-assets', 'kenney-assets'];
    for (const p of pkgs) {
      const r = await fetch('https://data.jsdelivr.com/v1/packages/npm/' + p);
      console.log('npm包', p, ':', r.status);
    }
  } catch (e) { console.log('jsdelivr FAIL:', e.message); }
})();
