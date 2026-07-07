with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = '''              <img
                src="https://images.unsplash.com/photo-1580901369630-a8ac6dae2313?w=300&auto=format&fit=crop&q=60"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="w-full h-16 object-contain object-bottom mt-auto"
                alt=""
              />
              <span className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm z-10">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              onClick={() => {'''

new = '''              <div className="grid grid-cols-5 gap-1 mt-auto">
                {[
                  { emoji: "\U0001F69C", label: language === "bn" ? "\u098f\u0995\u09cd\u09b8\u0995\u09cd\u09af\u09be\u09ad\u09c7\u099f\u09b0" : "Excavator" },
                  { emoji: "\U0001F69B", label: language === "bn" ? "\u099f\u09cd\u09b0\u09be\u0995" : "Truck" },
                  { emoji: "\U0001F697", label: language === "bn" ? "\u0995\u09be\u09b0" : "Car" },
                  { emoji: "\U0001F3D7\uFE0F", label: language === "bn" ? "\u0995\u09cd\u09b0\u09c7\u09a8" : "Crane" },
                  { emoji: "\U0001F68C", label: language === "bn" ? "\u09ac\u09be\u09b8" : "Bus" },
                ].map((sub, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className="text-base">{sub.emoji}</span>
                    <span className="text-[7px] font-bold text-amber-700/70 dark:text-amber-400/70 leading-none truncate w-full text-center">{sub.label}</span>
                  </div>
                ))}
              </div>
              <span className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm z-10">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              onClick={() => {'''

if old in content:
    content = content.replace(old, new)
    with open("src/App.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: vehicle banner image replaced with reliable icons")
else:
    print("ERROR: pattern not found, no changes made")
