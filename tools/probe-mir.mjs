// 搜索传奇客户端/素材仓库
(async () => {
  const qs = ['mir2 client source', 'mir2 wzl', 'legend mir resources', 'mir2 client', 'mir2 assets'];
  for (const q of qs) {
    try {
      const j = await fetch('https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&per_page=8', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      console.log('=== ' + q + ' ===');
      (j.items || []).forEach(r => console.log(' -', r.full_name, '★' + r.stargazers_count, String(r.description || '').slice(0, 50)));
    } catch (e) { console.log(q, 'FAIL'); }
  }
})();
