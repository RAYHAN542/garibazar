with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

changes = []

old1 = 'import { MessageSquare, Cpu, SlidersHorizontal, Moon, Sun, Users, HelpCircle, Mail, FileText, ArrowRight, Menu, Download, ChevronDown } from "lucide-react";'
new1 = 'import { MessageSquare, Cpu, SlidersHorizontal, Moon, Sun, Users, HelpCircle, Mail, FileText, ArrowRight, Menu, Download, ChevronDown, Check } from "lucide-react";'
if new1 in content:
    changes.append("INFO: Check import already present")
elif old1 in content:
    content = content.replace(old1, new1)
    changes.append("OK: fixed missing Check icon import (critical crash fix)")
else:
    changes.append("ERROR: could not find lucide-react import line to fix Check")

old2 = 'import vehicleCardImg from "./assets/images/vehicle-card.png";'
new2 = 'import vehicleCardImg from "./assets/images/vehicle-banner.jpg";'
if new2 in content:
    changes.append("INFO: vehicle image import already correct")
elif old2 in content:
    content = content.replace(old2, new2)
    changes.append("OK: reverted vehicle image to clean photo crop")
else:
    changes.append("WARNING: vehicle-card.png import not found, skipped")

old3 = '''              <img
                src={vehicleCardImg}
                alt={language === "bn" ? "গাড়ি বেচা/কেনা" : "Vehicle Buy & Sell"}
                className="w-full h-20 object-contain mt-auto"
              />'''
new3 = '''              <img
                src={vehicleCardImg}
                alt={language === "bn" ? "গাড়ি বেচা/কেনা" : "Vehicle Buy & Sell"}
                className="w-full h-auto mt-auto rounded-lg"
              />'''
if new3 in content:
    changes.append("INFO: vehicle image sizing already fixed")
elif old3 in content:
    content = content.replace(old3, new3)
    changes.append("OK: fixed vehicle image sizing (no more white bars)")
else:
    changes.append("WARNING: vehicle image className pattern not found, skipped")

old4 = '''              <img
                src={partsCardImg}
                alt={language === "bn" ? "গাড়ির পাট" : "Vehicle Parts"}
                className="w-full h-20 object-contain mt-auto"
              />'''
new4 = '''              <img
                src={partsCardImg}
                alt={language === "bn" ? "গাড়ির পাট" : "Vehicle Parts"}
                className="w-full h-auto mt-auto rounded-lg"
              />'''
if new4 in content:
    changes.append("INFO: parts image sizing already fixed")
elif old4 in content:
    content = content.replace(old4, new4)
    changes.append("OK: fixed parts image sizing (no more white bars)")
else:
    changes.append("WARNING: parts image className pattern not found, skipped")

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

for c in changes:
    print(c)
print("DONE: all fixes applied, please run npm run build to verify")
