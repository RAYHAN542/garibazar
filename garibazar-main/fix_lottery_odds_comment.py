"""
Cosmetic fix only — no behavior change. The lottery draw logic has always
correctly used a 1-in-10 (10%) win chance (matching the UI text "1 in 10
people randomly win"), but two code comments incorrectly described it as
1-in-100 (1%). This just corrects those comments so the code is accurate
and not misleading for future edits.

Run this from the project root (where api/ lives):
    python3 fix_lottery_odds_comment.py
"""

FILE_PATH = "api/draw.ts"

REPLACEMENTS = [
    (
        '// জেতার সম্ভাবনা ঠিক ১০০ জনের মধ্যে ১ জন (১%)। ক্রিপ্টো-সিকিউর random ব্যবহার করা হচ্ছে\n// যাতে ক্লায়েন্ট সাইড থেকে ম্যানিপুলেট করা সম্ভব না হয় — পুরো ড্র সার্ভারেই হয়।',
        '// জেতার সম্ভাবনা ঠিক ১০ জনের মধ্যে ১ জন (১০%)। ক্রিপ্টো-সিকিউর random ব্যবহার করা হচ্ছে\n// যাতে ক্লায়েন্ট সাইড থেকে ম্যানিপুলেট করা সম্ভব না হয় — পুরো ড্র সার্ভারেই হয়।',
    ),
    (
        '// 4. Draw — exactly 1-in-100 (1%) chance, server-side crypto RNG\n    const roll = randomInt(0, WIN_CHANCE_DENOMINATOR); // 0..99',
        '// 4. Draw — exactly 1-in-10 (10%) chance, server-side crypto RNG\n    const roll = randomInt(0, WIN_CHANCE_DENOMINATOR); // 0..9',
    ),
]


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    changes = 0
    for old, new in REPLACEMENTS:
        if old in content:
            content = content.replace(old, new, 1)
            changes += 1
        else:
            print("⚠️  a pattern was not found (may already be fixed)")

    if changes == 0:
        print("[SKIP] No changes made — file may already be patched.")
        return

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Applied {changes} comment fix(es) to {FILE_PATH} (no behavior change)")


if __name__ == "__main__":
    main()
