path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

removed = 0

# --- Remove 1: the banner state ---
old1 = """  const [isStandaloneDeletion, setIsStandaloneDeletion] = useState(false);
  const [showInAppBrowserBanner, setShowInAppBrowserBanner] = useState(false);
"""
new1 = """  const [isStandaloneDeletion, setIsStandaloneDeletion] = useState(false);
"""
if old1 in content:
    content = content.replace(old1, new1, 1)
    removed += 1
    print("[OK] Removed showInAppBrowserBanner state")
else:
    print("[SKIP] State pattern not found (maybe already removed)")

# --- Remove 2: the FB/IG/Messenger detection effect (keep the history anchor effect) ---
old2 = """  // Detect Facebook / Instagram / Messenger's built-in in-app browser.
  // These in-app browsers have their OWN back button (top bar) that, on many
  // app versions, closes the mini-browser directly instead of asking the page
  // to go back one step in its JS history -- so our pushState/popstate modal
  // trick below can't intercept it. The reliable fix is to nudge the visitor
  // to open the site in their real browser (Chrome/Safari), where our back
  // button handling works normally.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(ua);
    if (isInAppBrowser && !sessionStorage.getItem("gari_bazar_hide_iab_banner")) {
      setShowInAppBrowserBanner(true);
    }
  }, []);

  // Push one harmless "anchor" history entry"""
new2 = """  // Push one harmless "anchor" history entry"""
if old2 in content:
    content = content.replace(old2, new2, 1)
    removed += 1
    print("[OK] Removed in-app browser detection effect (history-anchor fix kept)")
else:
    print("[SKIP] Detection effect pattern not found (maybe already removed)")

# --- Remove 3: the banner JSX block itself ---
marker = "      {/* Facebook/Instagram in-app browser notice"
start = content.find(marker)
if start != -1:
    end = content.find(")}\n", start) + len(")}\n")
    content = content[:start] + content[end:]
    removed += 1
    print("[OK] Removed the banner UI block")
else:
    print("[SKIP] Banner JSX not found (maybe already removed)")

if removed > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[DONE] Removed {removed}/3 piece(s). The banner + Chrome-redirect button are gone.")
    print("       The core back-button fix (history anchor + modal popstate handling) is untouched.")
else:
    print("[NOTHING TO DO] Nothing matched -- banner may already be removed.")
