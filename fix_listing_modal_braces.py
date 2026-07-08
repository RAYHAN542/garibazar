with open("src/components/ListingDetailModal.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = None
for i, line in enumerate(lines):
    if line.strip() == "{addToDashboardSuccess ? (":
        start_idx = i
        break

if start_idx is None:
    print("ERROR: could not find addToDashboardSuccess anchor")
    raise SystemExit(1)

fix1_done = False
for i in range(start_idx, min(start_idx + 30, len(lines) - 1)):
    if lines[i].strip() == ")}" and lines[i + 1].strip() == ") : (":
        del lines[i]
        fix1_done = True
        print(f"OK: removed stray closing brace line (fix 1) near original line {i+1}")
        break

if not fix1_done:
    print("INFO: fix 1 pattern not found (may already be fixed)")

fix2_done = False
for i in range(start_idx, min(start_idx + 40, len(lines) - 4)):
    if (lines[i].strip() == "</button>"
        and lines[i + 1].strip() == ")}"
        and lines[i + 2].strip() == "</div>"):
        j = i + 3
        k = j
        while k < len(lines) and lines[k].strip() == "":
            k += 1
        if k < len(lines) and lines[k].strip() == "{!isOwner && (":
            indent = "              "
            lines.insert(i + 3, indent + ")}\n")
            fix2_done = True
            print(f"OK: inserted missing outer closing brace (fix 2) near original line {i+3}")
        else:
            print("INFO: fix 2 not needed, structure already closed correctly")
        break

if not fix2_done and fix1_done:
    print("WARNING: fix 2 pattern not matched, please double check manually")

with open("src/components/ListingDetailModal.tsx", "w", encoding="utf-8") as f:
    f.writelines(lines)

print("DONE: patch applied, please run npm run build to verify")
