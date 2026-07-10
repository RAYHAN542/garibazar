with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = 'className="w-full h-24 object-contain mt-auto"'
new = 'className="w-full h-32 object-contain mt-auto"'

count = content.count(old)
if count == 0:
    print("NOT FOUND - pattern did not match")
else:
    content = content.replace(old, new)
    with open("src/App.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Replaced {count} occurrence(s) successfully.")

