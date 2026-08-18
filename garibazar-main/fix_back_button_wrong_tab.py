import os

changed_parts = []

path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = '''  // Ref to track if we pushed a modal state
  const modalHistoryRef = useRef<boolean>(false);

  // Intercept browser back button to close active modal instead of exiting the page/iframe
  useEffect(() => {
    const isAnyModalOpen = !!(isAuthOpen || selectedListing || promotingListing || editingListing || isRefillModalOpen || isLegalOpen || isLotteryOpen);

    const handlePopState = () => {
      modalHistoryRef.current = false;
      setIsAuthOpen(false);
      setSelectedListing(null);
      setPromotingListing(null);
      setEditingListing(null);
      setIsRefillModalOpen(false);
      setIsLegalOpen(false);
    };

    if (isAnyModalOpen) {
      if (!modalHistoryRef.current) {
        window.history.pushState({ modalOpen: true }, "");
        modalHistoryRef.current = true;
      }
      window.addEventListener("popstate", handlePopState);
    } else {
      if (modalHistoryRef.current) {
        modalHistoryRef.current = false;
        window.history.back();
      }
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isAuthOpen, selectedListing, promotingListing, editingListing, isRefillModalOpen, isLegalOpen, isLotteryOpen]);'''

new_block = '''  // Ref to track if we pushed a modal state
  const modalHistoryRef = useRef<boolean>(false);

  // Remembers which tab was active the moment a modal opened, so that
  // closing the modal via the back button always returns to THAT tab --
  // instead of trusting whichever tab happens to sit in the popped
  // history entry. This is a defensive fix: on longer, Load-More-extended
  // pages a stray/duplicate popstate (e.g. an Android edge back-gesture
  // firing while scrolling) could occasionally hand handleTabPopState a
  // stale tab from earlier in the session (e.g. Dashboard), landing the
  // user on the wrong tab after closing a listing. Explicitly restoring
  // the captured tab here overrides that regardless of the cause.
  const tabWhenModalOpenedRef = useRef<string | null>(null);

  // Intercept browser back button to close active modal instead of exiting the page/iframe
  useEffect(() => {
    const isAnyModalOpen = !!(isAuthOpen || selectedListing || promotingListing || editingListing || isRefillModalOpen || isLegalOpen || isLotteryOpen);

    const handlePopState = () => {
      modalHistoryRef.current = false;
      setIsAuthOpen(false);
      setSelectedListing(null);
      setPromotingListing(null);
      setEditingListing(null);
      setIsRefillModalOpen(false);
      setIsLegalOpen(false);
      if (tabWhenModalOpenedRef.current !== null) {
        isRestoringTabRef.current = true;
        setActiveTab(tabWhenModalOpenedRef.current as typeof activeTab);
        tabWhenModalOpenedRef.current = null;
      }
    };

    if (isAnyModalOpen) {
      if (!modalHistoryRef.current) {
        tabWhenModalOpenedRef.current = activeTab;
        window.history.pushState({ modalOpen: true }, "");
        modalHistoryRef.current = true;
      }
      window.addEventListener("popstate", handlePopState);
    } else {
      if (modalHistoryRef.current) {
        modalHistoryRef.current = false;
        window.history.back();
      }
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isAuthOpen, selectedListing, promotingListing, editingListing, isRefillModalOpen, isLegalOpen, isLotteryOpen]);'''

if "tabWhenModalOpenedRef" in content:
    changed_parts.append("already-patched")
elif old_block in content:
    content = content.replace(old_block, new_block, 1)
    changed_parts.append("back-button-fix")
else:
    print("[WARN] expected modal-history block not found in src/App.tsx — check manually")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("=== fix_back_button_wrong_tab.py রেজাল্ট ===")
print("Patched sections:", changed_parts)

if "back-button-fix" in changed_parts or "already-patched" in changed_parts:
    print("[OK] listing detail বন্ধ করলে এখন সবসময় যে ট্যাব থেকে খোলা হয়েছিল সেই ট্যাবেই ফিরে যাবে।")
else:
    print("[PARTIAL] ম্যানুয়ালি src/App.tsx-এর modal-history অংশ চেক করুন।")
