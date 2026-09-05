# -*- coding: utf-8 -*-
"""
Repo cleanup - deletes 19 leftover one-time patch scripts / scratch files
that accumulated at the repo root from earlier `git add -A` commits
(~584KB), plus 1 confirmed-unused image (src/assets/images/vehicle-banner.jpg,
36KB, not imported anywhere).

Also updates .gitignore so future patch scripts (fix_*.py, apply_*.py,
patch_*.py) and stray .zip files don't get committed by accident again.

NOT touched: api/auth/send-otp.ts - it looks unused (nothing in the
frontend calls it) but might be part of an unfinished phone-OTP feature,
so it's left alone pending confirmation.

Run from the root of your repo (where src/App.tsx lives):
    python cleanup_dead_files.py
"""
import base64, os

DELETES = [
    'fix_ad_pricing.py',
    'fix_excavator_filter.py',
    'patch_phase4_google_facebook_auth.py',
    'vercel.json.zip',
    'fix_star_badge.py',
    'fix_promoted_slider_cleanup.py',
    'fix_eye_star_badge_icon_only.py',
    'app-refactor-part1.zip',
    'fix_hardening_batch.py',
    'apply_remaining_perf_fixes.py',
    'fix_cloudinary_full.txt',
    'fix_auto_load_empty_filter.py',
    'fix_eye_star_badge.py',
    'resolve_conflict_command.txt',
    'fix_listingcard_full.txt',
    'fix_eye_star_badge_small.py',
    'fix_typescript_build_errors.py',
    'apply_safe_audit_fixes.py',
    'fix_card_aspect_ratio.py',
    'src/assets/images/vehicle-banner.jpg',
]

GITIGNORE_B64 = """
bm9kZV9tb2R1bGVzLwpidWlsZC8KZGlzdC8KY292ZXJhZ2UvCi5EU19TdG9yZQoqLmxvZwouZW52KgohLmVudi5leGFtcGxlCi5l
bnYubG9jYWwKZmlyZWJhc2UtYXBwbGV0LWNvbmZpZy5qc29uCmFyY2hpdmUvCnNyYy8qKi8qLnR4dAoudmVyY2VsCgojIEFuZHJv
aWQg4Ka44Ka+4KaH4Kao4Ka/4KaCIOCmleCngCDigJQg4KaV4KaW4Kao4KeL4KaHIEdpdEh1Yi3gpo8g4Kaq4Ka+4Kas4Kay4Ka/
4Ka2IOCmleCmsOCmviDgpq/gpr7gpqzgp4cg4Kao4Ka+LCDgprbgp4Hgpqfgp4EgR2l0SHViIFNlY3JldHMt4KaPIOCmpeCmvuCm
leCmrOCnhwoqLmtleXN0b3JlCiouamtzCmtleXN0b3JlLWJhc2U2NC50eHQKYW5kcm9pZC9hcHAvZ2FyaWJhemFyLXJlbGVhc2Uu
a2V5c3RvcmUKYW5kcm9pZC9sb2NhbC5wcm9wZXJ0aWVzCgojIOCmj+CmleCmrOCmvuCmsCDgpqzgp43gpq/gpqzgprngpr7gprDg
pq/gp4vgppfgp43gpq8gcGF0Y2ggc2NyaXB0L+CmuOCnjeCmleCnjeCmsOCnjeCmr+CmvuCmmiDgpqvgpr7gpofgprIg4oCUIOCm
reCmrOCmv+Cmt+CnjeCmr+CmpOCnhyDgpq3gp4HgprLgp4cgY29tbWl0IOCmueCmk+Cmr+CmvOCmviDgpqDgp4fgppXgpr7gpqTg
p4cKZml4XyoucHkKYXBwbHlfKi5weQpwYXRjaF8qLnB5CiouemlwCiFhbmRyb2lkLyoqLyouemlwCnJlc29sdmVfY29uZmxpY3Rf
Y29tbWFuZC50eHQK
"""


for path in DELETES:
    if os.path.exists(path):
        os.remove(path)
        print("Deleted:", path)
    else:
        print("Already gone (skip):", path)

gitignore_content = base64.b64decode(GITIGNORE_B64.strip()).decode("utf-8")
with open(".gitignore", "w", encoding="utf-8") as f:
    f.write(gitignore_content)
print("Updated: .gitignore")

print()
print("Done. Repo cleaned up (~620KB removed).")
