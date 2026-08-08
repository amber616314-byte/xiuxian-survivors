// 抓取 OGA 具体内容页
(async () => {
  for (const slug of ['flying-dragon', 'monk-animated']) {
    try {
      const r = await fetch('https://opengameart.org/content/' + slug, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const html = await r.text();
      console.log('=== ' + slug + ' 状态=' + r.status + ' 长度=' + html.length + ' ===');
      // 文件下载链接
      const files = [...html.matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+)"/g)].map(m => m[1]);
      files.forEach(f => console.log('  FILE:', f));
      // 标题和描述片段
      const t = html.match(/<title>([^<]+)<\/title>/);
      if (t) console.log('  标题:', t[1]);
      const lic = html.match(/License[^<]*<\/[^>]+>\s*<[^>]+>([^<]{3,40})/);
      if (lic) console.log('  许可:', lic[1]);
    } catch (e) { console.log(slug, 'FAIL', e.message); }
  }
})();
