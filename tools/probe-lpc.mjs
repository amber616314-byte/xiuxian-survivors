// 检查 Terasology/AdventureAssets 和 LPC 怪物素材仓库
(async () => {
  for (const repo of ['Terasology/AdventureAssets', 'liberatedpixelcup/LPC-Monsters', 'sanderfrenken/Universal-LPC-Spritesheet-Character-Generator']) {
    try {
      const meta = await fetch('https://api.github.com/repos/' + repo, { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      if (!meta.default_branch) { console.log(repo, '->', meta.message || 'N/A'); continue; }
      const t = await fetch('https://api.github.com/repos/' + repo + '/git/trees/' + meta.default_branch + '?recursive=1', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      const files = (t.tree || []).filter(f => f.type === 'blob').map(f => f.path);
      const imgs = files.filter(f => /\.(png)$/i.test(f.path));
      console.log(repo, '| PNG:', imgs.length);
      // 找动物/怪物关键词
      const kw = ['wolf', 'spider', 'snake', 'bat', 'tiger', 'fox', 'bear', 'boar', 'monster', 'creature'];
      for (const k of kw) {
        const hits = imgs.filter(f => f.toLowerCase().includes(k));
        if (hits.length) console.log('  [' + k + ']', hits.slice(0, 4).join(' | '));
      }
    } catch (e) { console.log(repo, 'FAIL:', e.message); }
  }
})();
