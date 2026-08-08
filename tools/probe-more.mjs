// 最后一批素材源探测
(async () => {
  // OGA 单关键词
  for (const kw of ['animal', 'dragon', 'creature', 'monster', 'enemy']) {
    try {
      const r = await fetch('https://opengameart.org/art-search-advanced?keys=' + kw + '&field_art_type_tid%5B0%5D=10', { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await r.text();
      const titles = [...html.matchAll(/<h3[^>]*>\s*<a href="(\/content\/[^"]+)">([^<]+)<\/a>/g)].map(m => m[1] + ' | ' + m[2]);
      console.log('[' + kw + ']', titles.length, ':', titles.slice(0, 4).join(' ;; '));
    } catch (e) { console.log('[' + kw + '] FAIL'); }
  }
  // GitHub RPG Maker 素材
  for (const q of ['rpg maker mv assets', 'rpg maker enemies', 'rmmv assets', 'rpg maker monster']) {
    try {
      const j = await fetch('https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&per_page=5', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      console.log('=== GH: ' + q + ' ===');
      (j.items || []).forEach(r => console.log(' -', r.full_name, '★' + r.stargazers_count, String(r.description || '').slice(0, 40)));
    } catch (e) { console.log(q, 'FAIL'); }
  }
})();
