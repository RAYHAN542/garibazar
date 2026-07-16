path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState({ garibazarAnchor: true, ...window.history.state }, "");
  }, []);"""

new = """  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState({ garibazarAnchor: true, ...window.history.state }, "");
    // Also push one extra buffer entry right away. Without this, a fresh page
    // load (e.g. arriving via a shared Facebook link) starts with only ONE
    // history entry -- so the very first back-button/gesture press after
    // opening a listing can land right on the edge of the stack and some
    // Android back-gesture implementations close the whole tab/app instead
    // of stepping back within the page. This buffer entry gives every
    // modal's pushState a safe extra step of room underneath it.
    window.history.pushState({ garibazarHome: true }, "");
  }, []);"""

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Added history buffer entry at app boot")
    print("[DONE] Applied 1/1 change(s) to src/App.tsx")
    print("       Back button/gesture should no longer exit the app right")
    print("       after opening a post -- it will close the post instead.")
else:
    print("[SKIP] Anchor history effect pattern not found -- check manually")
