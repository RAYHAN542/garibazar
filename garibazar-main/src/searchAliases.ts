export const SEARCH_ALIAS_GROUPS: string[][] = [
  // "car" is kept specific (English car <-> বাংলা কার) so a "Car" search
  // shows actual cars, not every truck/excavator listing that happens to
  // use the generic Bangla word "গাড়ি" (vehicle) in its description.
  ["car", "কার"],
  // Generic vehicle-type term (Bangla "গাড়ি"/"গারি" covers any vehicle -
  // car, truck, bus, excavator etc.) - matched against English "vehicle",
  // not "car", to avoid over-matching a specific "car" search.
  ["vehicle", "গাড়ি", "গারি"],
  ["truck", "ট্রাক", "লরি", "lorry"],
  ["bus", "বাস"],
  ["bike", "motorcycle", "motorbike", "বাইক", "মোটরসাইকেল", "মোটর সাইকেল"],
  ["pickup", "pickup van", "পিকআপ", "পিক আপ"],
  ["jeep", "জিপ"],
  ["microbus", "micro bus", "মাইক্রোবাস", "মাইক্রো বাস"],
  ["cng", "সিএনজি", "অটো", "auto rickshaw", "অটোরিকশা"],
  ["excavator", "এক্সক্যাভেটর", "এক্সকাভেটর", "ভেকু"],
  ["crane", "ক্রেন"],
  ["bulldozer", "dozer", "বুলডোজার", "ডোজার"],
  ["forklift", "ফর্কলিফট", "ফর্কলিফ্ট"],
  ["loader", "লোডার"],
  ["tractor", "ট্রাক্টর"],

  // Common Parts and Spares (English / Bangla variants)
  ["headlight", "head light", "হেডলাইট", "হেড লাইট", "লাইট", "light"],
  ["brake pad", "brake", "ব্রেক", "ব্রেক প্যাড", "প্যাড", "pad"],
  ["engine", "ইঞ্জিন", "মোটর", "motor"],
  ["gearbox", "gear box", "গিয়ারবক্স", "গিয়ার বক্স", "গিয়ারবক্স", "গিয়ার বক্স", "গিয়ার", "gear"],
  ["suspension", "সাসপেনশন", "শক অবজরবার", "shock absorber", "শক"],
  ["tyre", "tire", "টায়ার", "চাকা", "wheel", "rim", "রিম"],
  ["battery", "ব্যাটারি", "ব্যাটারী"],
  ["bumper", "বাম্পার"],
  ["glass", "গ্লাস", "কাঁচ", "কাচ", "windshield", "উইন্ডশিল্ড", "উইন্ড শিল্ড"],
  ["seat", "সিট", "আসন", "কভার", "cover", "seat cover"],
  ["mirror", "মিরর", "আইনা", "आयना", "glass mirror", "লুকিং গ্লাস", "looking glass", "লুকিং"],
  ["door", "ডোর", "দরজা"],
  ["bonnet", "বনেট", "হুড", "hood"],
  ["radiator", "রেডিয়েটর", "রেডিয়েটর"],
  ["clutch", "clutch plate", "ক্লাচ", "ক্লাচ প্লেট"],
  ["ac", "air conditioner", "এসি", "এয়ার কন্ডিশনার", "air-conditioning", "এয়ার কন্ডিশনার", "কম্প্রেসর", "compressor"],
  ["filter", "ফিল্টার", "air filter", "mobil filter", "ওয়েল ফিল্টার", "ওয়েল ফিল্টার", "এয়ার ফিল্টার"],
  ["exhaust", "এক্সহস্ট", "সাইলেন্সার", "silencer", "exhaust pipe", "পাইপ", "pipe"],
  ["indicator", "ইন্ডিকেটর", "ইশারা বাতি", "signal light", "টার্ন সিগন্যাল", "turn signal", "সিগন্যাল"],
  ["horn", "হর্ন", "হর্ণ"],
  ["steering", "স্টিয়ারিং", "steering wheel", "স্টিয়ারিং"],
  ["wiper", "ওয়াইপার", "ওয়াইপার"],
  ["alloy wheel", "অ্যালয় হুইল", "রিম", "rim", "alloy wheels", "অ্যালয় হুইল"],
  ["sensor", "সেন্সর", "সেন্সার", "সেন্সর"],
  ["alternator", "অল্টারনেটর", "অল্টারনেটার", "ডায়নামো", "dynamo", "ডায়নামো"],
  
  // Brands & Models (English / Bangla variants)
  ["toyota", "টয়োটা"],
  ["honda", "হোন্ডা", "হন্ডা"],
  ["nissan", "নিসান", "নিশান"],
  ["mitsubishi", "মিতসুবিশি", "মিটসুবিশি"],
  ["suzuki", "সুজুকি", "সুযুকি"],
  ["hyundai", "হুন্দাই", "হুন্ডাই"],
  ["corolla", "কোরোল্লা", "করোল্লা", "করোলা"],
  ["allion", "এলিয়ন", "অ্যালিয়ন", "অ্যালিয়ন", "এলিয়ন"],
  ["premio", "প্রিমিও"],
  ["axio", "আক্সিও", "এক্সিও", "এক্সিউ"],
  ["vezel", "ভেসেল", "ভেজেল"],
  ["x-trail", "এক্স-ট্রেইল", "এক্স ট্রেইল", "xtrail"],
  ["probox", "প্রোবক্স"],
  ["noah", "নোহা", "নোয়াহ"],
  ["voxy", "ভক্সী", "ভক্সি", "ভক্সী"],
  ["civic", "সিভিক"],
  
  // Caterpillar / Cat Heavy Parts support
  ["caterpillar", "cat", "ক্যাটারপিলার", "ক্যাট"]
];

