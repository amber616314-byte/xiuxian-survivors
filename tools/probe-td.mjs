// GitHub 搜索带怪物素材的项目（塔防/幸存者/怪物类）
(async () => {
  const qs = ['tower defense game html', 'survivors game html', 'monster game javascript', 'zombie game html', 'rpg game javascript monsters'];
  for (const q of qs) {
    try {
      const j = await fetch('https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&per_page=8', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      console.log('=== ' + q + ' ===');
      (j.items || []).forEach(r => console.log(' -', r.full_name, '★' + r.stargazers_count, String(r.description || '').slice(0, 45)));
    } catch (e) { console.log(q, 'FAIL'); }
  }
})();
