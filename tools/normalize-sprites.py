# 归一化精灵帧：角色/敌人组内所有帧统一画布（高度基准 + 组内最大宽度），杜绝渲染拉伸
# 源前缀 → 目标前缀（输出到 assets/sprites2/）
import os, json
from PIL import Image

SRC = 'assets/sprites'
OUT = 'assets/sprites2'
TARGET_H = 160

GROUPS = [
    ('player_stand', 'player_stand', 6),
    ('player_tilemap_moving_animation', 'player_move', 16),
    ('player_attack_sword', 'player_attack', 8),
    ('player_attack_spell', 'player_cast', 5),
    ('player_dodge', 'player_dodge', 6),
    ('player_hit', 'player_hit', 6),
    ('player_defeat', 'player_defeat', 7),
    ('enemy_fanzu1', 'enemy_fanzu1', 4),
    ('enemy_fanzu2', 'enemy_fanzu2', 4),
    ('enemy_fanzu3', 'enemy_fanzu3', 4),
    ('enemy_fanzu_mage', 'enemy_fanzu_mage', 4),
    ('enemy_fanzu_bat', 'enemy_fanzu_bat', 4),
    ('enemy_fanzu_elite', 'enemy_fanzu_elite', 4),
    ('enemy_fanzu_boss', 'enemy_fanzu_boss', 4),
]

os.makedirs(OUT, exist_ok=True)
meta = {}

for src_pre, dst_pre, count in GROUPS:
    frames = []
    for i in range(count):
        p = f'{SRC}/{src_pre}_{i:02d}.png'
        if not os.path.exists(p):
            continue
        frames.append(Image.open(p).convert('RGBA'))
    if not frames:
        print(f'{src_pre}: 无帧，跳过')
        continue
    scaled = []
    max_w = 0
    for im in frames:
        w, h = im.size
        nw = max(1, round(w * TARGET_H / h))
        scaled.append(im.resize((nw, TARGET_H), Image.LANCZOS))
        max_w = max(max_w, nw)
    meta[dst_pre] = {'w': max_w, 'h': TARGET_H, 'n': len(scaled)}
    for i, s in enumerate(scaled):
        canvas = Image.new('RGBA', (max_w, TARGET_H), (0, 0, 0, 0))
        canvas.paste(s, ((max_w - s.size[0]) // 2, 0), s)
        canvas.save(f'{OUT}/{dst_pre}_{i:02d}.png')
    print(f'{dst_pre}: {len(scaled)} 帧, 画布 {max_w}x{TARGET_H}')

with open(f'{OUT}/meta.json', 'w', encoding='utf-8') as fp:
    json.dump(meta, fp, ensure_ascii=False, indent=1)
print('完成')
