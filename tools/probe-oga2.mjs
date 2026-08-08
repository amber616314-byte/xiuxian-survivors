// OGA 搜索兽形怪物素材
const kws = ['wolf animated', 'bat sprite', 'spider animated', 'snake animated', 'monster animated', 'creature sprite'];
(async () => {
  for (const kw of kws) {
    try {
      const r = await fetch('https://opengameart.org/art-search-advanced?keys=' + encodeURIComponent(kw) + '&field_art_type_tid%5B0%5D=10', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const html = await r.text();
      const titles = [...html.matchAll(/<h3[^>]*>\s*<a href="(\/content\/[^"]+)">([^<]+)<\/a>/g)].map(m => m[1] + ' | ' + m[2]);
      console.log(`[${kw}] 状态=${r.status} 结果=${titles.length}`);
      titles.slice(0, 6).forEach(t => console.log('   ', t));
    } catch (e) { console.log(`[${kw}] FAIL:`, e.message); }
  }
})();