// ---------------------------------------------------------------------------
// Bengali <-> English phonetic matching
// Converts Bengali script into a rough Latin phonetic key (e.g. "\u0997\u09be\u09dc\u09bf" -> "gari")
// so that a listing written in one script can still be found by a query typed
// in the other. This is a heuristic transliteration (not a linguistically
// perfect one) tuned for search recall, paired with Fuse.js fuzzy matching to
// absorb small spelling differences.
// ---------------------------------------------------------------------------

const BN_CONSONANTS: Record<string, string> = {
  "\u0995": "k", "\u0996": "kh", "\u0997": "g", "\u0998": "gh", "\u0999": "ng",
  "\u099a": "ch", "\u099b": "chh", "\u099c": "j", "\u099d": "jh", "\u099e": "n",
  "\u099f": "t", "\u09a0": "th", "\u09a1": "d", "\u09a2": "dh", "\u09a3": "n",
  "\u09a4": "t", "\u09a5": "th", "\u09a6": "d", "\u09a7": "dh", "\u09a8": "n",
  "\u09aa": "p", "\u09ab": "ph", "\u09ac": "b", "\u09ad": "bh", "\u09ae": "m",
  "\u09af": "j", "\u09b0": "r", "\u09b2": "l", "\u09b6": "sh", "\u09b7": "sh",
  "\u09b8": "s", "\u09b9": "h", "\u09ce": "t"
};

// Bengali "nukta" (\u09bc) modifies the base letter's sound: \u09a1+\u09bc -> \u09a1\u09bc (r), \u09a2+\u09bc -> \u09a2\u09bc (rh),
// \u09af+\u09bc -> \u09af\u09bc (y). In real-world text these are almost always stored as this
// base-letter + combining-nukta sequence rather than a single precomposed
// character, so we handle the modifier explicitly instead of as a map key.
const BN_NUKTA = "\u09BC";
const BN_NUKTA_OVERRIDE: Record<string, string> = { "\u09a1": "r", "\u09a2": "rh", "\u09af": "y" };

const BN_INDEPENDENT_VOWELS: Record<string, string> = {
  "\u0985": "o", "\u0986": "a", "\u0987": "i", "\u0988": "i", "\u0989": "u", "\u098a": "u",
  "\u098b": "ri", "\u098f": "e", "\u0990": "oi", "\u0993": "o", "\u0994": "ou"
};

const BN_MATRAS: Record<string, string> = {
  "\u09be": "a", "\u09bf": "i", "\u09c0": "i", "\u09c1": "u", "\u09c2": "u",
  "\u09c3": "ri", "\u09c7": "e", "\u09c8": "oi", "\u09cb": "o", "\u09cc": "ou"
};

const BN_OTHER_MARKS: Record<string, string> = {
  "\u0982": "ng", "\u0983": "h", "\u0981": ""
};

const BN_HASANT = "\u09cd";

/**
 * Converts mixed Bengali/English text into a rough Latin phonetic key.
 * English/Latin characters pass through (lowercased) unchanged, so it's safe
 * to call on any text regardless of script.
 */
export function toPhoneticKey(text: string): string {
  if (!text) return "";
  const chars = Array.from(text);
  let out = "";
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    if (BN_CONSONANTS[ch]) {
      let latin = BN_CONSONANTS[ch];
      let consumed = 1;

      // Consonant + nukta (e.g. base + nukta = retroflex flap) changes the sound
      if (chars[i + 1] === BN_NUKTA) {
        latin = BN_NUKTA_OVERRIDE[ch] || latin;
        consumed = 2;
      }

      const next = chars[i + consumed];
      if (next === BN_HASANT) {
        out += latin; // suppressed inherent vowel
        consumed += 1;
      } else if (next && BN_MATRAS[next]) {
        out += latin + BN_MATRAS[next];
        consumed += 1;
      } else {
        out += latin + "o"; // default inherent vowel
      }
      i += consumed;
      continue;
    }

    if (BN_INDEPENDENT_VOWELS[ch]) {
      out += BN_INDEPENDENT_VOWELS[ch];
      i += 1;
      continue;
    }

    if (ch === BN_NUKTA) {
      i += 1; // stray nukta with no preceding consonant, drop
      continue;
    }

    if (BN_OTHER_MARKS[ch] !== undefined) {
      out += BN_OTHER_MARKS[ch];
      i += 1;
      continue;
    }

    if (ch === BN_HASANT) {
      i += 1; // stray hasant, drop
      continue;
    }

    out += ch.toLowerCase();
    i += 1;
  }

  return out;
}

