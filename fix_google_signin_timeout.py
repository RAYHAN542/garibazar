"""
Fix: Google sign-in would sometimes show "Sign-in isn't responding..."
on the FIRST attempt, but succeed instantly on a second attempt right
after. This happened because the popup sign-in was given only 15
seconds before being treated as "blocked" — but the first attempt was
often still genuinely in progress (just slow), not actually blocked.
The retry succeeded fast because Google had already cached the session
from the near-complete first attempt.

Fix: increased the timeout from 15s to 30s, giving slow-but-legitimate
first attempts enough time to complete normally, before falling back
to the "try Chrome" guidance message.

Run this from the project root (where src/ lives):
    python3 fix_google_signin_timeout.py
"""

FILE_PATH = "src/components/AuthModal.tsx"

OLD_BLOCK = '''      const popupResult = signInWithPopup(auth, googleProvider);
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("popup-timeout")), 15000);
      });'''

NEW_BLOCK = '''      const popupResult = signInWithPopup(auth, googleProvider);
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("popup-timeout")), 30000);
      });'''


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_BLOCK not in content:
        print("[SKIP] Pattern not found — file may already be patched.")
        return

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Increased Google sign-in popup timeout to 30s in {FILE_PATH}")


if __name__ == "__main__":
    main()
