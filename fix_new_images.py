with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    (
        'import vehicleCardImg from "./assets/images/vehicle-banner.jpg";',
        'import vehicleCardImg from "./assets/images/vehicle-card-new.png";'
    ),
    (
        'import partsCardImg from "./assets/images/parts-card.png";',
        'import partsCardImg from "./assets/images/parts-card-new.png";'
    ),
]

missing = []
for old, new in replacements:
    count = content.count(old)
    if count == 0:
        missing.append(old)
    else:
        content = content.replace(old, new)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

if missing:
    print("NOT FOUND (check manually):")
    for m in missing:
        print(" -", m)
else:
    print("All patterns matched and replaced successfully.")
