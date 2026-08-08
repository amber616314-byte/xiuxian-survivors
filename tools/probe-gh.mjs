// 搜索更合适的素材仓库
(async () => {
  const qs = ['fanren xiuxian', 'mortal cultivation journey', 'mir2 server', 'crystal mir2', 'chinese rpg assets', 'rpg maker chinese'];
  for (const q of qs) {
    try {
      const j = await fetch('https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&per_page=6', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      console.log('=== ' + q + ' ===');
      (j.items || []).forEach(r => console.log(' -', r.full_name, '★' + r.stargazers_count, String(r.description || '').slice(0, 60)));
    } catch (e) { console.log(q, 'FAIL', e.message); }
  }
})();
