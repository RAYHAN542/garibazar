"""
Temporarily hides Google sign-in from the auth modal (per request), since
it wasn't working reliably from Facebook's in-app browser (a Google-side
restriction on embedded browsers, not something fixable in this app's
code) and the person wants it hidden for now.

Only "Continue with Phone" will show. The Google sign-in logic
(handleGoogleSignIn, openInChrome, isInAppBrowser detection) is left
intact in the code — just not rendered — so it can be re-enabled easily
later if needed.

Run this from the project root (where src/ lives):
    python3 fix_hide_google_signin.py
"""

FILE_PATH = "src/components/AuthModal.tsx"

OLD_BLOCK = '''            {isInAppBrowser && (
              <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-xs text-center space-y-2">
                <p>
                  {language === "bn"
                    ? "এই ব্রাউজারে Google সাইন-ইন কাজ নাও করতে পারে। মোবাইল নম্বর দিয়ে সাইন-ইন করুন, অথবা Chrome-এ খুলুন।"
                    : "Google sign-in may not work in this browser. Use your phone number, or open in Chrome."}
                </p>
                <button
                  type="button"
                  onClick={openInChrome}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs"
                >
                  {language === "bn" ? "Chrome-এ খুলুন" : "Open in Chrome"}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 border border-slate-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white dark:border-slate-700"
            >
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <GoogleIcon />}
              </span>
              {language === "bn" ? "Google দিয়ে চালিয়ে যান" : "Continue with Google"}
            </button>
            <button
              type="button"
              onClick={() => { setError(""); setStep("phone"); }}
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 border border-slate-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white dark:border-slate-700"
            >
              <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow-sm">
                <Phone className="w-4 h-4 text-slate-900" />
              </span>
              {language === "bn" ? "মোবাইল নম্বর দিয়ে চালিয়ে যান" : "Continue with Phone"}
            </button>
          </div>
        ) : step === "phone" ? ('''

NEW_BLOCK = '''            {/* Google sign-in আপাতত hide করা আছে (Facebook in-app browser থেকে
                কাজ করছিল না — Google-এর নিজস্ব নিরাপত্তা নীতির কারণে)। শুধু
                handleGoogleSignIn / openInChrome / isInAppBrowser এখনো কোডে
                রাখা হয়েছে, পরে দরকার হলে সহজেই আবার চালু করা যাবে। */}
            <button
              type="button"
              onClick={() => { setError(""); setStep("phone"); }}
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 border border-slate-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white dark:border-slate-700"
            >
              <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow-sm">
                <Phone className="w-4 h-4 text-slate-900" />
              </span>
              {language === "bn" ? "মোবাইল নম্বর দিয়ে চালিয়ে যান" : "Continue with Phone"}
            </button>
          </div>
        ) : step === "phone" ? ('''


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_BLOCK not in content:
        print("[SKIP] Pattern not found — file may already be patched.")
        return

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Hid Google sign-in button in {FILE_PATH}. Only Phone sign-in shows now.")


if __name__ == "__main__":
    main()
