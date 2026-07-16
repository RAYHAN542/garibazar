path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """      {/* Facebook/Instagram in-app browser notice -- their own back button often
          exits the mini-browser instead of going back a step on the site. */}
      {showInAppBrowserBanner && (
        <div className="bg-amber-500 text-slate-900 text-[13px] py-2.5 px-4 flex items-center justify-between gap-2 sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 shrink-0" />
            <span>
              সেরা অভিজ্ঞতার জন্য এবং ব্যাক বাটন ঠিকমতো কাজ করার জন্য, উপরের ⋯ মেনু থেকে{" "}
              <b>"ব্রাউজারে খুলুন" (Open in Browser)</b> চাপুন।
            </span>
          </div>
          <button
            onClick={() => {
              setShowInAppBrowserBanner(false);
              try { sessionStorage.setItem("gari_bazar_hide_iab_banner", "1"); } catch {}
            }}
            className="shrink-0 p-1 hover:bg-amber-600/40 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
"""

new = """      {/* Facebook/Instagram in-app browser notice -- their own back button often
          exits the mini-browser instead of going back a step on the site.
          The button below opens Chrome directly on Android (one tap, no menus). */}
      {showInAppBrowserBanner && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[12px] py-1.5 px-3 flex items-center justify-between gap-2 sticky top-0 z-50">
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ভালোভাবে ব্যবহারের জন্য ব্রাউজারে খুলুন</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                const currentUrl = window.location.href;
                const isAndroid = /Android/i.test(navigator.userAgent || "");
                if (isAndroid) {
                  const urlNoScheme = currentUrl.replace(/^https?:\\/\\//, "");
                  window.location.href = `intent://${urlNoScheme}#Intent;scheme=https;package=com.android.chrome;end`;
                } else {
                  window.alert('উপরে ডান দিকের ⋯ মেনু থেকে "Open in Browser" চাপুন।');
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-600 text-white text-[11px] font-bold px-3 py-1 rounded-md transition-colors"
            >
              খুলুন
            </button>
            <button
              onClick={() => {
                setShowInAppBrowserBanner(false);
                try { sessionStorage.setItem("gari_bazar_hide_iab_banner", "1"); } catch {}
              }}
              className="p-1 hover:bg-amber-500/20 rounded-full transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
"""

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] App.tsx: banner redesigned -- slim single line + one-tap 'খুলুন' button")
    print("     that opens Chrome directly on Android (no menu-hunting needed).")
else:
    print("[SKIP] Old banner pattern not found -- did fix_facebook_inapp_browser.py run first?")
    print("       Run that one first if you haven't, then run this script.")
