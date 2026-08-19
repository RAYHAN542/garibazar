"""
Fix: Even though the Google/Facebook sign-in popup fix is already in the
code, phones were still hitting the OLD broken behavior (signInWithRedirect
"missing initial state" error) because the browser/PWA had cached the
OLD JavaScript bundle from before that fix was deployed.

This project's service worker (public/sw.js) caches JS/CSS for speed, but
it only drops old cached files when CACHE_NAME changes. Bumping the
version forces every visitor's browser to discard the stale cache and
fetch the current, fixed bundle on their next visit.

Run this from the project root (where public/ lives):
    python3 fix_bump_service_worker_cache.py
"""

FILE_PATH = "public/sw.js"

OLD_LINE = "const CACHE_NAME = 'gari-bazar-v2';"
NEW_LINE = "const CACHE_NAME = 'gari-bazar-v3';"


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_LINE not in content:
        print("[SKIP] Expected cache version string not found — it may already be bumped.")
        print("       If you need another bump, just increase the version number manually")
        print("       in public/sw.js (e.g. v3 -> v4) and redeploy.")
        return

    content = content.replace(OLD_LINE, NEW_LINE, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Bumped service worker cache version in {FILE_PATH} (v2 -> v3)")
    print("After deploying, ask testers to fully close and reopen the app/browser tab once")
    print("so the new service worker can take over.")


if __name__ == "__main__":
    main()
