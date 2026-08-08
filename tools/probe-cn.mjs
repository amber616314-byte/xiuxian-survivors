// 搜索带美术的修仙/仙侠游戏仓库
(async () => {
  const qs = ['修仙 游戏', '仙侠 游戏', '古风 素材', 'xiuxian idle', 'cultivation game', 'chinese fantasy game', '仙侠 网页游戏'];
  for (const q of qs) {
    try {
      const j = await fetch('https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&per_page=8', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      console.log('=== ' + q + ' ===');
      (j.items || []).forEach(r => console.log(' -', r.full_name, '★' + r.stargazers_count, String(r.description || '').slice(0, 55)));
    } catch (e) { console.log(q, 'FAIL:', e.message); }
  }
})();
