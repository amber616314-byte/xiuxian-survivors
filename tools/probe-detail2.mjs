// 查看 illustration / overlay / icon / ui / story 目录
(async () => {
  const repo = 'hetu-script/heavenly-tribulation';
  const meta = await fetch('https://api.github.com/repos/' + repo, { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const t = await fetch('https://api.github.com/repos/' + repo + '/git/trees/' + meta.default_branch + '?recursive=1', { headers: { 'User-Agent': 'dev' } }).then(r => r.json());
  const files = (t.tree || []).filter(f => f.type === 'blob').map(f => f.path);

  const list = (prefix, n, skip = 0) => {
    const arr = files.filter(f => f.startsWith(prefix));
    console.log(`\n--- ${prefix} (共${arr.length}) ---`);
    arr.slice(skip, skip + n).forEach(f => console.log('  ', f));
  };
  list('assets/images/illustration/', 25);
  list('assets/images/animation/overlay/', 15);
  list('assets/images/icon/', 30);
  list('assets/images/ui/', 20);
  list('assets/images/object/', 20);
  list('assets/images/animation/characterManGeneral/', 10);
  list('assets/images/animation/characterWomanGeneral/', 10);
})();
