#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Item 11 - guest support ticket spam.

api/submit-support-ticket.ts already rate-limits properly (IP for guests,
uid for signed-in users) and its own comment says firestore.rules locks
support_tickets to admin-only writes - but the actual rule still allowed
direct client writes. That meant anyone could just skip the rate-limited
API entirely and write straight to Firestore to spam tickets. This locks
the rule down to match what the API comment already claims.

Run from the project root (the folder containing `src/`):
    python3 lock_support_tickets_rule.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def patch(path: Path, replacements, label):
    if not path.exists():
        print(f"[SKIP] {label}: file not found at {path}")
        return
    text = nfc(path.read_text(encoding="utf-8"))
    changed = False
    for old, new in replacements:
        old_n, new_n = nfc(old), nfc(new)
        if old_n not in text:
            print(f"[WARN] {label}: expected snippet not found, skipping one replacement")
            continue
        text = text.replace(old_n, new_n, 1)
        changed = True
    if changed:
        path.write_text(text, encoding="utf-8")
        print(f"[OK] {label}: patched")
    else:
        print(f"[SKIP] {label}: nothing changed")


patch(
    ROOT / "firestore.rules",
    [(
        '''    match /support_tickets/{ticketId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if (isSignedIn() && request.resource.data.userId == request.auth.uid) ||
                    (!isSignedIn() && request.resource.data.userId == "guest");
      allow update, delete: if isAdmin();
    }''',
        '''    // Written only by /api/submit-support-ticket (Admin SDK), which applies
    // real rate limiting (per-IP for guests, per-uid for signed-in users) --
    // a rule alone can't rate-limit an anonymous guest, so this closes the
    // direct-write path that would otherwise bypass that limit entirely.
    match /support_tickets/{ticketId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if false;
      allow update, delete: if isAdmin();
    }''',
    )],
    "firestore.rules (item 11: lock support_tickets to server-only writes)",
)

print("\n[DONE] Item 11 fixed. Deploy with: firebase deploy --only firestore:rules")
