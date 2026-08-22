"""
Fix: Sometimes the Android back button needed to be pressed twice, and
the page would briefly hang/freeze, after closing a modal (like a
listing detail view) via its X button.

Root cause: when a modal was closed via the X button (not the physical
back button), the code called window.history.back() to clean up the
extra history entry it had pushed when the modal opened. But
history.back() is asynchronous and fires its own popstate event. If the
person pressed the real back button around the same time, two popstate
events could race each other, occasionally leaving the synthetic
history bookkeeping in an inconsistent state — requiring an extra press
to recover.

Fix: instead of calling history.back() (which navigates and fires an
event), the current history entry is now updated in place with
replaceState to mark it as "modal already closed" — no navigation, no
event, no race. The entry still gets consumed normally the next time
the person actually presses back.

Run this from the project root (where src/ lives):
    python3 fix_back_button_race.py
"""

FILE_PATH = "src/App.tsx"

OLD_BLOCK = '''    } else {
      if (modalHistoryRef.current) {
        modalHistoryRef.current = false;
        window.history.back();
      }
    }'''

NEW_BLOCK = '''    } else {
      if (modalHistoryRef.current) {
        modalHistoryRef.current = false;
        // আগে এখানে window.history.back() কল করা হতো, যেটা নিজেই একটা popstate
        // ইভেন্ট ট্রিগার করত (async)। ইউজার যদি ঠিক তখনই আসল ব্যাক বাটনও চাপে,
        // দুটো popstate একসাথে race করে "দুইবার ব্যাক চাপা লাগে, তারপর hang"
        // সমস্যা তৈরি করত। এখন শুধু বর্তমান entry-টাকে replaceState দিয়ে
        // "consumed" হিসেবে চিহ্নিত করা হচ্ছে — কোনো navigation বা event ছাড়াই,
        // তাই কোনো race থাকবে না।
        window.history.replaceState({ ...window.history.state, modalOpen: false }, "");
      }
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

    print(f"[OK] Fixed back-button race condition in {FILE_PATH}")


if __name__ == "__main__":
    main()
