"""
Fix: public/.well-known/assetlinks.json still had a placeholder value
for sha256_cert_fingerprints. This updates it with the REAL fingerprint
from the signing key PWABuilder generated for the Google Play package
(found inside the downloaded package's assetlinks.json).

This is required for Android's Digital Asset Links verification to
pass — without a matching fingerprint, the installed app will show the
browser's URL bar instead of behaving like a proper full-screen app.

Run this from the project root (where public/ lives):
    python3 fix_assetlinks_fingerprint.py
"""

FILE_PATH = "public/.well-known/assetlinks.json"

OLD_BLOCK = '''      "sha256_cert_fingerprints": [
        "YOUR_REAL_PLAY_CONSOLE_SHA256_FINGERPRINT"
      ]'''

NEW_BLOCK = '''      "sha256_cert_fingerprints": [
        "EF:F9:F7:C5:E8:A3:73:04:E3:8D:84:A0:F0:E6:E5:32:97:45:8A:41:A3:94:F2:FC:13:02:03:71:00:6A:55:FB"
      ]'''


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_BLOCK not in content:
        if "EF:F9:F7:C5:E8:A3:73:04" in content:
            print("[SKIP] Fingerprint already set — file may already be patched.")
        else:
            print("[SKIP] Expected placeholder not found — please check the file manually.")
        return

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Updated sha256_cert_fingerprints in {FILE_PATH} with the real signing key fingerprint.")


if __name__ == "__main__":
    main()