export function convertBengaliDigitsToEnglish(text: string): string {
  const bDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return text.split("").map((char) => {
    const idx = bDigits.indexOf(char);
    return idx !== -1 ? idx.toString() : char;
  }).join("");
}

export function convertEnglishDigitsToBengali(text: string): string {
  const bDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return text.split("").map((char) => {
    const code = char.charCodeAt(0);
    if (code >= 48 && code <= 57) {
      return bDigits[code - 48];
    }
    return char;
  }).join("");
}

export function buildSearchBlob(parts: (string | undefined)[]): string {
  const rawTextOriginal = parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join(" ");
  
  const rawText = rawTextOriginal.toLowerCase();

  const collectedAliases = new Set<string>();

  // Word-boundary aware check for alias-group triggers. Plain alphabetic
  // variants (real words like "car", "bus") require a true word boundary
  // so a truck listing mentioning "cargo" doesn't get tagged as a "car"
  // just because the letters happen to appear in sequence. Numeric/mixed
  // variants (like "e70", "320") keep the old loose substring behavior.
  const isPureAlphaWord = (s: string) => /^[a-z]+$/i.test(s) || /^[\u0980-\u09FF]+$/.test(s);
  const hasAliasMatch = (text: string, variant: string): boolean => {
    const v = variant.toLowerCase();
    if (!isPureAlphaWord(v)) return text.includes(v);
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundary = "[^a-zA-Z\\u0980-\\u09FF]";
    const re = new RegExp(`(^|${boundary})${escaped}($|${boundary})`, "i");
    return re.test(text);
  };

  // If any keyword in a group is found in rawText, add all keywords of that group to aliases
  for (const group of SEARCH_ALIAS_GROUPS) {
    let matchesGroup = false;
    for (const variant of group) {
      if (hasAliasMatch(rawText, variant)) {
        matchesGroup = true;
        break;
      }
    }
    if (matchesGroup) {
      for (const variant of group) {
        collectedAliases.add(variant);
      }
    }
  }

  // Auto-associate Caterpillar models (like 320, e70, e120, etc.) with cat/caterpillar/ক্যাট
  const catModels = ["320", "৩২০", "e70", "ই৭০", "এ৭০", "e৭0", "e৭০", "e70", "e-70", "320d", "৩২০ডি"];
  let isCaterpillarWordPresent = false;
  for (const mod of catModels) {
    if (rawText.includes(mod.toLowerCase())) {
      isCaterpillarWordPresent = true;
      break;
    }
  }
  if (isCaterpillarWordPresent) {
    ["caterpillar", "cat", "ক্যাটারপিলার", "ক্যাট"].forEach(kw => collectedAliases.add(kw));
  }

  // Handle Bangla & English Digit Transliteration and Spacing normalizations
  const englishDigits = convertBengaliDigitsToEnglish(rawText);
  const bengaliDigits = convertEnglishDigitsToBengali(rawText);

  // Strip spaces to match names like "cat320" and "cat 320"
  const collapsedOriginal = rawText.replace(/\s+/g, "");
  const collapsedEnglish = englishDigits.replace(/\s+/g, "");
  const collapsedBengali = bengaliDigits.replace(/\s+/g, "");

  // Generate direct combinations for Caterpillar brands & models to handle "cate70", "cat320", etc.
  const extraCombinations = new Set<string>();
  const catKeywords = ["cat", "caterpillar", "ক্যাট", "ক্যাটারপিলার"];
  
  // Find match for E70 or E70-like in English and Bengali
  const foundModels = catModels.filter(mod => 
    rawText.includes(mod.toLowerCase()) || 
    englishDigits.includes(mod.toLowerCase()) || 
    bengaliDigits.includes(mod.toLowerCase())
  );
  
  if (foundModels.length > 0 || isCaterpillarWordPresent) {
    const modelsToCombine = foundModels.length > 0 ? foundModels : ["320", "e70"];
    for (const brand of catKeywords) {
      for (const model of modelsToCombine) {
        extraCombinations.add(`${brand}${model}`.toLowerCase());
        extraCombinations.add(`${brand} ${model}`.toLowerCase());
        // Also combine transliterated models
        extraCombinations.add(`${brand}${convertBengaliDigitsToEnglish(model)}`.toLowerCase());
        extraCombinations.add(`${brand}${convertEnglishDigitsToBengali(model)}`.toLowerCase());
      }
    }
  }

  // Phonetic Bangla<->English key so a listing in one script is still found
  // when searched in the other (e.g. a Bengali listing matches a "gari" query).
  const phoneticKey = toPhoneticKey(rawText);
  const collapsedPhonetic = phoneticKey.replace(/\s+/g, "");

  const partsList = [
    rawText,
    englishDigits,
    bengaliDigits,
    collapsedOriginal,
    collapsedEnglish,
    collapsedBengali,
    phoneticKey,
    collapsedPhonetic,
    Array.from(collectedAliases).join(" "),
    Array.from(extraCombinations).join(" ")
  ];

  return Array.from(new Set(partsList.filter(p => p.length > 0))).join(" ");
}
