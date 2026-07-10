from PIL import Image

files = [
    "src/assets/images/vehicle-card-new.png",
    "src/assets/images/parts-card-new.png",
]

padding = 20  # সামান্য ফাঁকা জায়গা রাখার জন্য (pixels)

for path in files:
    img = Image.open(path).convert("RGBA")
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if bbox is None:
        print(f"{path}: fully transparent, skipping")
        continue
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(img.width, right + padding)
    bottom = min(img.height, bottom + padding)
    cropped = img.crop((left, top, right, bottom))
    cropped.save(path)
    print(f"{path}: cropped to {cropped.size} (was {img.size})")
