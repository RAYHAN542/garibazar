"""
Fix: public/.well-known/assetlinks.json had package_name set to
"com.garibazar.app", but the Google Play Store package built via
PWABuilder uses Package ID "shop.garibazar.twa". These must match
exactly, or Android's Digital Asset Links verification will fail and
the installed app will show the browser's URL bar instead of looking
like a proper full-screen app.

NOTE: You still need to manually update sha256_cert_fingerprints in
this same file with the real SHA256 fingerprint from your NEW signing
key, once PWABuilder generates it after you tap "Download Package".

Run this from the project root (where public/ lives):
    python3 fix_assetlinks_package_name.py
"""

FILE_PATH = "public/.well-known/assetlinks.json"

OLD_LINE = '      "package_name": "com.garibazar.app",'
NEW_LINE = '      "package_name": "shop.garibazar.twa",'


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_LINE not in content:
        print("[SKIP] Pattern not found — file may already be patched.")
        return

    content = content.replace(OLD_LINE, NEW_LINE, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Fixed package_name in {FILE_PATH}")
    print("Reminder: still update sha256_cert_fingerprints with your real signing key fingerprint.")


if __name__ == "__main__":
    main()
