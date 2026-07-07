with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# --- Step 1: Add the import for the local vehicle banner image ---
import_marker = 'import { MessageSquare, Cpu, SlidersHorizontal, Moon, Sun, Users, HelpCircle, Mail, FileText, ArrowRight, Menu } from "lucide-react";'
import_line = '\nimport vehicleBannerImg from "./assets/images/vehicle-banner.jpg";'

if 'import vehicleBannerImg from "./assets/images/vehicle-banner.jpg";' in content:
    print("INFO: vehicleBannerImg import already present, skipping import step")
elif import_marker in content:
    content = content.replace(import_marker, import_marker + import_line)
    print("OK: added vehicleBannerImg import")
else:
    print("ERROR: import marker not found, aborting")
    raise SystemExit(1)

# --- Step 2: Replace whichever prior banner content exists with the local image ---
new_block = '''              <img
                src={vehicleBannerImg}
                className="w-full h-20 object-cover object-center rounded-xl mt-auto"
                alt=""
              />'''

candidates = [
    # Case A: SUV + excavator combo (unsplash)
    '''              <div className="flex items-end gap-1 mt-auto -mb-1 h-16">
                <img
                  src="https://images.unsplash.com/photo-1633619946656-159bb0448e59?w=200&auto=format&fit=crop&q=60"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="w-1/2 h-full object-cover rounded-lg"
                  alt=""
                />
                <img
                  src="https://images.unsplash.com/photo-1495036019936-220b29b930ea?w=200&auto=format&fit=crop&q=60"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="w-1/2 h-full object-cover rounded-lg"
                  alt=""
                />
              </div>''',
    # Case B: single unsplash excavator image
    '''              <img
                src="https://images.unsplash.com/photo-1495036019936-220b29b930ea?w=400&auto=format&fit=crop&q=60"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="w-full h-20 object-cover object-center rounded-xl mt-auto"
                alt=""
              />''',
    # Case C: icon row
    '''              <div className="grid grid-cols-5 gap-1 mt-auto">
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
              </div>''',
]

replaced = False
if new_block in content:
    print("INFO: local image block already present, skipping banner replacement step")
    replaced = True
else:
    for old in candidates:
        if old in content:
            content = content.replace(old, new_block)
            print("OK: vehicle banner image replaced with local uploaded photo")
            replaced = True
            break

if not replaced:
    print("ERROR: no matching banner pattern found, banner NOT updated. Please send a screenshot of lines 1955-1980 of src/App.tsx")

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
