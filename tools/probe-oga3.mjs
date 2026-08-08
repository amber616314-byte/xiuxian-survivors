// OGA 单关键词搜索 + GitHub 怪物素材仓库
(async () => {
  for (const kw of ['wolf', 'spider', 'snake', 'bat']) {
    try {
      const r = await fetch('https://opengameart.org/art-search-advanced?keys=' + kw + '&field_art_type_tid%5B0%5D=10', { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await r.text();
      const titles = [...html.matchAll(/<h3[^>]*>\s*<a href="(\/content\/[^"]+)">([^<]+)<\/a>/g)].map(m => m[1] + ' | ' + m[2]);
      console.log('[' + kw + ']', titles.length, ':', titles.slice(0, 5).join(' ;; '));
    } catch (e) { console.log('[' + kw + '] FAIL', e.message); }
  }
  // GitHub 搜索怪物素材仓库
  for (const q of ['monster sprite sheet', 'creature sprites game', 'game monster assets']) {
    try {
      const j = await fetch('https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&per_page=5', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      console.log('=== GH: ' + q + ' ===');
      (j.items || []).forEach(r => console.log(' -', r.full_name, '★' + r.stargazers_count));
    } catch (e) { console.log(q, 'FAIL', e.message); }
  }
})();
