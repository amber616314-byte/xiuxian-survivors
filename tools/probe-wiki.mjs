// Wikimedia Commons + game-icons 格式探测
(async () => {
  // 1. Wikimedia Commons API
  const search = async (q) => {
    try {
      const u = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) + '&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size&format=json';
      const j = await fetch(u, { headers: { 'User-Agent': 'dev-script/1.0' } }).then(r => r.json());
      const pages = j.query ? Object.values(j.query.pages) : [];
      console.log(`[${q}] 结果 ${pages.length}`);
      pages.forEach(p => {
        const ii = p.imageinfo && p.imageinfo[0];
        console.log('  -', p.title.slice(0, 70), ii ? `(${ii.width}x${ii.height})` : '', ii ? ii.url.slice(0, 90) : '');
      });
    } catch (e) { console.log(`[${q}] FAIL:`, e.message); }
  };
  await search('xianxia');
  await search('chinese swordsman');
  await search('chinese dragon');

  // 2. game-icons.net 主页（看链接格式）
  try {
    const r = await fetch('https://game-icons.net/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    console.log('game-icons 主页:', r.status, html.length);
    const m = [...html.matchAll(/(https?:\/\/game-icons\.net\/[^"']+\.png)/g)].slice(0, 5);
    m.forEach(x => console.log('  ', x[1]));
  } catch (e) { console.log('game-icons FAIL:', e.message); }
})();
