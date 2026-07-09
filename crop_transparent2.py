from PIL import Image

files = [
    "src/assets/images/vehicle-card-new.png",
    "src/assets/images/parts-card-new.png",
]

padding = 20
threshold = 40  # এর নিচে alpha হলে "খালি" ধরা হবে

for path in files:
    img = Image.open(path).convert("RGBA")
    alpha = img.split()[-1]
    # শুধু যথেষ্ট অস্বচ্ছ pixel-কে "content" ধরে বাকিটা কালো (0) বানাই
    mask = alpha.point(lambda a: 255 if a > threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        print(f"{path}: no strong content found, skipping")
        continue
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(img.width, right + padding)
    bottom = min(img.height, bottom + padding)
    cropped = img.crop((left, top, right, bottom))
    cropped.save(path)
    print(f"{path}: cropped to {cropped.size} (was {img.size}), bbox={bbox}")
