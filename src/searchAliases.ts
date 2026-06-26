export const SEARCH_ALIAS_GROUPS: string[][] = [
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

  // If any keyword in a group is found in rawText, add all keywords of that group to aliases
  for (const group of SEARCH_ALIAS_GROUPS) {
    let matchesGroup = false;
    for (const variant of group) {
      if (rawText.includes(variant.toLowerCase())) {
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

  const partsList = [
    rawText,
    englishDigits,
    bengaliDigits,
    collapsedOriginal,
    collapsedEnglish,
    collapsedBengali,
    Array.from(collectedAliases).join(" "),
    Array.from(extraCombinations).join(" ")
  ];

  return Array.from(new Set(partsList.filter(p => p.length > 0))).join(" ");
}
