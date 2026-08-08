// 查看候选仓库的图片素材
(async () => {
  const repos = ['851896022/DesktopXiuXian', 'LonerUniverse/-2DGame-', 'QINGQIUYE/xianxia', 'hetu-script/heavenly-tribulation', 'bsou911/xiuxian-idle'];
  for (const repo of repos) {
    try {
      const meta = await fetch('https://api.github.com/repos/' + repo, { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      if (!meta.default_branch) { console.log(repo, '->', meta.message || 'no branch'); continue; }
      const t = await fetch('https://api.github.com/repos/' + repo + '/git/trees/' + meta.default_branch + '?recursive=1', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
      const files = (t.tree || []).filter(f => f.type === 'blob');
      const imgs = files.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f.path));
      const big = imgs.filter(f => (f.size || 0) > 30000);
      console.log(repo, '| 图片:', imgs.length, '| >30KB:', big.length);
      big.slice(0, 12).forEach(f => console.log('   ', f.path.slice(0, 80), Math.round(f.size / 1024) + 'KB'));
    } catch (e) { console.log(repo, 'FAIL:', e.message); }
  }
})();
