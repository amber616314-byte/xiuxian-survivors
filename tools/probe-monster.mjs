// 搜索怪物/妖兽素材 + 查看其余目录
(async () => {
  const repo = 'hetu-script/heavenly-tribulation';
  const meta = await fetch('https://api.github.com/repos/' + repo, { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const t = await fetch('https://api.github.com/repos/' + repo + '/git/trees/' + meta.default_branch + '?recursive=1', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const files = (t.tree || []).filter(f => f.type === 'blob').map(f => f.path);

  const kw = ['monster', 'beast', 'enemy', 'animal', 'wolf', 'bat', 'spider', 'snake', 'dragon', 'demon', 'ghost', 'zombie', 'demon_king'];
  for (const k of kw) {
    const hits = files.filter(f => f.toLowerCase().includes(k));
    if (hits.length) {
      console.log(`=== ${k} (${hits.length}) ===`);
      hits.slice(0, 10).forEach(f => console.log('  ', f));
    }
  }
  // location 非 card 的
  console.log('\n=== location 非 card ===');
  files.filter(f => f.startsWith('assets/images/location/') && !f.includes('/card/')).slice(0, 25).forEach(f => console.log('  ', f));
  // battle 目录
  console.log('\n=== battle ===');
  files.filter(f => f.startsWith('assets/images/battle/')).slice(0, 20).forEach(f => console.log('  ', f));
  // story 目录
  console.log('\n=== story ===');
  files.filter(f => f.startsWith('assets/images/story/')).slice(0, 15).forEach(f => console.log('  ', f));
})();
