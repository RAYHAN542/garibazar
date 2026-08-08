"""
Fix: "Free Boost Lottery" spin crashed with:
  Failed to execute 'json' on 'Response': Unexpected end of JSON input

Root cause: the client called fetch("/api/lottery/draw"), but the actual
serverless function lives at api/draw.ts, which Vercel exposes as
"/api/draw" — NOT "/api/lottery/draw". Since that path doesn't exist,
the request fell through to the SPA's catch-all rewrite (index.html)
instead of reaching the real lottery function, so there was no valid
JSON to parse.

Also made response parsing resilient: if the server ever returns a
non-JSON or empty response again in the future (e.g. a routing hiccup,
a cold-start timeout), the user now sees a clear retry message instead
of a raw JS parsing crash.

Run this from the project root (where src/ lives):
    python3 fix_lottery_spin_crash.py
"""

FILE_PATH = "src/components/LotteryModal.tsx"

OLD_BLOCK = '''      const res = await fetch("/api/lottery/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ listingId: activeListingId }),
      });
      const data = await res.json();'''

NEW_BLOCK = '''      const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ listingId: activeListingId }),
      });

      let data: any = {};
      try {
        const raw = await res.text();
        data = raw ? JSON.parse(raw) : {};
      } catch (parseErr) {
        throw new Error(
          language === "bn"
            ? "সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি। একটু পর আবার চেষ্টা করুন।"
            : "Got an unexpected response from the server. Please try again shortly."
        );
      }'''


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_BLOCK not in content:
        print("[SKIP] Pattern not found — file may already be patched.")
        return

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Fixed lottery spin API URL + resilient JSON parsing in {FILE_PATH}")


if __name__ == "__main__":
    main()
