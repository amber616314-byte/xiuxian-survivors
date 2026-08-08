// 下载飞龙 zip + 探测兽形素材 slug
import { writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

// 1. 下载飞龙动画
const r = await fetch('https://opengameart.org/sites/default/files/fantasydragon_animation_free.zip');
const buf = Buffer.from(await r.arrayBuffer());
await writeFile('tools/dragon.zip', buf);
console.log('飞龙 zip:', buf.length, 'B');
// 解压
execSync('python -c "import zipfile; zipfile.ZipFile(\'tools/dragon.zip\').extractall(\'tools/dragon/\')"');
console.log('解压完成');

// 2. 探测常见兽形素材页
for (const slug of ['wolf-animated', 'spider', 'snake', 'giant-bat', 'animated-animals', 'forest-monsters', 'bat', 'wolf-sprite-sheet']) {
  try {
    const r2 = await fetch('https://opengameart.org/content/' + slug, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r2.text();
    const title = (html.match(/<title>([^<]+)<\/title>/) || [,'?'])[1];
    const files = [...html.matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+\.(?:zip|png|gif))"/g)].map(m => m[1]);
    console.log(slug, '->', r2.status, '|', title.slice(0, 40), '| 文件:', files.length ? files.slice(0, 3).join(' ; ') : '无');
  } catch (e) { console.log(slug, 'FAIL'); }
}
