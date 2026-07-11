with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = '''                    )}
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* 5. Footer with credit/disclaimers */}
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 text-xs py-8 pb-28 md:pb-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="flex items-center gap-1.5 justify-center text-slate-300 font-bold">
            <Car className="w-4 h-4 text-amber-500" />
            <span>{language === "bn" ? "গাড়ি বাজার লিমিটেড" : "Gari Bazar Auto Parts Marketplace"}</span>
          </div>
          <p className="max-w-md mx-auto leading-relaxed text-[11px] text-slate-400">
            {language === "bn" 
              ? "গাড়ি ও বাইকের অরিজিনাল জেনুইন খুচরা যন্ত্রাংশের বিশ্বস্ত বাজার। স্পন্সরড বিজ্ঞাপনদাতাদের জন্য উন্নত অ্যাড ক্যাম্পেইন ও AI ডেসক্রিপশন জেনারেটর ইঞ্জিন।" 
              : "Bangladesh's premium online car parts marketplace. Boost your listings with secure, real-time sponsored ad placements."}
          </p>
          <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2">
            <span>© 2026 Gari Bazar Tech</span>
            <span>•</span>
            <button 
              onClick={() => setIsLegalOpen(true)}
              className="hover:text-amber-500 font-bold underline transition-colors cursor-pointer"
            >
              {language === "bn" ? "🔒 আইনি পলিসি ও প্রাইভেসি কেন্দ্র" : "🔒 Legal Policies & Privacy Hub"}
            </button>
          </div>
        </div>
      </footer>

'''

new = '''                    )}
                  </div>

                </div>

                {/* Footer info moved into Profile page */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm text-center space-y-3">
                  <div className="flex items-center gap-1.5 justify-center text-slate-700 dark:text-slate-300 font-bold">
                    <Car className="w-4 h-4 text-amber-500" />
                    <span className="text-xs">{language === "bn" ? "গাড়ি বাজার লিমিটেড" : "Gari Bazar Auto Parts Marketplace"}</span>
                  </div>
                  <p className="max-w-md mx-auto leading-relaxed text-[11px] text-slate-500 dark:text-slate-400">
                    {language === "bn" 
                      ? "গাড়ি ও বাইকের অরিজিনাল জেনুইন খুচরা যন্ত্রাংশের বিশ্বস্ত বাজার। স্পন্সরড বিজ্ঞাপনদাতাদের জন্য উন্নত অ্যাড ক্যাম্পেইন ও AI ডেসক্রিপশন জেনারেটর ইঞ্জিন।" 
                      : "Bangladesh's premium online car parts marketplace. Boost your listings with secure, real-time sponsored ad placements."}
                  </p>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2">
                    <span>© 2026 Gari Bazar Tech</span>
                    <span>•</span>
                    <button 
                      onClick={() => setIsLegalOpen(true)}
                      className="hover:text-amber-500 font-bold underline transition-colors cursor-pointer"
                    >
                      {language === "bn" ? "🔒 আইনি পলিসি ও প্রাইভেসি কেন্দ্র" : "🔒 Legal Policies & Privacy Hub"}
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

'''

count = content.count(old)
if count == 0:
    print("NOT FOUND - pattern did not match")
else:
    content = content.replace(old, new)
    with open("src/App.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Replaced {count} occurrence(s) successfully.")
