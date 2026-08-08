// 测试 game-icons.net 与 Pixabay
(async () => {
  // 1. game-icons.net
  try {
    const r = await fetch('https://game-icons.net/icons/000000/transparent/png/512/sword-icon.png', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log('game-icons PNG:', r.status, r.headers.get('content-type'), (await r.arrayBuffer()).byteLength + 'B');
  } catch (e) { console.log('game-icons FAIL:', e.message); }

  // 2. Pixabay 搜索页（仙侠）
  try {
    const r = await fetch('https://pixabay.com/images/search/%E4%BB%99%E4%BE%A0/', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } });
    const html = await r.text();
    console.log('pixabay 状态:', r.status, '长度:', html.length);
    const imgs = [...html.matchAll(/https:\/\/cdn\.pixabay\.com\/[^"'\s]+\.(?:jpg|png|webp)/g)].map(m => m[0]);
    console.log('cdn 图片链接:', imgs.length, imgs.slice(0, 5));
  } catch (e) { console.log('pixabay FAIL:', e.message); }
})();
