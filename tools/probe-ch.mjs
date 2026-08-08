// 测试下载通道 + 查看修仙游戏仓库素材
(async () => {
  // 1. 三种 GitHub 下载通道测试
  const tests = [
    ['jsdelivr-gh', 'https://cdn.jsdelivr.net/gh/setube/vue-xiuxiangame@master/README.md'],
    ['raw', 'https://raw.githubusercontent.com/setube/vue-xiuxiangame/master/README.md'],
    ['codeload', 'https://codeload.github.com/setube/vue-xiuxiangame/zip/refs/heads/master'],
  ];
  for (const [name, u] of tests) {
    try {
      const r = await fetch(u, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
      console.log(name, ':', r.status, r.headers.get('content-length') || '?');
    } catch (e) { console.log(name, 'FAIL:', e.message); }
  }

  // 2. 修仙游戏仓库素材目录
  const repos = ['setube/vue-xiuxiangame', 'JeasonLoop/react-xiuxian-game'];
  for (const repo of repos) {
    try {
      const meta = await fetch('https://api.github.com/repos/' + repo, { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      const t = await fetch('https://api.github.com/repos/' + repo + '/git/trees/' + meta.default_branch + '?recursive=1', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      const imgs = (t.tree || []).filter(f => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.path));
      console.log(repo, '图片文件:', imgs.length);
      imgs.slice(0, 15).forEach(f => console.log('   ', f.path, Math.round((f.size || 0) / 1024) + 'KB'));
    } catch (e) { console.log(repo, 'FAIL:', e.message); }
  }
})();
