// 深挖天道奇劫 story/cg 与 illustration 非头像部分
(async () => {
  const meta = await fetch('https://api.github.com/repos/hetu-script/heavenly-tribulation', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const t = await fetch('https://api.github.com/repos/hetu-script/heavenly-tribulation/git/trees/' + meta.default_branch + '?recursive=1', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const files = (t.tree || []).filter(f => f.type === 'blob').map(f => f.path);
  console.log('=== story/cg 全部 ===');
  files.filter(f => f.startsWith('assets/images/story/cg/')).forEach(f => console.log(' ', f.replace('assets/images/story/cg/', '')));
  console.log('\n=== illustration 非 avatar 目录 ===');
  files.filter(f => f.startsWith('assets/images/illustration/') && !f.includes('/avatar/')).slice(0, 40).forEach(f => console.log(' ', f.replace('assets/images/illustration/', '')));
})();
