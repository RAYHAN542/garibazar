import re

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Match <<<<<<< HEAD ... ======= ... >>>>>>> <hash>
# Keep only the HEAD side, drop the rest
pattern = re.compile(
    r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> [^\n]+\n',
    re.DOTALL
)

new_content, count = pattern.subn(lambda m: m.group(1) + "\n", content)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Resolved {count} conflict block(s).")

remaining = new_content.count("<<<<<<<") + new_content.count("=======") + new_content.count(">>>>>>>")
if remaining > 0:
    print(f"WARNING: {remaining} conflict marker lines still remain - check manually.")
else:
    print("No conflict markers remain.")
