path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# --- 1. Include the initial tab in the boot buffer entry ---
old1 = """    window.history.pushState({ garibazarHome: true }, "");
  }, []);"""

new1 = """    window.history.pushState({ garibazarHome: true, garibazarTab: activeTab }, "");
  }, []);

  // Track tab switches (মার্কেট / বিক্রি / ড্যাশবোর্ড / চ্যাট / প্রোফাইল) in the
  // browser's back-button history too, not just modals. Without this, the
  // back button had no idea which tab you were on -- so it always fell
  // straight through to the very first/home state instead of stepping back
  // through the tabs you'd actually visited.
  const tabHistoryRef = useRef<string>(activeTab);
  const isRestoringTabRef = useRef(false);

  useEffect(() => {
    if (tabHistoryRef.current === activeTab) return;
    tabHistoryRef.current = activeTab;
    if (isRestoringTabRef.current) {
      // This tab change came from a back-button press (see popstate handler
      // below), not a fresh tap -- don't push another entry for it.
      isRestoringTabRef.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    window.history.pushState({ garibazarTab: activeTab }, "");
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleTabPopState = (event: PopStateEvent) => {
      const state = event.state as { garibazarTab?: string } | null;
      if (state && typeof state.garibazarTab === "string") {
        isRestoringTabRef.current = true;
        setActiveTab(state.garibazarTab as typeof activeTab);
      }
    };
    window.addEventListener("popstate", handleTabPopState);
    return () => window.removeEventListener("popstate", handleTabPopState);
  }, []);"""

if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("[OK] Added tab-level back-button history tracking")
else:
    print("[SKIP] Boot buffer pattern not found -- did fix_back_button_history_buffer.py run first?")

if changes > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[DONE] Applied {changes}/1 change(s) to {path}")
    print("       Back button now steps back through the tabs (মার্কেট/বিক্রি/")
    print("       ড্যাশবোর্ড/চ্যাট/প্রোফাইল) you actually visited, instead of")
    print("       always jumping straight to the home tab.")
else:
    print("[NOTHING TO DO] No patterns matched -- check manually.")
