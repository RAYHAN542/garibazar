with open("src/App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

target_line = 1681  # </header> line (1-indexed)
idx = target_line  # insert after this line

mobile_header = '''
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800 shadow-xs">
        <div className="flex justify-between items-center px-4 h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab("market")}>
            <span className="text-2xl">\U0001F69C</span>
            <div className="flex flex-col leading-none">
              <h1 className="text-lg font-black tracking-tight text-slate-850 dark:text-white">
                {language === "bn" ? "\u0997\u09be\u09dc\u09bf \u09ac\u09be\u099c\u09be\u09b0" : "Gari Bazar"}
              </h1>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                \U0001F4CD {language === "bn" ? "\u09a2\u09be\u0995\u09be, \u09ac\u09be\u0982\u09b2\u09be\u09a6\u09c7\u09b6" : "Dhaka, Bangladesh"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotificationPrompt(true)}
              className="relative p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">3</span>
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
'''

lines.insert(idx, mobile_header)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Mobile header added successfully")
