#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Re-applies item 8 (purchases create rule sellerId/price validation) to
firestore.rules - this got lost when an older copy of the file was pasted
in over it. Only touches the `purchases` match block; doesn't touch
anything else (seller_reviews, counterShards/track-listing-interaction,
etc. all stay exactly as they are now).

Run from the project root (the folder containing `src/`):
    python3 reapply_item8_purchases_rule.py
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
        '''    match /purchases/{purchaseId} {
      allow read: if isSignedIn() && (resource.data.buyerId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() && request.resource.data.buyerId == request.auth.uid;
      allow update, delete: if isAdmin();
    }''',
        '''    match /purchases/{purchaseId} {
      allow read: if isSignedIn() && (resource.data.buyerId == request.auth.uid || isAdmin());
      // sellerId and price must match the real listing doc - stops a
      // tampered client request from recording a fake price/seller.
      allow create: if isSignedIn() &&
                    request.resource.data.buyerId == request.auth.uid &&
                    request.resource.data.listingId is string &&
                    get(/databases/$(database)/documents/listings/$(request.resource.data.listingId)).data.sellerId == request.resource.data.sellerId &&
                    get(/databases/$(database)/documents/listings/$(request.resource.data.listingId)).data.price == request.resource.data.price;
      allow update, delete: if isAdmin();
    }''',
    )],
    "firestore.rules (re-apply item 8: purchases sellerId/price validation)",
)

print("\n[DONE] Item 8 re-applied. Deploy with: firebase deploy --only firestore:rules")
