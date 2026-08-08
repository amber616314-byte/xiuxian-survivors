# 精确切分精灵图：按透明间隙提取帧，输出 assets/sprites/ 下 PNG + 帧布局 JSON
import os, json
from PIL import Image

SRC = 'assets/images'
OUT = 'assets/sprites'

def alpha_cols(im):
    a = im.getchannel('A')
    w, h = im.size
    res = []
    for x in range(w):
        ext = a.crop((x, 0, x + 1, h)).getextrema()
        res.append(ext[1])  # 最大 alpha：该列是否有不透明像素
    return res

def alpha_rows(im):
    a = im.getchannel('A')
    w, h = im.size
    res = []
    for y in range(h):
        ext = a.crop((0, y, w, y + 1)).getextrema()
        res.append(ext[1])
    return res

def segments(proj, threshold=0):
    # 返回非透明连续区间 [(start, end), ...]
    segs = []
    in_seg = False
    for i, v in enumerate(proj):
        if v > threshold and not in_seg:
            start = i; in_seg = True
        elif v <= threshold and in_seg:
            segs.append((start, i - 1)); in_seg = False
    if in_seg:
        segs.append((start, len(proj) - 1))
    return segs

os.makedirs(OUT, exist_ok=True)
layout = {}

def slice_frames(name, path):
    im = Image.open(path)
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    cols = alpha_cols(im)
    rows = alpha_rows(im)
    xsegs = segments(cols)
    ysegs = segments(rows)
    if not xsegs or not ysegs:
        print(f'{name}: 未找到有效区域')
        return
    # 整体内容边界
    x0, x1 = xsegs[0][0], xsegs[-1][1]
    y0, y1 = ysegs[0][0], ysegs[-1][1]
    # 帧边界：扫描内容区，遇透明间隙（>=2px）则切帧，跳过整个间隙
    frames_x = [x0]
    i = x0 + 1
    while i < x1:
        if cols[i] == 0:
            j = i
            while j < x1 and cols[j] == 0:
                j += 1
            if j - i >= 2 and i - frames_x[-1] > 3:
                frames_x.append(i + 1)
            i = j
        else:
            i += 1
    frames_x.append(x1 + 1)
    frames_y = [y0]
    i = y0 + 1
    while i < y1:
        if rows[i] == 0:
            j = i
            while j < y1 and rows[j] == 0:
                j += 1
            if j - i >= 2 and i - frames_y[-1] > 3:
                frames_y.append(i + 1)
            i = j
        else:
            i += 1
    frames_y.append(y1 + 1)
    # 切帧
    frames = []
    for fy in range(len(frames_y) - 1):
        for fx in range(len(frames_x) - 1):
            box = (frames_x[fx], frames_y[fy], frames_x[fx + 1], frames_y[fy + 1])
            fr = im.crop(box)
            if fr.getchannel('A').getextrema()[1] == 0:  # 空 box（非规则网格）跳过
                continue
            # 去边缘透明
            fa = fr.getchannel('A')
            fx0, fx1 = segments(alpha_cols(fr))[0][0], segments(alpha_cols(fr))[-1][1]
            fy0, fy1 = segments(alpha_rows(fr))[0][0], segments(alpha_rows(fr))[-1][1]
            fr = fr.crop((fx0, fy0, fx1 + 1, fy1 + 1))
            # 过滤微小残留帧（噪声像素）
            if fr.size[0] < 8 or fr.size[1] < 8:
                continue
            if fr.getchannel('A').getextrema()[1] == 0:  # 最大 alpha 为 0 = 完全透明
                continue
            frames.append(fr)
    print(f'{name}: 内容 {x1-x0+1}x{y1-y0+1}, 帧 {len(frames)} (x分割{len(frames_x)-1} y分割{len(frames_y)-1})')
    layout[name] = {
        'frameCount': len(frames),
        'frameW': frames[0].size[0] if frames else 0,
        'frameH': frames[0].size[1] if frames else 0,
        'animHint': 'vertical' if len(frames_x) == 2 else ('horizontal' if len(frames_y) == 2 else 'grid'),
    }
    for i, fr in enumerate(frames):
        fr.save(f'{OUT}/{name}_{i:02d}.png')

# 玩家动作
for f in sorted(os.listdir(f'{SRC}/player')):
    n = f.rsplit('.', 1)[0]
    slice_frames(f'player_{n}', f'{SRC}/player/{f}')
# 敌人
for f in sorted(os.listdir(f'{SRC}/enemy')):
    n = f.rsplit('.', 1)[0]
    slice_frames(f'enemy_{n}', f'{SRC}/enemy/{f}')
# 特效（overlay fx）
for f in sorted(os.listdir(f'{SRC}/fx')):
    n = f.rsplit('.', 1)[0]
    if n in ('flying_sword', 'flying_sword_recover'):
        slice_frames(f'fx_{n}', f'{SRC}/fx/{f}')
    elif f.endswith('.png') and 'overlay' not in n:
        slice_frames(f'fx_{n}', f'{SRC}/fx/{f}')

with open(f'{OUT}/layout.json', 'w', encoding='utf-8') as fp:
    json.dump(layout, fp, ensure_ascii=False, indent=1)
print('\n总帧数:', sum(v['frameCount'] for v in layout.values()))
