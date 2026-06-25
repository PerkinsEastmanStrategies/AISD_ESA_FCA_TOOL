import re

t = open("public/LivelyMS_plan.svg", encoding="utf-8").read()
labels = []
for p in re.findall(r"<polygon class=\"proom\"[^>]*/>", t):
    dl = re.search(r'data-label="([^"]+)"', p)
    if not dl:
        continue
    x = float(re.search(r'data-label-x="([^"]+)"', p).group(1))
    y = float(re.search(r'data-label-y="([^"]+)"', p).group(1))
    text = dl.group(1)
    pts = re.search(r'points="([^"]+)"', p).group(1)
    nums = [float(n) for n in re.split(r"[\s,]+", pts.strip()) if n]
    area = 0.0
    for i in range(0, len(nums) - 2, 2):
        area += nums[i] * nums[i + 3] - nums[i + 2] * nums[i + 1]
    area = abs(area) / 2
    labels.append({"text": text, "x": x, "y": y, "area": area})

print("labels", len(labels))


def min_zoom(area: float) -> float:
    if area >= 120_000:
        return 0.55
    if area >= 60_000:
        return 0.75
    if area >= 25_000:
        return 0.95
    if area >= 10_000:
        return 1.2
    if area >= 4_000:
        return 1.55
    return 1.9


def visible_count(zoom: float) -> int:
    vb_w, vw = 6089.0, 800.0
    fs = 11 * (vb_w / vw) / max(zoom, 0.35)
    gap = fs * 0.15
    sorted_l = sorted(labels, key=lambda item: -item["area"])
    boxes = []
    accepted = 0
    for label in sorted_l:
        if zoom < min_zoom(label["area"]):
            continue
        w = max(fs * 0.58 * len(label["text"]), fs * 0.9)
        h = fs * 1.15
        box = {
            "x": label["x"] - w / 2,
            "y": label["y"] - h / 2,
            "w": w,
            "h": h,
        }
        hit = any(
            box["x"] < b["x"] + b["w"] + gap
            and box["x"] + box["w"] + gap > b["x"]
            and box["y"] < b["y"] + b["h"] + gap
            and box["y"] + box["h"] + gap > b["y"]
            for b in boxes
        )
        if hit:
            continue
        boxes.append(box)
        accepted += 1
    return accepted


for z in [0.5, 1, 1.5, 2, 2.5, 3, 4]:
    print(f"zoom {z}: {visible_count(z)} / {len(labels)}")
