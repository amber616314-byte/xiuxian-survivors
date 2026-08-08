// 查看许可证 + 关键素材分类的具体文件
(async () => {
  const repo = 'hetu-script/heavenly-tribulation';
  const meta = await fetch('https://api.github.com/repos/' + repo, { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  console.log('license:', meta.license ? meta.license.spdx_id + ' | ' + meta.license.name : '无');
  console.log('desc:', meta.description, '| updated:', meta.updated_at);
  const t = await fetch('https://api.github.com/repos/' + repo + '/git/trees/' + meta.default_branch + '?recursive=1', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const files = (t.tree || []).filter(f => f.type === 'blob').map(f => f.path);

  const pick = (prefix, n) => files.filter(f => f.startsWith(prefix)).slice(0, n);
  console.log('\n--- animation 目录结构 ---');
  const animDirs = {};
  files.filter(f => f.startsWith('assets/images/animation/')).forEach(f => {
    const rest = f.slice('assets/images/animation/'.length);
    const d = rest.split('/')[0];
    animDirs[d] = (animDirs[d] || 0) + 1;
  });
  Object.entries(animDirs).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(' ', n, d));
  console.log('\n--- animation/character 文件示例 ---');
  pick('assets/images/animation/character/', 12).forEach(f => console.log('  ', f));
  console.log('\n--- cultivation 示例 ---');
  pick('assets/images/cultivation/', 10).forEach(f => console.log('  ', f));
  console.log('\n--- battlecard 示例 ---');
  pick('assets/images/battlecard/', 10).forEach(f => console.log('  ', f));
  console.log('\n--- item 示例 ---');
  pick('assets/images/item/', 15).forEach(f => console.log('  ', f));
  console.log('\n--- location 示例 ---');
  pick('assets/images/location/', 12).forEach(f => console.log('  ', f));
  console.log('\n--- particles 全部 ---');
  pick('assets/images/particles/', 30).forEach(f => console.log('  ', f));
})();
