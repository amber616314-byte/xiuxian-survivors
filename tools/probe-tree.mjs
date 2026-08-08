// 深挖两个素材仓库的完整结构
(async () => {
  const repo = 'hetu-script/heavenly-tribulation';
  const meta = await fetch('https://api.github.com/repos/' + repo, { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const t = await fetch('https://api.github.com/repos/' + repo + '/git/trees/' + meta.default_branch + '?recursive=1', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const files = (t.tree || []).filter(f => f.type === 'blob');
  // 顶层目录分类
  const dirs = {};
  for (const f of files) {
    const parts = f.path.split('/');
    const key = parts.slice(0, Math.min(3, parts.length - 1)).join('/');
    dirs[key] = (dirs[key] || 0) + 1;
  }
  const sorted = Object.entries(dirs).sort((a, b) => b[1] - a[1]);
  console.log('=== 目录分类 (前 40) ===');
  sorted.slice(0, 40).forEach(([d, n]) => console.log(' ', n, d));
  // 列出根 assets/images 下的一级目录
  const roots = {};
  for (const f of files) {
    const p = f.path;
    if (p.startsWith('assets/images/')) {
      const rest = p.slice('assets/images/'.length);
      const top = rest.split('/')[0];
      roots[top] = (roots[top] || 0) + 1;
    }
  }
  console.log('=== assets/images 一级目录 ===');
  Object.entries(roots).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(' ', n, d));
})();
