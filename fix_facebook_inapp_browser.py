path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes_applied = 0

# --- Change 1: add state for the in-app browser banner ---
old1 = """  const [isStandalonePrivacy, setIsStandalonePrivacy] = useState(false);
  const [isStandaloneDeletion, setIsStandaloneDeletion] = useState(false);

  // Synchronize saved Listing IDs from localStorage when activeTab shifts or selectedListing toggles"""

new1 = """  const [isStandalonePrivacy, setIsStandalonePrivacy] = useState(false);
  const [isStandaloneDeletion, setIsStandaloneDeletion] = useState(false);
  const [showInAppBrowserBanner, setShowInAppBrowserBanner] = useState(false);

  // Synchronize saved Listing IDs from localStorage when activeTab shifts or selectedListing toggles"""

if old1 in content:
    content = content.replace(old1, new1, 1)
    changes_applied += 1
    print("[OK] Added showInAppBrowserBanner state")
else:
    print("[SKIP] State block pattern not found (maybe already patched)")

# --- Change 2: detect FB/IG/Messenger in-app browser + push a history anchor ---
old2 = """  const activeTranslations = translations[language];

  // Ref to track if we pushed a modal state
  const modalHistoryRef = useRef<boolean>(false);"""

new2 = """  const activeTranslations = translations[language];

  // Detect Facebook / Instagram / Messenger's built-in in-app browser.
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

  // Push one harmless "anchor" history entry as soon as the app boots, before
  // any modal ever opens. This guarantees there is always at least one extra
  // step of same-site history underneath any modal's pushState, so a single
  // back press never has a chance of falling straight through to whatever
  // was open before the site (e.g. the Facebook feed).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState({ garibazarAnchor: true, ...window.history.state }, "");
  }, []);

  // Ref to track if we pushed a modal state
  const modalHistoryRef = useRef<boolean>(false);"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    changes_applied += 1
    print("[OK] Added in-app browser detection + history anchor effects")
else:
    print("[SKIP] Back-button effect pattern not found (maybe already patched)")

# --- Change 3: show a banner telling the visitor to open in a real browser ---
old3 = """      {/* Offline Alert Banner in Bengali */}
      {isOffline && ("""

new3 = """      {/* Facebook/Instagram in-app browser notice -- their own back button often
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

      {/* Offline Alert Banner in Bengali */}
      {isOffline && ("""

if old3 in content:
    content = content.replace(old3, new3, 1)
    changes_applied += 1
    print("[OK] Added the 'Open in Browser' banner UI")
else:
    print("[SKIP] Offline banner pattern not found (maybe already patched)")

if changes_applied > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[DONE] Applied {changes_applied}/3 fix(es) to {path}")
else:
    print("[NOTHING TO DO] No patterns matched -- file may already be fully patched, or has changed structure. Check manually.")
