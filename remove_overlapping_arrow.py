with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = '''              {selectedCategory === "spare_parts" && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-md z-10">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
              <span className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-sm z-10">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>'''

new = '''              {selectedCategory === "spare_parts" && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-md z-10">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
            </button>'''

if new in content:
    print("INFO: overlapping arrow already removed")
elif old in content:
    content = content.replace(old, new)
    with open("src/App.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: removed overlapping arrow badge from parts card")
else:
    print("ERROR: pattern not found, please check manually")
