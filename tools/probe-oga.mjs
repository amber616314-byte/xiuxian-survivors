// OGA 搜索探测：不同关键词 + 页面结构解析
const kws = ['wuxia', 'chinese', 'oriental', 'monk', 'sword'];
(async () => {
  for (const kw of kws) {
    try {
      const r = await fetch('https://opengameart.org/art-search-advanced?keys=' + kw + '&field_art_type_tid%5B0%5D=10', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const html = await r.text();
      // 内容链接格式: /content/xxx
      const links = [...new Set([...html.matchAll(/href="(\/content\/[^"]+)"/g)].map(m => m[1]))];
      // 标题
      const titles = [...html.matchAll(/<h3[^>]*>\s*<a href="(\/content\/[^"]+)">([^<]+)<\/a>/g)].map(m => m[1] + ' | ' + m[2]);
      console.log(`[${kw}] 状态=${r.status} 长度=${html.length} 内容页=${links.length}`);
      (titles.length ? titles : links).slice(0, 5).forEach(t => console.log('   ', t));
    } catch (e) { console.log(`[${kw}] FAIL:`, e.message); }
  }
})();
