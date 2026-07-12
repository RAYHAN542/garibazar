#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Post-Ad form UX/visual fix:

1. Moves the "কার পার্টস" / "গাড়ি ও হেভি ইকুইপমেন্ট" tab toggle from ABOVE
   the image upload box to BELOW it, so people naturally start by adding
   photos first and don't skip past the category choice.
2. Redesigns the toggle from two plain text tabs into two bordered cards
   with icons, using the same amber (vehicle) / sky-blue (part) color
   language already used for badges elsewhere in the app (ListingCard.tsx),
   with a small check-badge on the selected card.

Run from the project root (the folder containing `src/`):
    python3 fix_form_tabs_layout.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "components" / "AddPartForm.tsx"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD_IMPORT = 'import { Camera, Loader2, AlertTriangle, X } from "lucide-react";'
NEW_IMPORT = 'import { Camera, Loader2, AlertTriangle, X, Check } from "lucide-react";'

OLD_BLOCK = '''  return (
    <div className="max-w-2xl mx-auto bg-white p-4 rounded-xl shadow-sm">
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
        <button type="button" onClick={() => { setActiveTab("part"); setError(null); }} className={`flex-1 py-2 rounded-md font-medium text-sm flex items-center justify-center gap-2 ${activeTab === "part" ? "bg-white text-orange-600 shadow-sm" : "text-gray-600"}`}>
          🔧 {language === "bn" ? "কার পার্টস কেনা/বেচা" : "Car Parts"}
        </button>
        <button type="button" onClick={() => { setActiveTab("vehicle"); setError(null); }} className={`flex-1 py-2 rounded-md font-medium text-sm flex items-center justify-center gap-2 ${activeTab === "vehicle" ? "bg-white text-orange-600 shadow-sm" : "text-gray-600"}`}>
          🚜 {language === "bn" ? "গাড়ি ও হেভি ইকুইপমেন্ট" : "Vehicles & Heavy Equipment"}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {activeTab === "part" ? (language === "bn" ? "১. পার্টস এর ছবি (সর্বোচ্চ ৫টি পিক অ্যাড করুন) *" : "1. Part Images (Max 5) *") : (language === "bn" ? "১. গাড়ি বা যন্ত্রপাতির ছবি (সর্বোচ্চ ৫টি পিক অ্যাড করুন) *" : "1. Vehicle Images (Max 5) *")}
          </label>'''

NEW_BLOCK = '''  return (
    <div className="max-w-2xl mx-auto bg-white p-4 rounded-xl shadow-sm">
      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {activeTab === "part" ? (language === "bn" ? "১. পার্টস এর ছবি (সর্বোচ্চ ৫টি পিক অ্যাড করুন) *" : "1. Part Images (Max 5) *") : (language === "bn" ? "১. গাড়ি বা যন্ত্রপাতির ছবি (সর্বোচ্চ ৫টি পিক অ্যাড করুন) *" : "1. Vehicle Images (Max 5) *")}
          </label>'''

OLD_AFTER_FILE_INPUT = '''          <input type="file" ref={fileInputRef} onChange={handleImageSelect} multiple accept="image/*" className="hidden" />
        </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{language === "bn" ? "১. মূল্য (BDT) *" : "1. Price (BDT) *"}</label>'''

NEW_AFTER_FILE_INPUT = '''          <input type="file" ref={fileInputRef} onChange={handleImageSelect} multiple accept="image/*" className="hidden" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setActiveTab("part"); setError(null); }}
            className={`relative rounded-2xl border-2 px-3 py-3.5 flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "part" ? "border-sky-500 bg-sky-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            {activeTab === "part" && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
            )}
            <span className="text-2xl leading-none">🔧</span>
            <span className={`text-xs font-bold text-center leading-tight ${activeTab === "part" ? "text-sky-700" : "text-gray-500"}`}>
              {language === "bn" ? "কার পার্টস কেনা/বেচা" : "Car Parts"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("vehicle"); setError(null); }}
            className={`relative rounded-2xl border-2 px-3 py-3.5 flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "vehicle" ? "border-amber-500 bg-amber-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            {activeTab === "vehicle" && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
            )}
            <span className="text-2xl leading-none">🚜</span>
            <span className={`text-xs font-bold text-center leading-tight ${activeTab === "vehicle" ? "text-amber-700" : "text-gray-500"}`}>
              {language === "bn" ? "গাড়ি ও হেভি ইকুইপমেন্ট" : "Vehicles & Heavy Equipment"}
            </span>
          </button>
        </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{language === "bn" ? "১. মূল্য (BDT) *" : "1. Price (BDT) *"}</label>'''


def main():
    if not TARGET.exists():
        print(f"[SKIP] file not found at {TARGET}")
        return

    text = nfc(TARGET.read_text(encoding="utf-8"))
    changed = False

    if nfc(OLD_IMPORT) in text:
        text = text.replace(nfc(OLD_IMPORT), nfc(NEW_IMPORT), 1)
        changed = True
        print("[OK] added Check icon import")
    else:
        print("[WARN] import line not found / already patched")

    if nfc(OLD_BLOCK) in text:
        text = text.replace(nfc(OLD_BLOCK), nfc(NEW_BLOCK), 1)
        changed = True
        print("[OK] removed old tab toggle from top of form")
    else:
        print("[WARN] top block not found / already patched")

    if nfc(OLD_AFTER_FILE_INPUT) in text:
        text = text.replace(nfc(OLD_AFTER_FILE_INPUT), nfc(NEW_AFTER_FILE_INPUT), 1)
        changed = True
        print("[OK] inserted redesigned tab toggle below the image upload box")
    else:
        print("[WARN] insertion point not found / already patched")

    if changed:
        TARGET.write_text(text, encoding="utf-8")
        print("[DONE] AddPartForm.tsx updated")
    else:
        print("[SKIP] nothing changed")


if __name__ == "__main__":
    main()
